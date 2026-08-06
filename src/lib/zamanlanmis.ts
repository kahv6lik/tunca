import "server-only";
import { prisma } from "./db";
import { yonetimIstemcisi, kiraciIstemcisi } from "./rls";
import { tenantClient, type TenantClient } from "./tenant-db";
import { kiracininKurallariniCalistir } from "./is-akisi";
import { kuyruguIsle } from "./eposta";
import { gelenKutusuSenkron } from "./eposta-gelen";

/**
 * Zamanlanmış işler — Faz 8 / D1, D2, D3.
 *
 * ÜÇÜNCÜ DAR KAPI. Faz 5'te iki bilinçli istisna vardı (admin panel, davet
 * kabulü); bu üçüncüsüdür ve gerekçesi şudur: zamanlanmış işleri çalıştıran
 * bir oturum YOKTUR — ne kullanıcı ne kiracı bağlamı vardır. İş, bütün
 * kiracılar için ayrı ayrı yapılmalıdır.
 *
 * Kapsam dar tutulmuştur:
 *   - Yönetim bağlamı YALNIZCA kiracı LİSTESİNİ okumak için kullanılır.
 *   - Her kiracının işi, o kiracının kendi bağlamında (`tenantClient`)
 *     yapılır; yani iş verisine erişim yine kiracı sınırına tabidir.
 *   - Uç nokta paylaşımlı bir gizle korunur (`GOREV_ANAHTARI`).
 */

export type CalistirmaSonucu = {
  kiraci: number;
  kural: number;
  islenen: number;
  eposta: { gonderilen: number; hatali: number };
  senkron: { okunan: number; eslesen: number };
  hata: string[];
};

/** Uç noktayı koruyan paylaşımlı gizli anahtar doğru mu? */
export function anahtarGecerliMi(gelen: string | null): boolean {
  const beklenen = process.env.GOREV_ANAHTARI;
  // Anahtar TANIMLI DEĞİLSE uç nokta kapalıdır. "Tanımlı değilse serbest"
  // davranışı, üretimde yanlışlıkla herkese açık bir tetikleyici bırakırdı.
  if (!beklenen) return false;
  return gelen === beklenen;
}

/**
 * Bütün kiracılar için zamanlanmış işleri çalıştırır.
 *
 * Bir kiracıda hata olması diğerlerini durdurmaz; hatalar toplanıp
 * döndürülür.
 */
export async function zamanlanmisIsleriCalistir(): Promise<CalistirmaSonucu> {
  const yonetim = yonetimIstemcisi(prisma);

  // Yalnızca aktif kiracılar: askıya alınmış bir müşteriye bildirim
  // göndermek ya da onun adına posta çekmek doğru olmaz.
  const kiracilar = await yonetim.tenant.findMany({
    where: { durum: "aktif" },
    select: { id: true },
  });

  const sonuc: CalistirmaSonucu = {
    kiraci: kiracilar.length,
    kural: 0,
    islenen: 0,
    eposta: { gonderilen: 0, hatali: 0 },
    senkron: { okunan: 0, eslesen: 0 },
    hata: [],
  };

  for (const { id } of kiracilar) {
    const db: TenantClient = tenantClient(id);

    try {
      const kural = await kiracininKurallariniCalistir(db);
      sonuc.kural += kural.kural;
      sonuc.islenen += kural.islenen;
    } catch (e) {
      sonuc.hata.push(`${id} iş akışı: ${e instanceof Error ? e.message : e}`);
    }

    try {
      const senkron = await gelenKutusuSenkron(db);
      sonuc.senkron.okunan += senkron.okunan;
      sonuc.senkron.eslesen += senkron.eslesen;
    } catch (e) {
      sonuc.hata.push(`${id} gelen kutusu: ${e instanceof Error ? e.message : e}`);
    }

    // Kuyruk EN SONDA işlenir: iş akışlarının ve senkronun ürettiği
    // bildirimler de aynı çalıştırmada gönderilsin.
    try {
      const kuyruk = await kuyruguIsle(db);
      sonuc.eposta.gonderilen += kuyruk.gonderilen;
      sonuc.eposta.hatali += kuyruk.hatali;
    } catch (e) {
      sonuc.hata.push(`${id} e-posta: ${e instanceof Error ? e.message : e}`);
    }
  }

  return sonuc;
}

/** Tek bir kiracı için çalıştırma — arayüzdeki "şimdi çalıştır" düğmeleri. */
export function kiraciIcinIstemci(tenantId: string) {
  return kiraciIstemcisi(tenantId, prisma);
}
