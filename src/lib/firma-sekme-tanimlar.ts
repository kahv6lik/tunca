/**
 * Firma çalışma ekranının sekmeleri — Faz 20 / U3 (saf).
 *
 * Ortağın bulgusu: "bir müşterinin her şeyini görmek için altı ayrı ekrana
 * girip her birinde firmayı yeniden süzmek gerekiyor." Çalışma ekranı bunun
 * yanıtıdır: firma SABİTTİR, sekmeler modüller arasında gezinir.
 *
 * Sekme adresi querystring'de yaşar (`?sekme=satis`) — bağlantı
 * paylaşılabilir, yenilenince aynı sekme açılır.
 *
 * SEKME BİR SORGU KAPISIDIR: seçilmeyen sekmenin sorgusu HİÇ çalışmaz.
 * Eski tek parça sayfa, kullanıcı yalnızca kontaklara bakacakken bütün
 * modülleri sorguluyordu.
 *
 * `server-only` DEĞİLDİR: sayfa, sekme çubuğu ve testler aynı listeyi okur.
 */

export type FirmaSekmesi = {
  anahtar: string;
  etiket: string;
  /**
   * Sekmenin görünmesi için gereken izinlerden EN AZ BİRİ. Boş dizi
   * "herkese açık" demektir (Genel sekmesi: firma görüntüleme izni zaten
   * sayfanın kapısında istenir).
   */
  izinler: string[];
};

export const FIRMA_SEKMELERI: FirmaSekmesi[] = [
  { anahtar: "genel", etiket: "Genel", izinler: [] },
  {
    anahtar: "satis",
    etiket: "Satış",
    izinler: ["firsat.goruntule", "teklif.goruntule", "siparis.goruntule"],
  },
  { anahtar: "kontak", etiket: "Kontaklar", izinler: ["kisi.goruntule"] },
  {
    anahtar: "destek",
    etiket: "Proje & Destek",
    izinler: ["proje.goruntule", "destek.goruntule"],
  },
  {
    anahtar: "kayit",
    etiket: "Destek/Eğitim/Hizmet",
    izinler: ["yatirim.goruntule", "egitim.goruntule", "hizmet.goruntule"],
  },
  {
    anahtar: "belge",
    etiket: "Belge & Saha",
    izinler: ["dosya.goruntule", "ziyaret.goruntule"],
  },
];

/** Varsayılan sekme — adres parametresi yoksa ya da geçersizse. */
export const VARSAYILAN_SEKME = "genel";

/** Kullanıcının izinlerine göre görünecek sekmeler. */
export function gorunurSekmeler(izinler: Set<string>): FirmaSekmesi[] {
  return FIRMA_SEKMELERI.filter(
    (s) => s.izinler.length === 0 || s.izinler.some((i) => izinler.has(i))
  );
}

/**
 * İstenen sekmeyi doğrular.
 *
 * Uydurma ya da izinsiz bir değer sessizce "genel"e düşer: hata sayfası
 * göstermek, eski bir yer imini açan kullanıcıyı gereksiz yere korkutur.
 */
export function sekmeSec(istenen: string | undefined, izinler: Set<string>): string {
  const gorunur = gorunurSekmeler(izinler);
  return gorunur.some((s) => s.anahtar === istenen)
    ? (istenen as string)
    : VARSAYILAN_SEKME;
}
