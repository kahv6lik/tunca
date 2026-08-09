/**
 * Genel arama ve hızlı eylem tanımları — Faz 20 / U1 (saf).
 *
 * `server-only` DEĞİLDİR: arama ucu, komut paleti ve testler aynı listeyi
 * okur. Hangi modülün aranabildiği ve hangi izne bağlı olduğu TEK YERDE
 * durur — yeni bir modül eklemek buraya satır eklemektir.
 */

export type AramaTuru = {
  tur: string;
  etiket: string;
  izin: string;
  /** Sonuç tıklanınca gidilecek adresin öneki. */
  rota: string;
  /** Simge anahtarı — istemci tarafında eşlenir (sunucudan fonksiyon geçemez). */
  ikon: string;
};

export const ARAMA_TURLERI: AramaTuru[] = [
  { tur: "firma", etiket: "Firma", izin: "firma.goruntule", rota: "/firmalar", ikon: "firma" },
  { tur: "kisi", etiket: "Kontak", izin: "kisi.goruntule", rota: "/kisiler", ikon: "kisi" },
  { tur: "firsat", etiket: "Fırsat", izin: "firsat.goruntule", rota: "/firsatlar", ikon: "firsat" },
  { tur: "teklif", etiket: "Teklif", izin: "teklif.goruntule", rota: "/teklifler", ikon: "teklif" },
  { tur: "siparis", etiket: "Sipariş", izin: "siparis.goruntule", rota: "/siparisler", ikon: "siparis" },
  { tur: "proje", etiket: "Proje", izin: "proje.goruntule", rota: "/projeler", ikon: "proje" },
  { tur: "destek", etiket: "Destek", izin: "destek.goruntule", rota: "/destek", ikon: "destek" },
];

export function aramaTuru(tur: string): AramaTuru | undefined {
  return ARAMA_TURLERI.find((t) => t.tur === tur);
}

export type AramaSonucu = {
  tur: string;
  id: string;
  baslik: string;
  /** İkinci satır: firma adı, tutar, durum gibi ayırt edici bilgi. */
  alt: string | null;
  /** Yan panelde açılabilir mi? (U2) */
  panel: boolean;
};

/**
 * Hızlı eylemler — komut paletinden doğrudan yeni kayıt açma.
 *
 * Arama sonucu YOKKEN de gösterilirler: palet yalnızca bir arama kutusu
 * değil, "ne yapmak istiyorum" sorusunun yanıtıdır.
 */
export type HizliEylem = {
  anahtar: string;
  etiket: string;
  izin: string;
  rota: string;
};

export const HIZLI_EYLEMLER: HizliEylem[] = [
  { anahtar: "firma-yeni", etiket: "Yeni firma", izin: "firma.olustur", rota: "/firmalar/yeni" },
  { anahtar: "teklif-yeni", etiket: "Yeni teklif", izin: "teklif.olustur", rota: "/teklifler/yeni" },
  { anahtar: "siparis-yeni", etiket: "Yeni sipariş", izin: "siparis.olustur", rota: "/siparisler/yeni" },
  { anahtar: "firsat", etiket: "Satış hattı (kanban)", izin: "firsat.goruntule", rota: "/firsatlar" },
  { anahtar: "destek", etiket: "Destek kuyruğu", izin: "destek.goruntule", rota: "/destek" },
  { anahtar: "raporlar", etiket: "Rapor merkezi", izin: "rapor.goruntule", rota: "/raporlar" },
];

/**
 * Yan panel özeti — Faz 20 / U2.
 *
 * Panel türden bağımsızdır: sunucu ne gönderirse onu çizer. Böylece yeni bir
 * tür eklemek arayüzü değil yalnızca `/api/ozet` ucunu ilgilendirir.
 */
export type OzetSatiri = { etiket: string; deger: string };

export type OzetYanit = {
  tur: string;
  id: string;
  baslik: string;
  /** Rozet olarak çizilecek durum anahtarı — yoksa `null`. */
  durum: string | null;
  /** "Tam sayfada aç" bağlantısı. */
  rota: string;
  satirlar: OzetSatiri[];
};

/**
 * Yan panel adresi querystring'de yaşar: `?panel=firma:<id>`.
 *
 * Neden URL: panel açıkken sayfa yenilenebilir, bağlantı paylaşılabilir ve
 * tarayıcının geri tuşu paneli kapatır. Bileşenden bileşene "açık mı"
 * durumu taşımak bu üçünü de kaybettirirdi.
 */
export const PANEL_ANAHTARI = "panel";

export function panelDegeri(tur: string, id: string): string {
  return `${tur}:${id}`;
}

export function panelCoz(deger: string | null | undefined): {
  tur: string;
  id: string;
} | null {
  if (!deger) return null;
  const ayirac = deger.indexOf(":");
  if (ayirac <= 0) return null;
  const tur = deger.slice(0, ayirac);
  const id = deger.slice(ayirac + 1);
  if (!id || !aramaTuru(tur)) return null;
  return { tur, id };
}

/** Arama teriminin anlamlı olması için gereken en az uzunluk. */
export const EN_AZ_TERIM = 2;

/** Tür başına en fazla sonuç — palet listesi okunabilir kalmalı. */
export const TUR_BASINA_SONUC = 5;

/**
 * Eylemleri terime göre süzer.
 *
 * Terim boşken HEPSİ döner (palet açılır açılmaz ne yapılabileceği görünsün);
 * terim varsa Türkçe duyarsız eşleşme aranır.
 */
export function eylemleriSuz(
  eylemler: HizliEylem[],
  terim: string
): HizliEylem[] {
  const t = terim.trim().toLocaleLowerCase("tr");
  if (!t) return eylemler;
  return eylemler.filter((e) => e.etiket.toLocaleLowerCase("tr").includes(t));
}
