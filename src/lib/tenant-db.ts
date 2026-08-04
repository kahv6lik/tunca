import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "./db";
import { requireSession } from "./auth";

/**
 * Kiracı kapsamlı veri erişim katmanı (Faz 1 / A2).
 *
 * Uygulamanın hiçbir sayfası veya action'ı `prisma`'yı doğrudan çağırmaz;
 * hepsi buradan geçer. Prisma client extension'ı, kiracıya ait modellerde:
 *
 *   - okuma/sayma/gruplama sorgularına  → `where.tenantId` ekler
 *   - oluşturma işlemlerine             → `data.tenantId` ekler
 *   - `findUnique`, `update`, `delete`  → kullanımını ENGELLER
 *
 * Son madde bilinçli: bu üç işlem yalnızca birincil anahtarla çalışır, yani
 * kiracı filtresi uygulanamaz. Bunların yerine `findFirst`, `updateMany` ve
 * `deleteMany` kullanılır — onlara filtre eklenebildiği için kiracı sınırı
 * korunur. Aşağıdaki `sahiplikDogrula` / `tenantGuncelle` / `tenantSil`
 * yardımcıları bu güvenli kalıbı hazır sunar.
 */

const KIRACI_MODELLERI = new Set([
  "User",
  "Firma",
  "YatirimDestegi",
  "Egitim",
  "Hizmet",
]);

// where filtresi eklenerek güvene alınabilen işlemler
const FILTRELENEBILIR = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// Birincil anahtarla çalıştığı için kiracı filtresi uygulanamayan işlemler
const YASAK = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

export function tenantClient(tenantId: string) {
  if (!tenantId) {
    throw new Error("tenantClient: tenantId zorunludur.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !KIRACI_MODELLERI.has(model)) {
            return query(args);
          }

          if (YASAK.has(operation)) {
            throw new Error(
              `${model}.${operation} kiracı kapsamında kullanılamaz — ` +
                `kiracı filtresi uygulanamayan bir işlem. ` +
                `findFirst / updateMany / deleteMany kullanın.`
            );
          }

          if (FILTRELENEBILIR.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...(a.where ?? {}), tenantId };
            return query(args);
          }

          if (operation === "create") {
            const a = args as { data?: Record<string, unknown> };
            a.data = { ...(a.data ?? {}), tenantId };
            return query(args);
          }

          if (operation === "createMany") {
            const a = args as { data?: Record<string, unknown> | Record<string, unknown>[] };
            a.data = Array.isArray(a.data)
              ? a.data.map((d) => ({ ...d, tenantId }))
              : { ...(a.data ?? {}), tenantId };
            return query(args);
          }

          // Tanınmayan bir işlem: kiracı sınırını garanti edemiyoruz, reddet.
          throw new Error(
            `${model}.${operation} kiracı kapsamında desteklenmiyor.`
          );
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantClient>;

/** Oturumdaki kiracıya bağlı veri erişimi + oturum bilgisi. */
export async function getTenantContext() {
  const session = await requireSession();
  return { session, db: tenantClient(session.tenantId), tenantId: session.tenantId };
}

/** Yalnızca veri erişimi gerektiğinde kısayol. */
export async function getTenantDb(): Promise<TenantClient> {
  const { db } = await getTenantContext();
  return db;
}

/**
 * A3 — Sahiplik doğrulaması.
 *
 * Kaydın oturumdaki kiracıya ait olduğunu doğrular. Ait değilse (ya da hiç
 * yoksa) 404 üretir. Bilerek 403 değil: 403, "böyle bir kayıt var ama senin
 * değil" bilgisini sızdırırdı. Kiracılar birbirinin varlığını bilmemeli.
 */
export async function sahiplikDogrula(
  db: TenantClient,
  model: "firma" | "yatirimDestegi" | "egitim" | "hizmet",
  id: string
): Promise<void> {
  const kayit = await (db[model] as {
    findFirst: (a: unknown) => Promise<{ id: string } | null>;
  }).findFirst({ where: { id }, select: { id: true } });

  if (!kayit) notFound();
}

/**
 * Kiracı sınırı içinde kayıt oluşturma.
 *
 * `tenantId` alanını kiracı katmanı çalışma anında ekler; bu yardımcı da
 * TypeScript'in onu çağıranlardan istememesini sağlar. Böylece `tenantId`
 * hiçbir çağrı yerinde elle yazılmaz — tek kaynak kiracı katmanıdır.
 */
export async function tenantOlustur(
  db: TenantClient,
  model: "firma" | "yatirimDestegi" | "egitim" | "hizmet",
  data: Record<string, unknown>
): Promise<{ id: string }> {
  return (db[model] as {
    create: (a: unknown) => Promise<{ id: string }>;
  }).create({ data });
}

/** Kiracı sınırı içinde güncelleme. Kayıt kiracıya ait değilse 404. */
export async function tenantGuncelle(
  db: TenantClient,
  model: "firma" | "yatirimDestegi" | "egitim" | "hizmet",
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const sonuc = await (db[model] as {
    updateMany: (a: unknown) => Promise<{ count: number }>;
  }).updateMany({ where: { id }, data });

  if (sonuc.count === 0) notFound();
}

/** Kiracı sınırı içinde silme. Kayıt kiracıya ait değilse 404. */
export async function tenantSil(
  db: TenantClient,
  model: "firma" | "yatirimDestegi" | "egitim" | "hizmet",
  id: string
): Promise<void> {
  const sonuc = await (db[model] as {
    deleteMany: (a: unknown) => Promise<{ count: number }>;
  }).deleteMany({ where: { id } });

  if (sonuc.count === 0) notFound();
}

/**
 * Alt kayıtların (yatırım/eğitim/hizmet) bağlanacağı firmanın kiracıya ait
 * olduğunu doğrular. Bu kontrol olmadan kullanıcı, kendi kiracısında ama
 * başka kiracının firmasına bağlı bir kayıt oluşturabilirdi.
 */
export async function firmaSahipligiDogrula(
  db: TenantClient,
  firmaId: string
): Promise<void> {
  await sahiplikDogrula(db, "firma", firmaId);
}
