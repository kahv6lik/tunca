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

/** `Date` → "2026-08-01" (yerel saat; `toISOString` UTC'ye kaydırırdı). */
function gunMetni(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export type HazirAralik = { anahtar: string; etiket: string; bas: string; bit: string };

/**
 * Hazır aralıklar — "bu ay / geçen ay / bu çeyrek / bu yıl".
 *
 * Rapora bakan kişinin dörtte üçü bu dört aralıktan birini istiyor; her
 * seferinde iki tarih seçtirmek gereksiz sürtünme. Özel aralık yine
 * kullanılabilir.
 */
export function hazirAraliklar(bugun = new Date()): HazirAralik[] {
  const y = bugun.getFullYear();
  const a = bugun.getMonth();
  const ceyrekBasi = Math.floor(a / 3) * 3;

  const aralik = (bas: Date, bit: Date, anahtar: string, etiket: string) => ({
    anahtar,
    etiket,
    bas: gunMetni(bas),
    bit: gunMetni(bit),
  });

  return [
    aralik(new Date(y, a, 1), new Date(y, a + 1, 0), "bu-ay", "Bu ay"),
    aralik(new Date(y, a - 1, 1), new Date(y, a, 0), "gecen-ay", "Geçen ay"),
    aralik(
      new Date(y, ceyrekBasi, 1),
      new Date(y, ceyrekBasi + 3, 0),
      "bu-ceyrek",
      "Bu çeyrek"
    ),
    aralik(new Date(y, 0, 1), new Date(y, 12, 0), "bu-yil", "Bu yıl"),
  ];
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
