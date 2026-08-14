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

/**
 * Bir paketten stokla kaç adet çıkabileceğini hesaplar — SAF (v1.27.3).
 *
 * ORTAĞIN İSTEĞİ: "Ziyarete başladığımızda paket tanımı görünüyor ama kalan
 * paket stok durumu görünmüyor." Sahada "bu paketten kaç tane verebilirim?"
 * sorusunun yanıtı, paketin fiyatı kadar gereklidir.
 *
 * Kapasite EN DAR KALEME bağlıdır: pakette 2 adet geçen bir üründen elde 5
 * varsa o üründen yalnızca 2 paket çıkar. Stok takibi OLMAYAN ürün kısıt
 * getirmez (hizmet, lisans gibi kalemler tükenmez).
 *
 * Hiçbir kalem stok takipli değilse `null` döner: "sınırsız" demek yanlış
 * olurdu, doğru olan "bu paket stoktan sınırlanmıyor" demektir ve bunu
 * çağıran taraf kendi diliyle söyler.
 */
export function paketStokKapasitesi(
  kalemler: {
    miktar: number;
    urun: { ad: string; stokTakibi: boolean; stokMiktar: number; birim: string };
  }[]
): {
  yapilabilir: number | null;
  /** Kapasiteyi belirleyen kalem — "neden bu kadar?" sorusunun yanıtı. */
  darBogaz: { ad: string; stok: number; birim: string } | null;
} {
  const takipliler = kalemler.filter((k) => k.urun.stokTakibi && k.miktar > 0);
  if (takipliler.length === 0) return { yapilabilir: null, darBogaz: null };

  let enAz = Infinity;
  let darBogaz: { ad: string; stok: number; birim: string } | null = null;

  for (const k of takipliler) {
    const adet = Math.floor(k.urun.stokMiktar / k.miktar);
    if (adet < enAz) {
      enAz = adet;
      darBogaz = {
        ad: k.urun.ad,
        stok: k.urun.stokMiktar,
        birim: k.urun.birim,
      };
    }
  }

  return { yapilabilir: Math.max(enAz, 0), darBogaz };
}
