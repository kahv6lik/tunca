/**
 * Rapor kayıt defteri — Faz 18 / R1.
 *
 * `pano-tanimlar.ts` ile aynı desen ve aynı gerekçe: `server-only` DEĞİLDİR;
 * hub ekranı, rapor sayfaları ve testler aynı listeyi okur.
 *
 * YENİ RAPOR EKLEMEK = BURAYA SATIR EKLEMEK. Rapor merkezinin sözü budur:
 * her rapor kendi menü öğesini, kendi süzgeç çubuğunu ve kendi izin
 * kontrolünü yeniden yazmak zorunda kalmaz.
 *
 * Her raporun bir İZNİ vardır. İzni olmayan rapor hub'da GÖRÜNMEZ ve
 * sayfası açılmaz; paket kısıtı `etkinIzinler()` içinde uygulandığı için
 * kapalı modülün raporu da kendiliğinden düşer.
 */

export type RaporTanimi = {
  anahtar: string;
  etiket: string;
  aciklama: string;
  izin: string;
  /** Hub'daki gruplama başlığı. */
  grup: "Genel" | "Satış ve Mali" | "Operasyon";
  /**
   * Rapor bu merkezin KENDİ sayfası mı, yoksa modülün kendi ekranındaki
   * rapora bağlantı mı?
   *
   * Destek ve sevkiyat raporları Faz 15-16'da kendi modüllerinde yazıldı;
   * onları buraya KOPYALAMAK iki ayrı doğruluk kaynağı üretirdi. Merkez
   * onları listeler ve oraya götürür — "bütün raporlar tek çatı altında"
   * sözü, kodu ikiye bölmeden karşılanır.
   */
  disRota?: string;
  /** Ortak süzgeçlerden hangileri bu raporda anlamlı? */
  suzgecler: ("tarih" | "firma" | "sorumlu")[];
};

export const RAPORLAR: RaporTanimi[] = [
  {
    anahtar: "genel",
    etiket: "Genel Durum",
    aciklama: "Firma, yatırım, eğitim ve hizmet dağılımları",
    izin: "rapor.goruntule",
    grup: "Genel",
    suzgecler: ["tarih"],
  },
  {
    anahtar: "mali",
    etiket: "Mali Rapor",
    aciklama: "Ciro, beklenen tahsilat, indirim maliyeti, dönem karşılaştırması",
    izin: "siparis.goruntule",
    grup: "Satış ve Mali",
    suzgecler: ["tarih", "firma"],
  },
  {
    anahtar: "satis",
    etiket: "Satış Hattı",
    aciklama: "Aşama dağılımı, dönüşüm oranı, kazanç/kayıp sebepleri",
    izin: "firsat.goruntule",
    grup: "Satış ve Mali",
    suzgecler: ["tarih", "firma", "sorumlu"],
  },
  {
    anahtar: "urun",
    etiket: "Ürün Satışı",
    aciklama: "Ürün ve kategori bazında satış adedi ve tutarı",
    izin: "urun.goruntule",
    grup: "Satış ve Mali",
    suzgecler: ["tarih", "firma"],
  },
  {
    anahtar: "aktivite",
    etiket: "Aktivite Yükü",
    aciklama: "Kişi bazında aktivite, açık görev ve gecikme sayıları",
    izin: "aktivite.goruntule",
    grup: "Operasyon",
    suzgecler: ["tarih", "firma", "sorumlu"],
  },
  {
    anahtar: "saha",
    etiket: "Saha Ziyaretleri",
    aciklama: "Personel bazında ziyaret, süre ve konum doğrulama kırılımı",
    izin: "ziyaret.goruntule",
    grup: "Operasyon",
    disRota: "/ziyaretler",
    suzgecler: ["tarih", "sorumlu"],
  },
  {
    anahtar: "anket",
    etiket: "Anket Sonuçları",
    aciklama: "Yanıtlama oranı, NPS ve soru bazında dağılım",
    izin: "anket.goruntule",
    grup: "Operasyon",
    // Rapor ANKET BAZINDADIR: hangi anketin sonucuna bakılacağı merkezden
    // seçilemez, anket listesinden girilir.
    disRota: "/anketler",
    suzgecler: ["tarih"],
  },
  {
    anahtar: "destek",
    etiket: "Destek Raporu",
    aciklama: "Kanal kırılımı, öncelik dağılımı, kişi yükü, çözüm süresi",
    izin: "destek.goruntule",
    grup: "Operasyon",
    disRota: "/destek/rapor",
    suzgecler: ["tarih", "firma"],
  },
  {
    anahtar: "sevkiyat",
    etiket: "Sevkiyat Raporu",
    aciklama: "Durum kırılımı, bekleme süresi, geciken sevkiyatlar",
    izin: "sevkiyat.goruntule",
    grup: "Operasyon",
    disRota: "/sevkiyat",
    suzgecler: ["tarih"],
  },
  {
    anahtar: "kampanya",
    etiket: "Kampanya Kullanımı",
    aciklama: "Kampanya başına kullanım, kota ve indirim toplamı",
    izin: "kampanya.goruntule",
    grup: "Satış ve Mali",
    disRota: "/kampanyalar",
    suzgecler: ["tarih"],
  },
];

export function raporBul(anahtar: string): RaporTanimi | undefined {
  return RAPORLAR.find((r) => r.anahtar === anahtar);
}

/** Merkezin kendi sayfası olan raporlar (dış bağlantılar hariç). */
export const IC_RAPORLAR = RAPORLAR.filter((r) => !r.disRota);

export const RAPOR_GRUPLARI = ["Genel", "Satış ve Mali", "Operasyon"] as const;

/**
 * Ortak süzgeçleri querystring'e çevirir.
 *
 * Süzgeçler URL'de yaşar (tarih aralığındaki aynı karar, Faz 13 / H9):
 * seçilen dönem paylaşılabilir, yer imine eklenebilir ve kayıtlı görünüm
 * altyapısı (R5) hiçbir ek iş yapmadan onu saklayabilir.
 */
export function raporSorgusu(
  filtre: { bas?: string; bit?: string; firma?: string; sorumlu?: string },
  ek: Record<string, string> = {}
): string {
  const p = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries({ ...filtre, ...ek })) {
    if (deger) p.set(anahtar, deger);
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}
