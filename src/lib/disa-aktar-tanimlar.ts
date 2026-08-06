/**
 * Dışa/içe aktarım TANIMLARI — Faz 9 / E1, E2.
 *
 * `yetki-tanimlar.ts` ile aynı gerekçe: bu dosya `server-only` DEĞİLDİR;
 * hem sunucudaki dışa aktarım kapısı, hem istemcideki düğmeler ve sütun
 * eşleştirme ekranı, hem de testler aynı tanımları kullanır.
 *
 * Bir veri kümesi burada TANIMLANMADIKÇA dışa aktarılamaz. Sütun listesini
 * tek yerde tutmak, "hangi alanlar dışarı çıkıyor?" sorusunun tek bir yerden
 * yanıtlanabilmesi demektir — bir alanı yanlışlıkla dışa açmak zorlaşır.
 */

export type VeriKumesi = {
  deger: string;
  etiket: string;
  /** Bu kümeyi görüntülemek için gereken izin. */
  izin: string;
  /** İçe aktarıma açık mı? (E2) */
  iceAktarilir: boolean;
  sutunlar: Sutun[];
};

export type Sutun = {
  anahtar: string;
  etiket: string;
  /** İçe aktarımda zorunlu mu? */
  zorunlu?: boolean;
  tur?: "metin" | "sayi" | "tarih" | "durum";
};

export const VERI_KUMELERI: VeriKumesi[] = [
  {
    deger: "firmalar",
    etiket: "Firmalar",
    izin: "firma.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "ad", etiket: "Firma Adı", zorunlu: true },
      { anahtar: "vergiNo", etiket: "Vergi No" },
      { anahtar: "sektor", etiket: "Sektör" },
      { anahtar: "il", etiket: "İl" },
      { anahtar: "ilce", etiket: "İlçe" },
      { anahtar: "telefon", etiket: "Telefon" },
      { anahtar: "email", etiket: "E-posta" },
      { anahtar: "adres", etiket: "Adres" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "notlar", etiket: "Notlar" },
      { anahtar: "createdAt", etiket: "Eklenme Tarihi", tur: "tarih" },
    ],
  },
  {
    deger: "kisiler",
    etiket: "Kişiler",
    izin: "kisi.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "ad", etiket: "Ad Soyad", zorunlu: true },
      { anahtar: "firmaAd", etiket: "Firma", zorunlu: true },
      { anahtar: "unvan", etiket: "Unvan" },
      { anahtar: "telefon", etiket: "Telefon" },
      { anahtar: "email", etiket: "E-posta" },
      { anahtar: "birincil", etiket: "Birincil Kişi" },
      { anahtar: "notlar", etiket: "Notlar" },
    ],
  },
  {
    deger: "adaylar",
    etiket: "Adaylar (Lead)",
    izin: "lead.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "ad", etiket: "Ad Soyad", zorunlu: true },
      { anahtar: "firmaAd", etiket: "Firma Adı" },
      { anahtar: "unvan", etiket: "Unvan" },
      { anahtar: "email", etiket: "E-posta" },
      { anahtar: "telefon", etiket: "Telefon" },
      { anahtar: "il", etiket: "İl" },
      { anahtar: "sektor", etiket: "Sektör" },
      { anahtar: "kaynak", etiket: "Kaynak" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "notlar", etiket: "Notlar" },
      { anahtar: "createdAt", etiket: "Eklenme Tarihi", tur: "tarih" },
    ],
  },
  {
    deger: "firsatlar",
    etiket: "Fırsatlar",
    izin: "firsat.goruntule",
    iceAktarilir: false, // aşama/kişi bağları gerektirir; elle kurulmalı
    sutunlar: [
      { anahtar: "baslik", etiket: "Fırsat" },
      { anahtar: "firmaAd", etiket: "Firma" },
      { anahtar: "kisiAd", etiket: "Kişi" },
      { anahtar: "asamaAd", etiket: "Aşama" },
      { anahtar: "tutar", etiket: "Tutar", tur: "sayi" },
      { anahtar: "paraBirimi", etiket: "Para Birimi" },
      { anahtar: "olasilik", etiket: "Olasılık (%)", tur: "sayi" },
      { anahtar: "beklenenCiro", etiket: "Beklenen Ciro", tur: "sayi" },
      { anahtar: "kapanisTarihi", etiket: "Tahmini Kapanış", tur: "tarih" },
      { anahtar: "sorumluAd", etiket: "Sorumlu" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "kapanisSebebi", etiket: "Kayıp Sebebi" },
    ],
  },
  {
    deger: "teklifler",
    etiket: "Teklifler",
    izin: "teklif.goruntule",
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "no", etiket: "Teklif No" },
      { anahtar: "baslik", etiket: "Başlık" },
      { anahtar: "firmaAd", etiket: "Firma" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "araToplam", etiket: "Ara Toplam", tur: "sayi" },
      { anahtar: "indirimTutari", etiket: "İndirim", tur: "sayi" },
      { anahtar: "kdvTutari", etiket: "KDV", tur: "sayi" },
      { anahtar: "toplam", etiket: "Genel Toplam", tur: "sayi" },
      { anahtar: "paraBirimi", etiket: "Para Birimi" },
      { anahtar: "gecerlilikTarihi", etiket: "Geçerlilik", tur: "tarih" },
      { anahtar: "revizyonNo", etiket: "Revizyon", tur: "sayi" },
      { anahtar: "createdAt", etiket: "Oluşturma", tur: "tarih" },
    ],
  },
  {
    deger: "aktiviteler",
    etiket: "Aktiviteler",
    izin: "aktivite.goruntule",
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "tur", etiket: "Tür" },
      { anahtar: "baslik", etiket: "Başlık" },
      { anahtar: "firmaAd", etiket: "Firma" },
      { anahtar: "atananAd", etiket: "Atanan" },
      { anahtar: "sonTarih", etiket: "Son Tarih", tur: "tarih" },
      { anahtar: "tamamlandi", etiket: "Tamamlanma", tur: "tarih" },
      { anahtar: "aciklama", etiket: "Açıklama" },
      { anahtar: "createdAt", etiket: "Oluşturma", tur: "tarih" },
    ],
  },
  {
    deger: "yatirimlar",
    etiket: "Yatırım Destekleri",
    izin: "yatirim.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "firmaAd", etiket: "Firma", zorunlu: true },
      { anahtar: "baslik", etiket: "Başlık", zorunlu: true },
      { anahtar: "tur", etiket: "Tür" },
      { anahtar: "tutar", etiket: "Tutar", tur: "sayi" },
      { anahtar: "paraBirimi", etiket: "Para Birimi" },
      { anahtar: "tarih", etiket: "Tarih", tur: "tarih" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "aciklama", etiket: "Açıklama" },
    ],
  },
  {
    deger: "egitimler",
    etiket: "Eğitimler",
    izin: "egitim.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "firmaAd", etiket: "Firma", zorunlu: true },
      { anahtar: "baslik", etiket: "Başlık", zorunlu: true },
      { anahtar: "konu", etiket: "Konu" },
      { anahtar: "egitmen", etiket: "Eğitmen" },
      { anahtar: "tarih", etiket: "Tarih", tur: "tarih" },
      { anahtar: "sureSaat", etiket: "Süre (saat)", tur: "sayi" },
      { anahtar: "katilimci", etiket: "Katılımcı", tur: "sayi" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "notlar", etiket: "Notlar" },
    ],
  },
  {
    deger: "hizmetler",
    etiket: "Hizmetler",
    izin: "hizmet.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "firmaAd", etiket: "Firma", zorunlu: true },
      { anahtar: "baslik", etiket: "Başlık", zorunlu: true },
      { anahtar: "tur", etiket: "Tür" },
      { anahtar: "tarih", etiket: "Tarih", tur: "tarih" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "aciklama", etiket: "Açıklama" },
    ],
  },
];

export function veriKumesiBul(deger: string): VeriKumesi | undefined {
  return VERI_KUMELERI.find((v) => v.deger === deger);
}

export const ICE_AKTARILABILIR = VERI_KUMELERI.filter((v) => v.iceAktarilir);

export const BICIMLER = ["xlsx", "csv"] as const;
export type Bicim = (typeof BICIMLER)[number];
