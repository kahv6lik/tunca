/**
 * KVKK — aydınlatma metni ve saklama politikası (Faz 12 / F7).
 *
 * `server-only` DEĞİLDİR: metin hem aydınlatma sayfasında (istemci), hem
 * rıza kaydında (sunucu), hem de testlerde kullanılır.
 *
 * SÜRÜM NUMARASI ÖNEMLİDİR: rıza, metnin HANGİ sürümüne verildiğiyle birlikte
 * saklanır. Metin değiştiğinde sürüm artırılır ve kullanıcılardan yeniden
 * onay istenir — "bir kere onayladı" savunması, değişen bir metin için
 * geçerli değildir.
 */
export const KVKK_SURUM = "2026-08-1";

export const KVKK_BASLIK = "Kişisel Verilerin Korunması Aydınlatma Metni";

export type KvkkBolum = { baslik: string; govde: string[] };

export const KVKK_METNI: KvkkBolum[] = [
  {
    baslik: "Veri sorumlusu",
    govde: [
      "Bu uygulamayı kullanan kuruluş, işlediği kişisel veriler bakımından veri " +
        "sorumlusudur. Uygulamayı sağlayan taraf, kuruluş adına veri işleyen " +
        "sıfatıyla hareket eder.",
    ],
  },
  {
    baslik: "İşlenen veriler",
    govde: [
      "Hesap verileri: ad soyad, e-posta adresi, rol ve yetki bilgisi, şifre özeti.",
      "Kullanım verileri: giriş denemeleri (e-posta, IP adresi, zaman), açık oturum " +
        "kayıtları (cihaz özeti, IP, son etkinlik) ve denetim günlüğü (hangi kayıtta " +
        "ne değişti).",
      "İş verileri: kuruluşun sisteme girdiği firma, kişi, fırsat, teklif ve benzeri " +
        "kayıtlar; bunların içeriğini kuruluş belirler.",
    ],
  },
  {
    baslik: "İşleme amacı ve hukuki sebep",
    govde: [
      "Hesap verileri, hizmetin sunulabilmesi ve sözleşmenin ifası için işlenir.",
      "Giriş denemeleri ve oturum kayıtları, hesap güvenliğinin sağlanması ve yetkisiz " +
        "erişimin tespiti amacıyla, meşru menfaat kapsamında işlenir.",
      "Denetim günlüğü, işlemlerin izlenebilirliğini sağlamak ve hukuki yükümlülükleri " +
        "yerine getirmek amacıyla tutulur.",
    ],
  },
  {
    baslik: "Saklama süresi",
    govde: [
      "Kuruluş, denetim günlüğü ve e-posta kayıtları için bir saklama süresi belirler. " +
        "Süre dolduğunda bu kayıtlar sistem tarafından kendiliğinden silinir.",
      "Giriş denemesi kayıtları en fazla 90 gün saklanır.",
      "Hesap kapatıldığında kişisel veriler silinir; iş verileri kuruluşa aittir ve " +
        "kuruluşun kararına göre saklanır ya da silinir.",
    ],
  },
  {
    baslik: "Veri aktarımı",
    govde: [
      "Veriler kuruluşun kendi alanı içinde tutulur; farklı kuruluşların verileri " +
        "birbirinden hem uygulama hem veritabanı düzeyinde yalıtılmıştır.",
      "Kuruluşun kendi e-posta sunucusu tanımlıysa bildirim iletileri o sunucu " +
        "üzerinden gönderilir; bunun dışında üçüncü taraflara aktarım yapılmaz.",
    ],
  },
  {
    baslik: "Haklarınız (KVKK m. 11)",
    govde: [
      "Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin " +
        "bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını " +
        "öğrenme hakkına sahipsiniz.",
      "Verilerinizin eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini, " +
        "şartların oluşması hâlinde silinmesini veya yok edilmesini isteyebilirsiniz.",
      "Taleplerinizi kuruluşunuzun yöneticisine iletebilirsiniz. Hesabınıza ait " +
        "verilerin bir kopyasını Hesap Güvenliği ekranından dışa aktarabilirsiniz.",
    ],
  },
];

/** Denetim günlüğü ve e-posta kayıtları için önerilen saklama süreleri. */
export const SAKLAMA_SECENEKLERI = [
  { deger: 0, etiket: "Süresiz (silme)" },
  { deger: 90, etiket: "90 gün" },
  { deger: 180, etiket: "6 ay" },
  { deger: 365, etiket: "1 yıl" },
  { deger: 730, etiket: "2 yıl" },
];

/** Giriş denemesi kayıtları için sabit üst sınır (aydınlatma metninde yazılı). */
export const GIRIS_DENEMESI_SAKLAMA_GUN = 90;

/** Saklama süresine göre "bundan eskisi silinir" eşiği. 0 = silme yok. */
export function saklamaEsigi(gun: number, simdi: Date = new Date()): Date | null {
  if (gun <= 0) return null;
  return new Date(simdi.getTime() - gun * 86_400_000);
}
