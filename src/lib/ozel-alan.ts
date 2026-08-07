import "server-only";
import { cache } from "react";
import { getTenantDb, tenantOlustur, type TenantClient } from "./tenant-db";
import { kapaliModulIzinleri } from "./kiraci-ayar";
import type { OzelAlanTanimi, OzelAlanVarligi } from "./ozel-alan-tanimlar";

export * from "./ozel-alan-tanimlar";

/**
 * Kiracıya özel alanlar — VERİ ERİŞİMİ (Faz 11 / E6).
 *
 * Saf mantık (tip listesi, doğrulama, biçimleme) `ozel-alan-tanimlar.ts`
 * içindedir; burası yalnızca kiracı katmanı üzerinden okur/yazar.
 */

/** Varlık → OzelAlanDeger tablosundaki FK sütunu. */
const FK_SUTUNU: Record<OzelAlanVarligi, "firmaId" | "kisiId" | "firsatId"> = {
  firma: "firmaId",
  kisi: "kisiId",
  firsat: "firsatId",
};

/**
 * Bir varlığın alan tanımları, sıraya göre.
 *
 * Paket "ozelalan" modülünü kapattıysa BOŞ liste döner: alanlar formlarda
 * görünmez, değer doğrulaması istenmez, dışa aktarıma sütun eklenmez —
 * tek kontrol noktası burasıdır. `cache()` ile istek başına bir kez çalışır.
 */
export const alanlariGetir = cache(
  async (varlik: OzelAlanVarligi): Promise<OzelAlanTanimi[]> => {
    const kapali = await kapaliModulIzinleri();
    if (kapali.has("ozelalan")) return [];

    const db = await getTenantDb();
    const alanlar = await db.ozelAlan.findMany({
      where: { varlik },
      orderBy: [{ sira: "asc" }, { createdAt: "asc" }],
    });
    return alanlar.map((a) => ({
      id: a.id,
      varlik: a.varlik,
      ad: a.ad,
      tip: a.tip,
      secenekler: a.secenekler,
      zorunlu: a.zorunlu,
      sira: a.sira,
    }));
  }
);

/** Tek kaydın değerleri: alanId → deger. */
export async function degerHaritasi(
  db: TenantClient,
  varlik: OzelAlanVarligi,
  kayitId: string
): Promise<Map<string, string>> {
  const satirlar = await db.ozelAlanDeger.findMany({
    where: { [FK_SUTUNU[varlik]]: kayitId },
  });
  return new Map(satirlar.map((s) => [s.alanId, s.deger]));
}

/** Çok kayıt için değerler (dışa aktarım): kayitId → (alanId → deger). */
export async function topluDegerHaritasi(
  db: TenantClient,
  varlik: OzelAlanVarligi,
  kayitIdler: string[]
): Promise<Map<string, Map<string, string>>> {
  if (kayitIdler.length === 0) return new Map();
  const fk = FK_SUTUNU[varlik];
  const satirlar = await db.ozelAlanDeger.findMany({
    where: { [fk]: { in: kayitIdler } },
  });

  const sonuc = new Map<string, Map<string, string>>();
  for (const s of satirlar) {
    const kayitId = (s as Record<string, unknown>)[fk] as string;
    if (!sonuc.has(kayitId)) sonuc.set(kayitId, new Map());
    sonuc.get(kayitId)!.set(s.alanId, s.deger);
  }
  return sonuc;
}

/**
 * Bir kaydın özel alan değerlerini yazar.
 *
 * Kiracı katmanında `upsert` engelli olduğu için sil + yaz yapılır: boş
 * değer satırı kaldırır, dolu değer yeni satır açar. `alanId`ler kiracı
 * kapsamlı `alanlariGetir`den geldiği için başka kiracının alanına değer
 * yazılamaz; `kayitId` ise çağıran action'da sahipliği doğrulanmış kayıttır.
 */
export async function degerleriKaydet(
  db: TenantClient,
  varlik: OzelAlanVarligi,
  kayitId: string,
  degerler: Map<string, string>
): Promise<void> {
  if (degerler.size === 0) return;
  const fk = FK_SUTUNU[varlik];

  await db.ozelAlanDeger.deleteMany({
    where: { [fk]: kayitId, alanId: { in: [...degerler.keys()] } },
  });

  for (const [alanId, deger] of degerler) {
    if (!deger) continue;
    await tenantOlustur(db, "ozelAlanDeger", { alanId, [fk]: kayitId, deger });
  }
}

/**
 * Liste filtreleri (firmalar sayfası): seçilen özel alan değerine sahip
 * kayıtların id listesi. Sorgu kiracı katmanından geçer.
 */
export async function degerleEslesenKayitlar(
  db: TenantClient,
  varlik: OzelAlanVarligi,
  alanId: string,
  deger: string
): Promise<string[]> {
  const fk = FK_SUTUNU[varlik];
  const satirlar = await db.ozelAlanDeger.findMany({
    where: { alanId, deger },
    select: { [fk]: true } as never,
  });
  return satirlar
    .map((s) => (s as Record<string, unknown>)[fk] as string | null)
    .filter((x): x is string => !!x);
}
