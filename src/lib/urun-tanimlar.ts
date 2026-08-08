/**
 * Katalog yardımcıları — saf (Faz 14).
 *
 * `server-only` DEĞİL: hem action'lar hem testler hem de istemci tarafındaki
 * form önizlemesi kullanır.
 */

/**
 * Ürün/paket/kampanya kodunu tekilleştirilebilir bir biçime çeker.
 *
 * Kod bir KİMLİKTİR: "urn-01", "URN-01" ve " urn-01 " aynı ürünü anlatır.
 * Normalize edilmezse kullanıcı aynı ürünü iki kez açar ve stok ikiye
 * bölünür. Türkçe büyütme bilinçli olarak KULLANILMAZ — "i" harfi "İ"ye
 * dönüşünce kod ASCII olmaktan çıkar ve dış sistemlerle (barkod, ERP)
 * eşleşmesi bozulur.
 */
export function kodNormalize(kod: string): string {
  return kod.trim().toUpperCase().replace(/\s+/g, "-");
}

/** KDV dahil fiyat — listelerde göstermek için. */
export function kdvDahil(fiyat: number, kdvOrani: number): number {
  return Math.round(fiyat * (1 + kdvOrani / 100) * 100) / 100;
}

/**
 * Stok durumu etiketi.
 *
 * `kritikStok = 0` "uyarma" demektir: her ürün için eşik belirlemek zorunda
 * kalmak, katalogu ilk kez dolduran kullanıcıyı gereksiz yere yavaşlatırdı.
 */
export type StokDurumu = "yok" | "kritik" | "yeterli" | "takipsiz";

export function stokDurumu(urun: {
  stokTakibi: boolean;
  stokMiktar: number;
  kritikStok: number;
}): StokDurumu {
  if (!urun.stokTakibi) return "takipsiz";
  if (urun.stokMiktar <= 0) return "yok";
  if (urun.kritikStok > 0 && urun.stokMiktar <= urun.kritikStok) return "kritik";
  return "yeterli";
}

export const STOK_DURUM_ETIKET: Record<StokDurumu, { label: string; className: string }> = {
  yok: { label: "Stok yok", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  kritik: { label: "Kritik", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  yeterli: { label: "Yeterli", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  takipsiz: { label: "Takip yok", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
};
