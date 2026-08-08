import "server-only";
import { tenantOlustur, type TenantClient } from "./tenant-db";

/**
 * Bildirim katmanı — Faz 8 / D1 + D5.
 *
 * TEK GİRİŞ NOKTASI: uygulama içindeki her bildirim `bildirimGonder`
 * üzerinden geçer. O da kullanıcının tercihine bakarak iki kanala yazar:
 *
 *   1. Uygulama içi bildirim (`Bildirim` tablosu) — her zaman güvenilir.
 *   2. E-posta kuyruğu (`EpostaKuyrugu`) — SMTP tanımlıysa.
 *
 * E-posta ANINDA gönderilmez; kuyruğa yazılır ve zamanlanmış çalıştırıcı
 * gönderir. Böylece posta sunucusu yavaşsa kullanıcının işlemi beklemez,
 * başarısız gönderim yeniden denenebilir ve gönderimin izi kalır.
 */

export const BILDIRIM_TURLERI = [
  { deger: "gorev.atandi", etiket: "Bana bir görev atandığında" },
  { deger: "gorev.yaklasti", etiket: "Görevimin son tarihi yaklaştığında" },
  { deger: "gorev.gecikti", etiket: "Görevim geciktiğinde" },
  { deger: "firsat.atandi", etiket: "Bana bir fırsat atandığında" },
  { deger: "firsat.asama", etiket: "Sorumlusu olduğum fırsat aşama değiştirdiğinde" },
  { deger: "teklif.durum", etiket: "Teklifimin durumu değiştiğinde" },
  { deger: "lead.atandi", etiket: "Bana bir aday atandığında" },
  { deger: "otomasyon", etiket: "İş akışı kuralı çalıştığında" },
  // Faz 15 — sipariş akışı. Depo bildirimi bilinçli olarak "onaylandı"ya
  // bağlıdır: onaysız siparişten sevkiyat ekibine haber GİTMEZ.
  { deger: "siparis.onaybekliyor", etiket: "Onayıma bir sipariş düştüğünde" },
  { deger: "siparis.karar", etiket: "Siparişim onaylandığında ya da reddedildiğinde" },
  { deger: "siparis.sevkiyat", etiket: "Sevkiyat için onaylı sipariş hazır olduğunda" },
] as const;

export type BildirimTuru = (typeof BILDIRIM_TURLERI)[number]["deger"];

export type BildirimIstegi = {
  kullaniciId: string;
  tur: string;
  baslik: string;
  mesaj?: string;
  link?: string;
  /** E-posta gönderimi için; verilmezse kullanıcının kaydından okunur. */
  eposta?: string;
};

/**
 * Bildirim gönderir.
 *
 * ASLA hata fırlatmaz: bildirim yan etkidir, asıl işlemi düşürmemelidir.
 * Denetim günlüğündeki (Faz 4) aynı gerekçe burada da geçerli.
 */
export async function bildirimGonder(
  db: TenantClient,
  istek: BildirimIstegi
): Promise<void> {
  try {
    const tercih = await db.bildirimTercihi.findFirst({
      where: { kullaniciId: istek.kullaniciId, tur: istek.tur },
    });

    // Kayıt yoksa varsayılan geçerlidir: iki kanal da açık.
    const uygulama = tercih?.uygulama ?? true;
    const eposta = tercih?.eposta ?? true;

    if (uygulama) {
      // `tenantOlustur` kullanılır: kiracı katmanı `tenantId`'yi çalışma
      // anında ekler, böylece hiçbir çağrı yerinde elle yazılmaz.
      await tenantOlustur(db, "bildirim", {
        kullaniciId: istek.kullaniciId,
        tur: istek.tur,
        baslik: istek.baslik,
        mesaj: istek.mesaj ?? null,
        link: istek.link ?? null,
      });
    }

    if (!eposta) return;

    // E-posta yalnızca kiracının SMTP ayarı aktifse kuyruğa girer; aksi halde
    // gönderilemeyecek kayıtlarla kuyruk şişerdi.
    const ayar = await db.epostaAyari.findFirst({});
    if (!ayar?.aktif || !ayar.smtpHost) return;

    const adres =
      istek.eposta ??
      (await db.user.findFirst({
        where: { id: istek.kullaniciId },
        select: { email: true },
      }))?.email;
    if (!adres) return;

    await tenantOlustur(db, "epostaKuyrugu", {
      alici: adres,
      konu: istek.baslik,
      govde: epostaGovdesi(istek),
      tur: istek.tur,
    });
  } catch (e) {
    console.error("Bildirim gönderilemedi:", e);
  }
}

/** Birden çok kullanıcıya aynı bildirim. */
export async function bildirimYayinla(
  db: TenantClient,
  kullaniciIdleri: string[],
  istek: Omit<BildirimIstegi, "kullaniciId">
): Promise<void> {
  for (const kullaniciId of new Set(kullaniciIdleri)) {
    await bildirimGonder(db, { ...istek, kullaniciId });
  }
}

/**
 * Düz metin e-posta gövdesi.
 *
 * HTML şablon bilinçli olarak yok: kiracıya özel markalama (Faz 5 / B7)
 * varken tek bir HTML şablonu her kuruluşta yanlış görünür. Düz metin her
 * istemcide doğru görünür ve okunur kalır. Zengin şablon gerekirse ayrı bir
 * çalışma paketi olmalıdır.
 */
function epostaGovdesi(istek: BildirimIstegi): string {
  const satirlar = [istek.baslik];
  if (istek.mesaj) satirlar.push("", istek.mesaj);
  if (istek.link) {
    const taban = process.env.UYGULAMA_ADRESI ?? "";
    satirlar.push("", `Kayda git: ${taban}${istek.link}`);
  }
  satirlar.push("", "—", "Gezegen CRM");
  return satirlar.join("\n");
}
