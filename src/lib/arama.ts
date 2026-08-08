/**
 * Liste aramalarının ortak kuralı — Faz 13 / H2.
 *
 * Ortağın bulgusu: "filtreler büyük/küçük harfe duyarlı, aradığımı
 * bulamıyorum."
 *
 * İKİ AYRI SORUN VARDI:
 *
 *   1. Bazı sorgular `mode: "insensitive"` olmadan yazılmıştı; PostgreSQL'de
 *      `contains` varsayılan olarak harfe DUYARLIDIR. Bu, alan alan
 *      düzeltildi.
 *
 *   2. `insensitive` (ILIKE) Türkçenin İ/ı çiftini bilmez. Veritabanı
 *      eşlemesi ASCII'dir: `lower('I') = 'i'`, `upper('ı') = 'ı'`. Yani
 *      "ısparta" yazan kullanıcı "ISPARTA" kaydını BULAMAZ — çünkü küçük
 *      "ı"nın ASCII karşılığı yoktur.
 *
 * İkincisinin çözümü sütunu değil TERİMİ çoğaltmaktır: arama metni Türkçe
 * büyük ve küçük hâlleriyle birlikte aranır. Sütun tarafında bir dönüşüm
 * (ör. `lower(ad)` üzerinde işlevsel indeks) gerekmediği için mevcut
 * indeksler ve RLS olduğu gibi kalır.
 *
 * Bu dosya `server-only` DEĞİLDİR: ürettiği şey düz nesnelerdir ve testler
 * veritabanı olmadan doğrudan sınar.
 */

/** Arama teriminin Türkçe büyük/küçük varyantları (tekrarsız). */
export function aramaVaryantlari(ara: string): string[] {
  const temiz = ara.trim();
  if (!temiz) return [];

  return [
    ...new Set([temiz, temiz.toLocaleLowerCase("tr"), temiz.toLocaleUpperCase("tr")]),
  ];
}

/**
 * "firma.ad" gibi noktalı bir yolu Prisma'nın iç içe nesnesine çevirir:
 * `{ firma: { ad: <deger> } }`.
 */
function yolaGomI(yol: string, deger: unknown): Record<string, unknown> {
  const parcalar = yol.split(".");
  let sonuc: unknown = deger;
  for (let i = parcalar.length - 1; i >= 0; i--) {
    sonuc = { [parcalar[i]]: sonuc };
  }
  return sonuc as Record<string, unknown>;
}

/**
 * Verilen alanlarda Türkçe duyarsız "içerir" koşullarını üretir.
 *
 * `where.OR` içine doğrudan yayılır:
 *
 * ```ts
 * ara ? { OR: metinArama(ara, ["baslik", "firma.ad"]) } : {}
 * ```
 *
 * Arama boşsa BOŞ dizi döner — çağıran onu `OR`'a koymadan önce `ara`
 * kontrolü yapar (boş `OR` Prisma'da hiçbir kaydı döndürmez).
 */
export function metinArama<T>(ara: string, alanlar: string[]): T[] {
  const varyantlar = aramaVaryantlari(ara);
  const kosullar: Record<string, unknown>[] = [];

  for (const alan of alanlar) {
    for (const varyant of varyantlar) {
      kosullar.push(
        yolaGomI(alan, { contains: varyant, mode: "insensitive" as const })
      );
    }
  }

  return kosullar as T[];
}
