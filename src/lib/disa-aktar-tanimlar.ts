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
  /**
   * Yalnızca dışa aktarılır; içe aktarım ekranında hiç görünmez (Faz 13 / H1).
   * Sistemin verdiği değerler içindir — firma numarası gibi. Dosyadan
   * okunabilseydi kullanıcı iki firmaya aynı numarayı verebilir ve numaranın
   * "tekil, değiştirilemez kimlik" sözü bozulurdu.
   */
  saltDisa?: boolean;
  tur?: "metin" | "sayi" | "tarih" | "durum";
};

/** İçe aktarımda kullanılabilecek sütunlar — `saltDisa` olanlar elenir. */
export function iceSutunlar(kume: VeriKumesi): Sutun[] {
  return kume.sutunlar.filter((s) => !s.saltDisa);
}

export const VERI_KUMELERI: VeriKumesi[] = [
  {
    deger: "firmalar",
    etiket: "Firmalar",
    izin: "firma.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "firmaNo", etiket: "Firma No", saltDisa: true },
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
      { anahtar: "departman", etiket: "Departman" },
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
  // ── Ticari çekirdek (Faz 14) ──
  {
    deger: "urunler",
    etiket: "Ürünler",
    izin: "urun.goruntule",
    iceAktarilir: true,
    sutunlar: [
      { anahtar: "kod", etiket: "Ürün Kodu", zorunlu: true },
      { anahtar: "ad", etiket: "Ürün Adı", zorunlu: true },
      { anahtar: "kategori", etiket: "Kategori" },
      { anahtar: "birim", etiket: "Birim" },
      { anahtar: "listeFiyat", etiket: "Liste Fiyatı", tur: "sayi" },
      { anahtar: "paraBirimi", etiket: "Para Birimi" },
      { anahtar: "kdvOrani", etiket: "KDV Oranı", tur: "sayi" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      // Stok bakiyesi hareket defterinden gelir; dosyadan yazılamaz (T7).
      { anahtar: "stokMiktar", etiket: "Stok Miktarı", saltDisa: true, tur: "sayi" },
      { anahtar: "aciklama", etiket: "Açıklama" },
    ],
  },
  {
    deger: "kampanyalar",
    etiket: "Kampanyalar",
    izin: "kampanya.goruntule",
    // Kampanya içe aktarıma KAPALI: tip + kapsam + kota birlikte anlamlıdır
    // ve düz bir tabloda doğrulanamaz (fırsat/teklif ile aynı gerekçe).
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "kod", etiket: "Kod" },
      { anahtar: "ad", etiket: "Kampanya" },
      { anahtar: "tip", etiket: "Tip" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "baslangic", etiket: "Başlangıç", tur: "tarih" },
      { anahtar: "bitis", etiket: "Bitiş", tur: "tarih" },
      { anahtar: "deger", etiket: "Değer", tur: "sayi" },
      { anahtar: "kota", etiket: "Kota", tur: "sayi" },
      { anahtar: "kullanilan", etiket: "Kullanılan", tur: "sayi" },
    ],
  },
  {
    deger: "stokHareketleri",
    etiket: "Stok Hareketleri",
    izin: "stok.goruntule",
    // Defter DEĞİŞTİRİLEMEZ; dosyadan hareket yazmak onu anlamsız kılardı.
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "createdAt", etiket: "Tarih", tur: "tarih" },
      { anahtar: "urunKod", etiket: "Ürün Kodu" },
      { anahtar: "urunAd", etiket: "Ürün" },
      { anahtar: "tur", etiket: "Hareket Türü" },
      { anahtar: "miktar", etiket: "Miktar", tur: "sayi" },
      { anahtar: "sonrakiBakiye", etiket: "Sonraki Bakiye", tur: "sayi" },
      { anahtar: "referans", etiket: "Referans" },
      { anahtar: "aciklama", etiket: "Açıklama" },
    ],
  },
  // ── Sipariş ve sevkiyat (Faz 15) ──
  {
    deger: "siparisler",
    etiket: "Siparişler",
    izin: "siparis.goruntule",
    // Sipariş içe aktarıma KAPALI: onay akışı, stok ve kota düşümü bir
    // tablodan yeniden kurulamaz (teklif/fırsat ile aynı gerekçe).
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "no", etiket: "Sipariş No" },
      { anahtar: "firmaAd", etiket: "Firma" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "araToplam", etiket: "Ara Toplam", tur: "sayi" },
      { anahtar: "indirimTutari", etiket: "İndirim", tur: "sayi" },
      { anahtar: "kdvTutari", etiket: "KDV", tur: "sayi" },
      { anahtar: "toplam", etiket: "Genel Toplam", tur: "sayi" },
      { anahtar: "paraBirimi", etiket: "Para Birimi" },
      { anahtar: "olusturanAd", etiket: "Oluşturan" },
      { anahtar: "onaylayanAd", etiket: "Onaylayan" },
      { anahtar: "onayTarihi", etiket: "Onay Tarihi", tur: "tarih" },
      { anahtar: "redSebebi", etiket: "Ret Gerekçesi" },
      { anahtar: "createdAt", etiket: "Oluşturma", tur: "tarih" },
    ],
  },
  {
    deger: "sevkiyatlar",
    etiket: "Sevkiyatlar",
    izin: "sevkiyat.goruntule",
    iceAktarilir: false,
    sutunlar: [
      { anahtar: "no", etiket: "Sevkiyat No" },
      { anahtar: "siparisNo", etiket: "Sipariş No" },
      { anahtar: "firmaAd", etiket: "Firma" },
      { anahtar: "durum", etiket: "Durum", tur: "durum" },
      { anahtar: "tasiyici", etiket: "Taşıyıcı" },
      { anahtar: "takipNo", etiket: "Takip No" },
      { anahtar: "sevkTarihi", etiket: "Sevk Tarihi", tur: "tarih" },
      { anahtar: "teslimTarihi", etiket: "Teslim Tarihi", tur: "tarih" },
      { anahtar: "createdAt", etiket: "Oluşturma", tur: "tarih" },
    ],
  },
];

export function veriKumesiBul(deger: string): VeriKumesi | undefined {
  return VERI_KUMELERI.find((v) => v.deger === deger);
}

export const ICE_AKTARILABILIR = VERI_KUMELERI.filter((v) => v.iceAktarilir);

export const BICIMLER = ["xlsx", "csv"] as const;
export type Bicim = (typeof BICIMLER)[number];
