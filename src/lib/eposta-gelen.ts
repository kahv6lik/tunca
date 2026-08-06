import "server-only";
import { ImapFlow } from "imapflow";
import { coz } from "./sifreleme";
import { tenantOlustur, type TenantClient } from "./tenant-db";

/**
 * Gelen kutusu senkronu — Faz 8 / D3.
 *
 * AMAÇ POSTA İSTEMCİSİ OLMAK DEĞİL. Amaç, müşteriyle yapılan yazışmanın
 * CRM'de izini bırakmak: "bu firmayla en son ne konuşulmuş?" sorusunun
 * yanıtı zaman akışında görünsün.
 *
 * Bu yüzden iletinin GÖVDESİ saklanmaz — yalnızca kim, ne zaman, hangi konu
 * ve kısa bir özet. Müşteri yazışmasının tamamını CRM veritabanına kopyalamak
 * hem gereksiz hem de KVKK açısından fazladan bir yük olurdu.
 *
 * EŞLEŞTİRME: gönderenin e-posta adresi bir `Kisi` kaydıyla eşleşirse ileti
 * o kişinin firmasına bağlanır ve firma zaman akışına aktivite olarak düşer.
 * Eşleşme yoksa kayıt yine tutulur (adres bilinmiyor diye yazışma
 * kaybolmasın) ama hiçbir firmaya bağlanmaz.
 *
 * NOT: bu modül gerçek bir IMAP sunucusu gerektirir; geliştirme
 * konteynerinde canlı doğrulanamaz. Ayarın çalıştığı, ayar ekranındaki
 * "Test Et" düğmesiyle (SMTP) ve senkron sonrası "son tarama"/"son hata"
 * bilgisiyle görülür.
 */

/** Tek çalıştırmada en fazla kaç ileti işlenir? */
const AZAMI_ILETI = 50;

export type SenkronSonucu = { okunan: number; eslesen: number; hata?: string };

export async function gelenKutusuSenkron(db: TenantClient): Promise<SenkronSonucu> {
  const ayar = await db.epostaAyari.findFirst({});
  if (!ayar?.aktif || !ayar.imapHost || !ayar.imapKullanici) {
    return { okunan: 0, eslesen: 0 };
  }

  const parola = coz(ayar.imapParola);
  if (!parola) {
    await hataYaz(db, "IMAP parolası çözülemedi. Ayar ekranından yeniden girin.");
    return { okunan: 0, eslesen: 0, hata: "parola" };
  }

  const istemci = new ImapFlow({
    host: ayar.imapHost,
    port: ayar.imapPort,
    secure: true,
    auth: { user: ayar.imapKullanici, pass: parola },
    logger: false,
  });

  let okunan = 0;
  let eslesen = 0;

  try {
    await istemci.connect();
    const kilit = await istemci.getMailboxLock(ayar.imapKlasor || "INBOX");

    try {
      // Yalnızca son taramadan SONRAKİ iletiler; ilk çalıştırmada son 7 gün.
      const baslangic =
        ayar.sonSenkron ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const mesajlar = istemci.fetch(
        { since: baslangic },
        { envelope: true, bodyStructure: false, uid: true }
      );

      for await (const mesaj of mesajlar) {
        if (okunan >= AZAMI_ILETI) break;

        const zarf = mesaj.envelope;
        if (!zarf) continue;

        const mesajId = zarf.messageId ?? `uid-${mesaj.uid}`;
        const gonderen = zarf.from?.[0]?.address?.toLowerCase() ?? "";
        const alici = zarf.to?.[0]?.address ?? "";
        const konu = zarf.subject ?? "(konu yok)";
        const tarih = zarf.date ?? new Date();

        if (!gonderen) continue;

        // Aynı ileti iki kez işlenmesin.
        const mevcut = await db.epostaKaydi.findFirst({ where: { mesajId } });
        if (mevcut) continue;

        // Gönderen adresi bir kişiyle eşleşiyor mu?
        const kisi = await db.kisi.findFirst({
          where: { email: { equals: gonderen, mode: "insensitive" } },
          select: { id: true, ad: true, firmaId: true },
        });

        await tenantOlustur(db, "epostaKaydi", {
          mesajId,
          yon: "gelen",
          gonderen,
          alici,
          konu,
          ozet: null,
          tarih,
          firmaId: kisi?.firmaId ?? null,
          kisiId: kisi?.id ?? null,
        });
        okunan++;

        // Eşleşen ileti firmanın zaman akışına düşer (C6).
        if (kisi) {
          await tenantOlustur(db, "aktivite", {
            tur: "eposta",
            baslik: konu,
            aciklama: `${kisi.ad} (${gonderen}) tarafından gönderildi.`,
            firmaId: kisi.firmaId,
            kisiId: kisi.id,
            olusturanEmail: "eposta-senkron",
            createdAt: tarih,
          });
          eslesen++;
        }
      }
    } finally {
      kilit.release();
    }

    await istemci.logout();

    await db.epostaAyari.updateMany({
      where: {},
      data: { sonSenkron: new Date(), sonHata: null },
    });

    return { okunan, eslesen };
  } catch (e) {
    const hata = e instanceof Error ? e.message : "Bilinmeyen hata";
    await hataYaz(db, hata);
    // Bağlantı yarıda kaldıysa kapatmayı dene; başarısız olması sorun değil.
    try {
      await istemci.logout();
    } catch {
      /* yoksay */
    }
    return { okunan, eslesen, hata };
  }
}

async function hataYaz(db: TenantClient, hata: string) {
  try {
    await db.epostaAyari.updateMany({
      where: {},
      data: { sonHata: hata.slice(0, 500) },
    });
  } catch {
    /* ayar yazılamadıysa yapacak bir şey yok */
  }
}
