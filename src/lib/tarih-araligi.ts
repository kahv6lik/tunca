/**
 * Tarih aralığı süzgeci — Faz 13 / H9.
 *
 * Ortağın bulgusu: "raporlara tarih aralığı eklensin". Rapor ekranı bütün
 * zamanları topluyordu; "bu çeyrek ne yaptık" sorusu yanıtsız kalıyordu.
 *
 * Saf tutulur (`server-only` DEĞİL): hem sayfa hem testler kullanır.
 *
 * İKİ İNCE NOKTA:
 *   1. Bitiş tarihi GÜN SONUNA çekilir. "2026-08-31" yazan kullanıcı o günü
 *      DAHİL etmek ister; ham hâliyle karşılaştırma gece yarısına denk gelir
 *      ve son günün kayıtları rapordan düşerdi.
 *   2. Aralık ters verilirse (başlangıç > bitiş) süzgeç UYGULANMAZ. Boş bir
 *      rapor, kullanıcıya "veri yok" der; oysa sorun yazım hatasıdır.
 */

export type TarihAraligi = { gte?: Date; lte?: Date };

/** "2026-08-01" biçimini Date'e çevirir; geçersizse `null`. */
function tariheCevir(metin?: string | null): Date | null {
  if (!metin || !/^\d{4}-\d{2}-\d{2}$/.test(metin.trim())) return null;
  const d = new Date(`${metin.trim()}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Prisma'nın `where` süzgecine konacak aralığı üretir.
 * Hiçbir sınır yoksa `undefined` döner — çağıran onu koşula hiç eklemez.
 */
export function tarihAraligi(
  bas?: string | null,
  bit?: string | null
): TarihAraligi | undefined {
  const baslangic = tariheCevir(bas);
  const bitisGunu = tariheCevir(bit);

  const bitis = bitisGunu
    ? new Date(
        bitisGunu.getFullYear(),
        bitisGunu.getMonth(),
        bitisGunu.getDate(),
        23,
        59,
        59,
        999
      )
    : null;

  if (baslangic && bitis && baslangic > bitis) return undefined;
  if (!baslangic && !bitis) return undefined;

  return {
    ...(baslangic ? { gte: baslangic } : {}),
    ...(bitis ? { lte: bitis } : {}),
  };
}

/** Süzgecin ekranda gösterilecek özeti ("1 Ağu 2026 – 31 Ağu 2026"). */
export function araliktanEtiket(aralik?: TarihAraligi): string | null {
  if (!aralik) return null;
  const bicim = (d: Date) =>
    new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(d);

  if (aralik.gte && aralik.lte) return `${bicim(aralik.gte)} – ${bicim(aralik.lte)}`;
  if (aralik.gte) return `${bicim(aralik.gte)} sonrası`;
  return `${bicim(aralik.lte!)} öncesi`;
}
