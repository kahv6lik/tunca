/**
 * Menü bölümleri ve sekmeleri — v1.22.0 (saf).
 *
 * ORTAĞIN BULGUSU: sol menüde 25'e yakın öğe vardı; günlük işte kullanılan
 * beş ekranı bulmak için her seferinde uzun bir listeyi taramak gerekiyordu.
 *
 * ÇÖZÜM: menü BÖLÜMLERE indirildi. Sol menüde artık altı ana giriş var
 * (Genel Bakış, CRM, Satış Yönetimi, Takvim, Raporlar, SSS) ve bir Yönetim
 * bölümü. Bir bölüme tıklandığında ilk ekranı açılır; o bölümün bütün
 * ekranları sayfanın ÜSTÜNDE sekme çubuğu olarak durur.
 *
 * HİÇBİR ROTA DEĞİŞMEDİ. `/kisiler`, `/urunler`, `/destek`… hepsi aynı
 * adreste; değişen yalnızca oraya nasıl gidildiğidir. Kayıtlı görünümler,
 * bildirim bağlantıları, dışa aktarım adresleri ve yer imleri çalışmaya
 * devam eder — Faz 13'te "Kontaklar" etiketi değişirken rotanın korunması
 * da aynı gerekçeyleydi.
 *
 * `server-only` DEĞİLDİR: sol menü, sekme çubuğu ve testler aynı listeyi
 * okur. Yeni bir ekran eklemek = buraya bir satır eklemek.
 */

export type BolumSekmesi = {
  href: string;
  label: string;
  /** Gerekli izin; yoksa herkese açıktır. */
  izin?: string;
  /**
   * Sekmenin "etkin" sayılacağı ek rotalar (alt ekranlar). Örneğin paketler
   * ürünlerin bir alt görünümüdür ve kendi sekmesi yoktur.
   */
  esRotalar?: string[];
};

export type Bolum = {
  anahtar: string;
  etiket: string;
  /** Simge anahtarı — istemci tarafında eşlenir. */
  ikon: string;
  sekmeler: BolumSekmesi[];
};

export const BOLUMLER: Bolum[] = [
  {
    anahtar: "crm",
    etiket: "CRM",
    ikon: "crm",
    sekmeler: [
      // Firmalar ilk sekmedir: iş verisinin merkezi odur ve bölüme
      // tıklayan kullanıcı en çok onu arar.
      { href: "/firmalar", label: "Firmalar", izin: "firma.goruntule" },
      // Adaylar (/adaylar) kendi sekmesi DEĞİLDİR: satış hattının üçüncü
      // sekmesidir (Faz 13 / H5) ve oraya Fırsatlar içinden geçilir.
      { href: "/firsatlar", label: "Fırsatlar", izin: "firsat.goruntule", esRotalar: ["/adaylar"] },
      { href: "/kisiler", label: "Kontaklar", izin: "kisi.goruntule" },
      { href: "/aktiviteler", label: "Aktiviteler", izin: "aktivite.goruntule" },
      { href: "/projeler", label: "Projeler", izin: "proje.goruntule" },
      { href: "/destek", label: "Destek", izin: "destek.goruntule" },
      { href: "/ziyaretler", label: "Ziyaretler", izin: "ziyaret.goruntule" },
      { href: "/anketler", label: "Anketler", izin: "anket.goruntule" },
      { href: "/kampanyalar", label: "Kampanyalar", izin: "kampanya.goruntule" },
      { href: "/yatirim-destekleri", label: "Yatırım Destekleri", izin: "yatirim.goruntule" },
      { href: "/egitimler", label: "Eğitimler", izin: "egitim.goruntule" },
      { href: "/hizmetler", label: "Hizmetler", izin: "hizmet.goruntule" },
    ],
  },
  {
    anahtar: "satis",
    etiket: "Satış Yönetimi",
    ikon: "satis",
    sekmeler: [
      { href: "/teklifler", label: "Teklifler", izin: "teklif.goruntule" },
      { href: "/siparisler", label: "Siparişler", izin: "siparis.goruntule" },
      { href: "/sevkiyat", label: "Sevkiyat", izin: "sevkiyat.goruntule" },
      { href: "/stok", label: "Stok", izin: "stok.goruntule" },
      // Paketler ürünlerin alt görünümüdür; kendi sekmesi yoktur.
      { href: "/urunler", label: "Ürünler", izin: "urun.goruntule", esRotalar: ["/paketler"] },
    ],
  },
];

export function bolum(anahtar: string): Bolum | undefined {
  return BOLUMLER.find((b) => b.anahtar === anahtar);
}

/** Kullanıcının görebildiği sekmeler. */
export function gorunurSekmeler(b: Bolum, izinler: Set<string>): BolumSekmesi[] {
  return b.sekmeler.filter((s) => !s.izin || izinler.has(s.izin));
}

/**
 * Bölüme tıklanınca gidilecek adres — GÖREBİLDİĞİ ilk sekme.
 *
 * Sabit bir adres (ör. hep `/firmalar`) yazılsaydı, firma izni olmayan bir
 * kullanıcı bölüme tıklayınca `/yetkisiz`e düşerdi.
 */
export function bolumHedefi(b: Bolum, izinler: Set<string>): string | null {
  return gorunurSekmeler(b, izinler)[0]?.href ?? null;
}

/** Bir sekme bu yolda etkin mi? */
export function sekmeAktifMi(s: BolumSekmesi, pathname: string): boolean {
  return [s.href, ...(s.esRotalar ?? [])].some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

/**
 * Bu yol hangi bölüme ait?
 *
 * Sekme çubuğu bunu kullanır: bulunulan sayfa bir bölüme aitse o bölümün
 * çubuğu çizilir, değilse (Takvim, Raporlar, Yönetim ekranları) hiç
 * çizilmez — tek ekranlı bir bölümün sekme çubuğu gürültüdür.
 */
export function yolunBolumu(pathname: string): Bolum | undefined {
  return BOLUMLER.find((b) => b.sekmeler.some((s) => sekmeAktifMi(s, pathname)));
}
