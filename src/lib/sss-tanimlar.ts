/**
 * SSS (bilgi bankası) yardımcıları — saf (Faz 16 / P4).
 *
 * `server-only` DEĞİLDİR: action, ekran ve testler aynı mantığı paylaşır.
 */

/**
 * Serbest metin etiket girdisini listeye çevirir.
 *
 * Etiketler KÜÇÜK HARFE indirilir (Türkçe kurallarıyla) ve tekilleştirilir:
 * "Fatura", "fatura" ve "FATURA" tek etikettir. Aksi halde etiket süzgeci
 * aynı konuyu üç ayrı kutuya bölerdi.
 */
export function etiketleriAyristir(metin?: string | null): string[] {
  if (!metin) return [];
  const gorulen = new Set<string>();
  for (const parca of metin.split(/[,;\n]/)) {
    const e = parca.trim().toLocaleLowerCase("tr");
    if (e) gorulen.add(e);
  }
  return [...gorulen];
}

/** Etiket listesini forma geri yazılabilir metne çevirir. */
export function etiketMetni(etiketler: string[]): string {
  return etiketler.join(", ");
}

/**
 * Kategori listesini kayıtlardan çıkarır.
 *
 * Kategori ayrı bir tablo DEĞİLDİR: SSS sayısı onlarla ölçülür ve kategori
 * yönetimi için ikinci bir ekran açmak, kazandırdığından fazlasını götürürdü.
 */
export function kategorileriTopla(
  kayitlar: { kategori: string | null }[]
): string[] {
  const kume = new Set<string>();
  for (const k of kayitlar) if (k.kategori) kume.add(k.kategori);
  return [...kume].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Tüm etiketleri kullanım sayısıyla birlikte döndürür (çoktan aza). */
export function etiketleriTopla(
  kayitlar: { etiketler: string[] }[]
): { etiket: string; adet: number }[] {
  const sayac = new Map<string, number>();
  for (const k of kayitlar) {
    for (const e of k.etiketler) sayac.set(e, (sayac.get(e) ?? 0) + 1);
  }
  return [...sayac]
    .map(([etiket, adet]) => ({ etiket, adet }))
    .sort((a, b) => b.adet - a.adet || a.etiket.localeCompare(b.etiket, "tr"));
}
