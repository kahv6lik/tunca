import "server-only";
import nodemailer from "nodemailer";
import { coz } from "./sifreleme";
import type { TenantClient } from "./tenant-db";

/**
 * E-posta gönderimi — Faz 8 / D1.
 *
 * Ayarlar KİRACIYA aittir: her kuruluş kendi posta sunucusundan gönderir.
 * Bunun sebebi teknik değil, ticari: gönderen adresi müşterinin kendi alan
 * adı olmalıdır, aksi halde alıcıya "gezegen-crm" adresinden posta düşer ve
 * spam sayılma ihtimali artar.
 *
 * Gönderim KUYRUKTAN yapılır (`EpostaKuyrugu`). Kullanıcının işlemi posta
 * sunucusunu beklemez; başarısız gönderim yeniden denenir ve her denemenin
 * izi kalır.
 */

export type SmtpAyari = {
  host: string;
  port: number;
  guvenli: boolean;
  kullanici: string | null;
  parola: string | null;
  gonderenAd: string | null;
  gonderenAdres: string | null;
};

/** En fazla kaç kez denenir? Sonrasında kayıt "hata" durumunda kalır. */
const AZAMI_DENEME = 3;

export function tasiyiciOlustur(ayar: SmtpAyari) {
  return nodemailer.createTransport({
    host: ayar.host,
    port: ayar.port,
    secure: ayar.guvenli,
    auth:
      ayar.kullanici && ayar.parola
        ? { user: ayar.kullanici, pass: ayar.parola }
        : undefined,
    // Bir posta sunucusu yanıt vermediğinde kuyruk çalıştırıcısı sonsuza
    // kadar asılı kalmamalı.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Kiracının kayıtlı ayarını çözülmüş parolayla getirir. */
export async function smtpAyariOku(db: TenantClient): Promise<SmtpAyari | null> {
  const ayar = await db.epostaAyari.findFirst({});
  if (!ayar?.aktif || !ayar.smtpHost) return null;

  return {
    host: ayar.smtpHost,
    port: ayar.smtpPort,
    guvenli: ayar.smtpGuvenli,
    kullanici: ayar.smtpKullanici,
    parola: coz(ayar.smtpParola),
    gonderenAd: ayar.gonderenAd,
    gonderenAdres: ayar.gonderenAdres,
  };
}

/** Tek bir deneme gönderimi — ayar ekranındaki "Test et" düğmesi için. */
export async function testGonder(
  ayar: SmtpAyari,
  alici: string
): Promise<{ ok: boolean; hata?: string }> {
  try {
    const tasiyici = tasiyiciOlustur(ayar);
    await tasiyici.sendMail({
      from: gonderenAlani(ayar),
      to: alici,
      subject: "Gezegen CRM — e-posta ayarı testi",
      text:
        "Bu ileti, Gezegen CRM e-posta ayarlarınızın çalıştığını doğrulamak " +
        "için gönderildi.\n\nBu iletiyi aldıysanız kurulum tamamdır.\n\n—\nGezegen CRM",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}

export function gonderenAlani(ayar: SmtpAyari): string {
  const adres = ayar.gonderenAdres ?? ayar.kullanici ?? "no-reply@localhost";
  return ayar.gonderenAd ? `"${ayar.gonderenAd}" <${adres}>` : adres;
}

/**
 * Kuyruktaki bekleyen postaları gönderir.
 *
 * Zamanlanmış çalıştırıcıdan (`/api/gorevler`) çağrılır. Tek seferde en fazla
 * `limit` kadar posta işlenir; bir çalıştırma sonsuza kadar sürmemelidir.
 *
 * Dönen sayılar çalıştırıcının günlüğüne yazılır.
 */
export async function kuyruguIsle(
  db: TenantClient,
  limit = 25
): Promise<{ gonderilen: number; hatali: number; atlanan: number }> {
  const ayar = await smtpAyariOku(db);
  if (!ayar) {
    // Ayar yoksa kuyruğa dokunulmaz: ayar sonradan tanımlanınca bekleyen
    // postalar gönderilebilsin.
    return { gonderilen: 0, hatali: 0, atlanan: 0 };
  }

  const bekleyenler = await db.epostaKuyrugu.findMany({
    where: { durum: "bekliyor", denemeSayisi: { lt: AZAMI_DENEME } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  if (bekleyenler.length === 0) return { gonderilen: 0, hatali: 0, atlanan: 0 };

  const tasiyici = tasiyiciOlustur(ayar);
  let gonderilen = 0;
  let hatali = 0;

  for (const posta of bekleyenler) {
    try {
      await tasiyici.sendMail({
        from: gonderenAlani(ayar),
        to: posta.alici,
        subject: posta.konu,
        text: posta.govde,
      });

      await db.epostaKuyrugu.updateMany({
        where: { id: posta.id },
        data: {
          durum: "gonderildi",
          gonderimZamani: new Date(),
          denemeSayisi: posta.denemeSayisi + 1,
          hata: null,
        },
      });
      gonderilen++;
    } catch (e) {
      const deneme = posta.denemeSayisi + 1;
      await db.epostaKuyrugu.updateMany({
        where: { id: posta.id },
        data: {
          // Deneme hakkı bitince "hata" olarak dondurulur; aksi halde
          // bozuk bir adres kuyruğu sonsuza kadar meşgul ederdi.
          durum: deneme >= AZAMI_DENEME ? "hata" : "bekliyor",
          denemeSayisi: deneme,
          hata: e instanceof Error ? e.message.slice(0, 500) : "Bilinmeyen hata",
        },
      });
      hatali++;
    }
  }

  return { gonderilen, hatali, atlanan: 0 };
}
