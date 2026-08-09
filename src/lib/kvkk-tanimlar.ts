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
// Sürüm arttığında herkesten YENİDEN RIZA istenir. "2026-08-3": anket
// yanıtları bölümü eklendi (Faz 19).
export const KVKK_SURUM = "2026-08-3";

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
    baslik: "Saha çalışması ve konum verisi",
    govde: [
      "Saha ziyareti kaydı oluşturan çalışanların konum bilgisi, YALNIZCA " +
        "ziyaretin başlatıldığı ve bitirildiği anda, cihazın konum servisinden " +
        "alınır. Sürekli konum takibi YAPILMAZ; ziyaret dışındaki zamanlarda " +
        "konum verisi toplanmaz.",
      "Alınan konum, ziyaret edilen firmanın kayıtlı konumuyla karşılaştırılır " +
        "ve yalnızca 'doğrulandı / doğrulanamadı' sonucu ile ziyaret süresi " +
        "kaydedilir. Amaç, saha faaliyetinin doğruluğunu teyit etmek ve ziyaret " +
        "süresini raporlayabilmektir.",
      "Cihazın konum izni verilmediğinde ziyaret kaydı yine oluşturulur; " +
        "yalnızca 'konum doğrulanamadı' olarak işaretlenir. Konum paylaşmamak " +
        "çalışanın işini yapmasını engellemez.",
      "Konum kayıtları, kuruluşun belirlediği saklama süresine tabidir ve süre " +
        "dolduğunda diğer kayıtlarla birlikte silinir.",
    ],
  },
  {
    baslik: "Anket yanıtları",
    govde: [
      "Kuruluş, müşterilerine ve müşteri çalışanlarına e-posta ile anket " +
        "gönderebilir. Anket bağlantısı kişiye özeldir, bir kez kullanılabilir " +
        "ve anketin bitiş tarihine kadar geçerlidir.",
      "Anket ANONİM olarak işaretlenmişse, verilen yanıtlar kişiye ve firmaya " +
        "BAĞLANMAZ: yanıt kaydında hiçbir kimlik bilgisi tutulmaz ve kimin ne " +
        "yanıtladığı sonradan da tespit edilemez. Bu durumda yalnızca ankete " +
        "kaç kişiye gönderildiği ve kaçının yanıtladığı bilinir.",
      "Anket anonim değilse, yanıtlar gönderildiği kişiye ve firmaya bağlı " +
        "olarak saklanır; anketin başında bu durum katılımcıya bildirilir.",
      "Anket yanıtları, kuruluşun belirlediği saklama süresine tabidir ve süre " +
        "dolduğunda silinir.",
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
      "Saha ziyareti konum verisi, iş faaliyetinin doğruluğunun teyidi ve " +
        "raporlanması amacıyla, işverenin meşru menfaati kapsamında işlenir.",
    ],
  },
  {
    baslik: "Saklama süresi",
    govde: [
      "Kuruluş; denetim günlüğü, e-posta kayıtları ve saha ziyareti kayıtları için " +
        "bir saklama süresi belirler. " +
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
        "üzerinden gönderilir.",
      "Firma adreslerinin harita üzerinde konumlandırılması için adres bilgisi " +
        "bir harita hizmet sağlayıcısına iletilebilir. Bu aktarım yalnızca ADRES " +
        "metnini kapsar; kişi, ziyaret ya da çalışan bilgisi içermez ve sonuç " +
        "koordinat olarak saklandığı için her görüntülemede tekrarlanmaz.",
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
