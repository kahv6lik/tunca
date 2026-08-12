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
    /*
      AYARLAR (v1.26.0) — ortağın isteği: "YÖNETİM başlığının altına Ayarlar
      adında bir ana sekme eklememiz lazım; içe aktar, kullanıcılar, gruplar,
      otomasyon, AI özellikleri, yedekler bunun altına alt sekme olarak
      taşınmalı."

      Yönetim başlığı altında dokuz ayrı satır vardı ve hepsi "kurulum"
      işiydi; günlük işte kullanılan menüyü uzatmaktan başka bir şey
      yapmıyorlardı. Artık tek bir "Ayarlar" girişi var, hepsi onun sekmesi.

      DEFTERE İKİ EKRAN DAHA ALINDI (istekte adı geçmiyordu ama yerleri
      burasıydı):
        • Özel Alanlar — kiracıya özel alan TANIMI, bir kurulum işidir.
        • Satış Aşamaları — yalnızca Fırsatlar ekranından ulaşılabiliyordu;
          hattın tanımı da bir ayardır.

      DIŞARIDA BIRAKILANLAR bilinçlidir:
        • Denetim Günlüğü bir AYAR DEĞİL, bir kayıttır; değiştirilemez
          olması da bunun gereğidir. Yönetim'de kendi satırında kalır.
        • KVKK kişisel bir haktır (aydınlatma metni + kendi rızası), kuruluş
          ayarı değildir; üstelik herkese açıktır.

      HİÇBİR ROTA DEĞİŞMEDİ (v1.22.0'ın sözü): `/kullanicilar`, `/yedekler`,
      `/otomasyon/eposta`… hepsi aynı adreste.
    */
    anahtar: "ayarlar",
    etiket: "Ayarlar",
    ikon: "ayarlar",
    sekmeler: [
      { href: "/kullanicilar", label: "Kullanıcılar", izin: "kullanici.yonet" },
      { href: "/gruplar", label: "Gruplar", izin: "grup.yonet" },
      { href: "/ozel-alanlar", label: "Özel Alanlar", izin: "ozelalan.yonet" },
      { href: "/firsatlar/asamalar", label: "Satış Aşamaları", izin: "firsat.asama" },
      { href: "/otomasyon", label: "Otomasyon", izin: "otomasyon.goruntule" },
      // E-posta ayarı Otomasyon ekranının içinden ÇIKARILDI: SMTP/IMAP
      // kurulumu iş akışı kurallarının bir alt ayrıntısı değil, kendi
      // başına bir sistem ayarıdır.
      { href: "/otomasyon/eposta", label: "E-posta", izin: "otomasyon.eposta" },
      { href: "/ai", label: "AI Özellikleri", izin: "ai.kullan" },
      { href: "/yedekler", label: "Yedekler", izin: "yedek.yonet" },
      { href: "/ice-aktar", label: "İçe Aktar", izin: "firma.olustur" },
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
  return sekmeSkoru(s, pathname) > 0;
}

/**
 * Eşleşmenin NE KADAR ÖZEL olduğu — eşleşme yoksa 0.
 *
 * EN ÖZEL EŞLEŞME KAZANIR (v1.26.0). İç içe rotalar aynı anda iki sekmeye
 * uyabilir: `/otomasyon/eposta` hem "Otomasyon" (`/otomasyon`) hem
 * "E-posta" (`/otomasyon/eposta`) sekmesine uyar; `/firsatlar/asamalar` hem
 * CRM'in "Fırsatlar"ına hem Ayarlar'ın "Satış Aşamaları"na. Kural olmadan
 * ikisi birden etkin görünür (ya da yanlış bölümün çubuğu çizilir).
 *
 * Uzunluk doğru ölçüdür: daha uzun eşleşen yol, daha dar bir ekrandır.
 */
export function sekmeSkoru(s: BolumSekmesi, pathname: string): number {
  const uyanlar = [s.href, ...(s.esRotalar ?? [])].filter(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
  return uyanlar.reduce((en, r) => Math.max(en, r.length), 0);
}

/** Bölümde bu yola EN ÖZEL uyan sekme. */
export function etkinSekme(
  b: Bolum,
  pathname: string
): BolumSekmesi | undefined {
  let enIyi: { s: BolumSekmesi; skor: number } | undefined;
  for (const s of b.sekmeler) {
    const skor = sekmeSkoru(s, pathname);
    if (skor > 0 && (!enIyi || skor > enIyi.skor)) enIyi = { s, skor };
  }
  return enIyi?.s;
}

/**
 * Bu yol hangi bölüme ait?
 *
 * Sekme çubuğu bunu kullanır: bulunulan sayfa bir bölüme aitse o bölümün
 * çubuğu çizilir, değilse (Takvim, Raporlar, Yönetim ekranları) hiç
 * çizilmez — tek ekranlı bir bölümün sekme çubuğu gürültüdür.
 */
export function yolunBolumu(pathname: string): Bolum | undefined {
  // En özel eşleşme kazanır: `/firsatlar/asamalar` CRM'in "Fırsatlar"ına da
  // uyar ama Ayarlar'ın "Satış Aşamaları"na TAM uyar — sekme çubuğu
  // Ayarlar'ınki olmalıdır.
  let enIyi: { b: Bolum; skor: number } | undefined;
  for (const b of BOLUMLER) {
    for (const s of b.sekmeler) {
      const skor = sekmeSkoru(s, pathname);
      if (skor > 0 && (!enIyi || skor > enIyi.skor)) enIyi = { b, skor };
    }
  }
  return enIyi?.b;
}
