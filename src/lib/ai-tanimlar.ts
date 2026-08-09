/**
 * AI katmanının saf tanımları — Faz 21 (G1–G3).
 *
 * `server-only` DEĞİLDİR: ayar ekranı, sunucu katmanı ve testler aynı
 * listeleri okur.
 *
 * BU FAZIN ÇERÇEVESİ (yol haritasının sözü):
 *
 *   "AI çağrıları kiracı verisini kiracı sınırının dışına taşımaz; hangi
 *    verinin modele gönderildiği kiracı yöneticisine açıkça bildirilir ve
 *    kapatılabilir olur."
 *
 * Bu söz üç somut karara çevrildi:
 *
 *   1. **G1 (skorlama) HİÇ dış çağrı yapmaz.** Skor kiracının kendi kapanmış
 *      fırsatlarından saf bir fonksiyonla hesaplanır (`skor-saf.ts`).
 *      Gerekçesi denetlenebilir, maliyeti yok, aynı veriye hep aynı yanıt.
 *   2. **G3 (doğal dilde sorgu) modele VERİ göndermez**, yalnızca kullanıcının
 *      cümlesini ve alan adlarını gönderir; model bir SÜZGEÇ üretir, sorguyu
 *      her zaman uygulama çalıştırır (kiracı katmanı + izinler yerinde kalır).
 *   3. **G2 (özet) tek istisnadır** ve bu yüzden gönderilenler burada ADIYLA
 *      sayılmıştır (`OZET_ALANLARI`); ayar ekranı bu listeyi kullanıcıya
 *      olduğu gibi gösterir — "bir şeyler gönderiliyor" demek yetmez.
 */

/** AI çağrısının türü — kullanım defterine bu yazılır. */
export const AI_TURLERI = [
  { deger: "ozet", etiket: "Firma özeti" },
  { deger: "sorgu", etiket: "Doğal dilde sorgu" },
] as const;

export type AiTuru = (typeof AI_TURLERI)[number]["deger"];

/**
 * G2'de modele gönderilen alanlar — kullanıcıya GÖSTERİLMEK üzere.
 *
 * Liste burada durur ki ayar ekranındaki metinle kodun yaptığı iş
 * ayrışmasın: yeni bir alan göndermeye başlamak, bu listeye satır eklemeyi
 * gerektirir.
 */
export const OZET_ALANLARI = [
  "Firma adı, sektörü ve ili",
  "Açık ve kapanmış fırsatların başlıkları, tutarları ve durumları",
  "Tekliflerin numarası, tutarı ve durumu",
  "Siparişlerin numarası, tutarı ve durumu",
  "Destek kayıtlarının başlığı, önceliği ve durumu",
  "Son aktivitelerin türü, başlığı ve tarihi",
] as const;

/** G2'de modele GÖNDERİLMEYENLER — sözün ikinci yarısı. */
export const OZET_GONDERILMEYENLER = [
  "Kişilerin adı, telefonu ve e-postası",
  "Yüklenen dosyalar ve fotoğraflar",
  "Ziyaret konumları",
  "Anket yanıtları",
  "Fiyat kırılımı, iskonto ve kampanya bilgisi",
] as const;

/** Model yanıtını beklerken kabul edilen en uzun süre. */
export const AI_ZAMAN_ASIMI_MS = 20_000;

/** Bir özet isteğinde modele gönderilecek en fazla kayıt sayısı (tür başına). */
export const OZET_KAYIT_SINIRI = 12;

/**
 * Kiracının AI'ı kullanabilmesi için gereken ÜÇ koşul.
 *
 * Üçü de ayrı sebeplerle vardır ve hiçbiri diğerinin yerine geçmez:
 *   - `modulAcik`  : platform sahibi paketten kapatmış olabilir,
 *   - `kiraciAcik` : kiracı yöneticisi kendi kuruluşu için kapatmış olabilir
 *                    (varsayılan KAPALI),
 *   - `anahtarVar` : sağlayıcı anahtarı tanımlı olmayabilir — bu durumda
 *                    "tanımsızsa serbest" değil, "tanımsızsa KAPALI"dır
 *                    (Faz 8 / `/api/gorevler` ve Faz 17 / geocoding deseni).
 */
export type AiDurumu = {
  modulAcik: boolean;
  kiraciAcik: boolean;
  anahtarVar: boolean;
};

export function aiKullanilabilir(d: AiDurumu): boolean {
  return d.modulAcik && d.kiraciAcik && d.anahtarVar;
}

/**
 * Kapalıysa SEBEBİ söylenir.
 *
 * "AI kullanılamıyor" demek kullanıcıyı yöneticiye, yöneticiyi de bize
 * sorduracak bir mesajdır; hangi kapının kapalı olduğunu söylemek üç ayrı
 * eylemi işaret eder.
 */
export function aiKapaliSebebi(d: AiDurumu): string | null {
  if (aiKullanilabilir(d)) return null;
  if (!d.modulAcik) return "AI modülü paketinizde kapalı.";
  if (!d.kiraciAcik)
    return "AI özellikleri kuruluşunuzda kapalı. Yönetici Ayarlar'dan açabilir.";
  return "AI sağlayıcı anahtarı tanımlı değil; sunucu yöneticisi ekleyebilir.";
}

/** Kullanım defterindeki token sayısından kabaca okunur bir metin. */
export function tokenMetni(giris: number, cikis: number): string {
  const toplam = giris + cikis;
  if (toplam === 0) return "—";
  if (toplam < 1000) return `${toplam} token`;
  return `${(toplam / 1000).toFixed(1)}K token`;
}
