/**
 * Kayıtlı görünüm TANIMLARI — Faz 10 / E4 (saf katman).
 *
 * `server-only` değildir: sorgu temizleme kuralı güvenlikle ilgilidir ve
 * testler onu doğrudan sınamalıdır.
 */

export const GORUNUM_LISTELERI = [
  "firmalar",
  "kisiler",
  "firsatlar",
  "adaylar",
  "teklifler",
] as const;

export type GorunumListesi = (typeof GORUNUM_LISTELERI)[number];

export type GorunumOgesi = {
  id: string;
  ad: string;
  sorgu: string;
  paylasilan: boolean;
  varsayilan: boolean;
  benim: boolean;
  sahibi: string | null;
};

/**
 * Sorguyu temizler: yalnızca bilinen biçimde anahtarlar, `g` (görünüm
 * işareti) ve `sayfa` atılır, uzunluk sınırlanır. İstemciden gelen değere
 * güvenilmez — görünüm URL üretir ve URL'e ne yazıldığı denetlenmelidir.
 */
export function sorguTemizle(ham: string): string {
  const girdi = new URLSearchParams(ham);
  const cikti = new URLSearchParams();

  for (const [anahtar, deger] of girdi.entries()) {
    // Düz filtre anahtarları ("ara", "durum"…) ve özel alan filtreleri
    // ("oa_<alanId>", Faz 11). Başka biçim yok — "__proto__" dahil düşer.
    if (!/^[a-zA-Z]{1,30}$/.test(anahtar) && !/^oa_[a-z0-9]{1,32}$/.test(anahtar)) continue;
    if (anahtar === "g" || anahtar === "sayfa") continue;
    if (!deger || deger.length > 200) continue;
    cikti.set(anahtar, deger);
  }

  return cikti.toString().slice(0, 1000);
}

