/**
 * Takvim kategorileri — saf tanımlar (Faz 8 / D4 + Faz 13 / H8).
 *
 * `takvim.ts` `server-only`'dir; bu dosya değildir. Kategori süzgecinin
 * ayrıştırılması hem sunucuda (sayfa, .ics uç noktası) hem testlerde
 * kullanılır.
 */

export const TAKVIM_TURLERI = [
  "gorev",
  "firsat",
  "teklif",
  "egitim",
  "hizmet",
] as const;

export type TakvimTuru = (typeof TAKVIM_TURLERI)[number];

export const TUR_ETIKET: Record<TakvimTuru, string> = {
  gorev: "Görev",
  firsat: "Fırsat",
  teklif: "Teklif",
  egitim: "Eğitim",
  hizmet: "Hizmet",
};

/** Her kategorinin görünmesi için gereken izin. */
export const TUR_IZIN: Record<TakvimTuru, string> = {
  gorev: "aktivite.goruntule",
  firsat: "firsat.goruntule",
  teklif: "teklif.goruntule",
  egitim: "egitim.goruntule",
  hizmet: "hizmet.goruntule",
};

/**
 * `?tur=gorev,firsat` parametresini çözer.
 *
 * BOŞ ya da geçersiz değer "hepsi" demektir — süzgeç bir kısıtlama aracıdır,
 * yanlış yazılmış bir parametre takvimi boşaltmamalıdır. Tanınmayan
 * kategoriler sessizce atılır.
 */
export function turleriCoz(param?: string | null): Set<TakvimTuru> {
  const secilen = (param ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is TakvimTuru => TAKVIM_TURLERI.includes(p as TakvimTuru));

  return new Set(secilen.length > 0 ? secilen : TAKVIM_TURLERI);
}

/** Süzgeç etkin mi? (hepsi seçiliyse etkin sayılmaz) */
export function turSuzgeciEtkin(param?: string | null): boolean {
  return turleriCoz(param).size < TAKVIM_TURLERI.length;
}
