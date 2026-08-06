/**
 * Genel Bakış kart TANIMLARI — Faz 10 / E3.
 *
 * `yetki-tanimlar.ts` ile aynı gerekçe: `server-only` değildir; sunucudaki
 * sayfa, istemcideki düzenleme paneli ve testler aynı listeyi kullanır.
 *
 * Her kartın bir İZNİ vardır: kullanıcı tercih etse bile izni olmayan kart
 * çizilmez ve SORGUSU HİÇ ÇALIŞTIRILMAZ (Faz 4'ten beri geçerli kural).
 * Paket kısıtı `etkinIzinler()` içinde uygulandığı için kapalı modülün kartı
 * da kendiliğinden düşer.
 */

export type PanoKarti = {
  anahtar: string;
  etiket: string;
  aciklama: string;
  /** Yerleşim grubu: kpi (üst şerit) | grafik | liste. */
  tur: "kpi" | "grafik" | "liste";
  izin: string;
  /** Varsayılan düzende var mı? (yoksa kullanıcı isterse açar) */
  varsayilan: boolean;
};

export const PANO_KARTLARI: PanoKarti[] = [
  {
    anahtar: "kpi-firma",
    etiket: "Toplam Firma",
    aciklama: "Firma sayısı ve aktif firma özeti",
    tur: "kpi",
    izin: "firma.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "kpi-yatirim",
    etiket: "Onaylı Yatırım",
    aciklama: "Onaylanan + tamamlanan yatırım toplamı (TRY)",
    tur: "kpi",
    izin: "yatirim.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "kpi-egitim",
    etiket: "Eğitim",
    aciklama: "Toplam eğitim kaydı",
    tur: "kpi",
    izin: "egitim.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "kpi-hizmet",
    etiket: "Hizmet",
    aciklama: "Toplam hizmet kaydı",
    tur: "kpi",
    izin: "hizmet.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "kpi-firsat",
    etiket: "Açık Fırsatlar",
    aciklama: "Açık fırsat sayısı ve beklenen ciro",
    tur: "kpi",
    izin: "firsat.goruntule",
    varsayilan: false, // Faz 10'da eklendi; mevcut kullanıcıların düzeni değişmesin
  },
  {
    anahtar: "kpi-gorev",
    etiket: "Açık Görevlerim",
    aciklama: "Bana atanmış tamamlanmamış görevler",
    tur: "kpi",
    izin: "aktivite.goruntule",
    varsayilan: false,
  },
  {
    anahtar: "grafik-yatirim-trend",
    etiket: "Aylık Yatırım Trendi",
    aciklama: "Son 12 ayın yatırım toplamları",
    tur: "grafik",
    izin: "yatirim.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "grafik-yatirim-durum",
    etiket: "Yatırım Durumları",
    aciklama: "Başvuruldu / onaylandı / reddedildi dağılımı",
    tur: "grafik",
    izin: "yatirim.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "liste-son-firmalar",
    etiket: "Son Eklenen Firmalar",
    aciklama: "En yeni 6 firma",
    tur: "liste",
    izin: "firma.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "liste-yaklasan-egitimler",
    etiket: "Yaklaşan Eğitimler",
    aciklama: "Planlanmış en yakın 6 eğitim",
    tur: "liste",
    izin: "egitim.goruntule",
    varsayilan: true,
  },
  {
    anahtar: "liste-bugun-gorevler",
    etiket: "Bugünkü Görevlerim",
    aciklama: "Vadesi gelmiş açık görevlerim",
    tur: "liste",
    izin: "aktivite.goruntule",
    varsayilan: false,
  },
];

export const PANO_VARSAYILAN = PANO_KARTLARI.filter((k) => k.varsayilan).map(
  (k) => k.anahtar
);

export function panoKartiBul(anahtar: string): PanoKarti | undefined {
  return PANO_KARTLARI.find((k) => k.anahtar === anahtar);
}

/**
 * Kullanıcının etkin kart listesi.
 *
 * Tercih (varsa) esas alınır; bilinmeyen anahtarlar ayıklanır (eski bir
 * tercihte kaldırılmış bir kart kalmış olabilir) ve izinsiz kartlar düşer.
 */
export function etkinKartlar(
  tercih: string[] | null,
  izinler: Set<string>
): string[] {
  const secim = tercih && tercih.length > 0 ? tercih : PANO_VARSAYILAN;
  return secim.filter((anahtar) => {
    const kart = panoKartiBul(anahtar);
    return kart !== undefined && izinler.has(kart.izin);
  });
}
