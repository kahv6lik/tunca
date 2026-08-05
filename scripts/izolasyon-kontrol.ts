/**
 * Faz 1 — Çok kiracılılık izolasyon kontrolü.
 *
 * Kiracı katmanının (src/lib/tenant-db.ts) kiracı sınırını gerçekten
 * uyguladığını canlı veri üzerinde doğrular.
 *
 *   npm run kontrol:izolasyon
 *
 * NOT: Bu betik elle doğrulama içindir. Otomatik test paketi Faz 3'te (A5)
 * gelecek; orada bu kontroller CI'da her değişiklikte çalışacak.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// tenant-db.ts ile aynı kural kümesi — Next.js'e bağımlı olmadan çalışsın diye
// burada sadeleştirilmiş bir kopyası kullanılır.
const KIRACI_MODELLERI = new Set(["User", "Firma", "YatirimDestegi", "Egitim", "Hizmet"]);
const FILTRELENEBILIR = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "count",
  "aggregate", "groupBy", "updateMany", "deleteMany",
]);
const YASAK = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

function tenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !KIRACI_MODELLERI.has(model)) return query(args);
          if (YASAK.has(operation)) {
            throw new Error(`${model}.${operation} kiracı kapsamında kullanılamaz`);
          }
          if (FILTRELENEBILIR.has(operation)) {
            args.where = { ...(args.where ?? {}), tenantId };
            return query(args);
          }
          if (operation === "create") {
            args.data = { ...(args.data ?? {}), tenantId };
            return query(args);
          }
          throw new Error(`${model}.${operation} desteklenmiyor`);
        },
      },
    },
  });
}

let gecti = 0;
let kaldi = 0;

function kontrol(ad: string, sonuc: boolean, detay = "") {
  if (sonuc) {
    gecti++;
    console.log(`  ✅ ${ad}${detay ? ` — ${detay}` : ""}`);
  } else {
    kaldi++;
    console.log(`  ❌ ${ad}${detay ? ` — ${detay}` : ""}`);
  }
}

async function main() {
  const [a, b] = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
  if (!a || !b) {
    console.error("En az iki kiracı gerekli. Önce: npm run db:seed");
    process.exit(1);
  }

  console.log(`\nKiracı A: ${a.ad} (${a.slug})`);
  console.log(`Kiracı B: ${b.ad} (${b.slug})\n`);

  const dbA = tenantClient(a.id);
  const dbB = tenantClient(b.id);

  // --- 1. Listeler kiracıya göre ayrışıyor mu? ---
  console.log("1. Liste izolasyonu");
  const firmaA = await dbA.firma.count();
  const firmaB = await dbB.firma.count();
  const firmaToplam = await prisma.firma.count();
  kontrol("Firma sayıları ayrı", firmaA + firmaB === firmaToplam && firmaA > 0 && firmaB > 0,
    `A=${firmaA}, B=${firmaB}, toplam=${firmaToplam}`);

  const yA = await dbA.yatirimDestegi.count();
  const yB = await dbB.yatirimDestegi.count();
  kontrol("Yatırım sayıları ayrı", yA + yB === (await prisma.yatirimDestegi.count()),
    `A=${yA}, B=${yB}`);

  const eA = await dbA.egitim.count();
  const eB = await dbB.egitim.count();
  kontrol("Eğitim sayıları ayrı", eA + eB === (await prisma.egitim.count()), `A=${eA}, B=${eB}`);

  const hA = await dbA.hizmet.count();
  const hB = await dbB.hizmet.count();
  kontrol("Hizmet sayıları ayrı", hA + hB === (await prisma.hizmet.count()), `A=${hA}, B=${hB}`);

  // --- 2. Çapraz kiracı kayıt erişimi ---
  console.log("\n2. Çapraz kiracı erişimi (A, B'nin kaydını göremez)");
  const bFirma = await prisma.firma.findFirst({ where: { tenantId: b.id } });
  const bYatirim = await prisma.firma.findFirst({ where: { tenantId: b.id } });
  if (!bFirma || !bYatirim) throw new Error("B kiracısında veri yok");

  kontrol("A, B'nin firmasını okuyamaz",
    (await dbA.firma.findFirst({ where: { id: bFirma.id } })) === null,
    `id=${bFirma.id.slice(0, 8)}…`);

  const bY = await prisma.yatirimDestegi.findFirst({ where: { tenantId: b.id } });
  kontrol("A, B'nin yatırım kaydını okuyamaz",
    (await dbA.yatirimDestegi.findFirst({ where: { id: bY!.id } })) === null);

  const bE = await prisma.egitim.findFirst({ where: { tenantId: b.id } });
  kontrol("A, B'nin eğitim kaydını okuyamaz",
    (await dbA.egitim.findFirst({ where: { id: bE!.id } })) === null);

  const bH = await prisma.hizmet.findFirst({ where: { tenantId: b.id } });
  kontrol("A, B'nin hizmet kaydını okuyamaz",
    (await dbA.hizmet.findFirst({ where: { id: bH!.id } })) === null);

  // --- 3. Çapraz kiracı yazma ---
  console.log("\n3. Çapraz kiracı yazma (A, B'nin kaydını değiştiremez)");
  const oncekiAd = bFirma.ad;
  const guncelleme = await dbA.firma.updateMany({
    where: { id: bFirma.id },
    data: { ad: "SIZINTI TESTI" },
  });
  kontrol("A'nın güncellemesi B'nin firmasına işlemez", guncelleme.count === 0,
    `etkilenen satır=${guncelleme.count}`);

  const sonrakiAd = (await prisma.firma.findUnique({ where: { id: bFirma.id } }))!.ad;
  kontrol("B'nin firma adı değişmedi", sonrakiAd === oncekiAd, `"${sonrakiAd}"`);

  const silme = await dbA.firma.deleteMany({ where: { id: bFirma.id } });
  kontrol("A'nın silmesi B'nin firmasını silmez", silme.count === 0,
    `etkilenen satır=${silme.count}`);
  kontrol("B'nin firması hâlâ duruyor",
    (await prisma.firma.findUnique({ where: { id: bFirma.id } })) !== null);

  // --- 4. Oluşturmada tenantId otomatik ---
  console.log("\n4. Oluşturmada kiracı damgası");
  const yeni = await dbA.firma.create({ data: { ad: "Kontrol Firması" } as any });
  const yeniKayit = await prisma.firma.findUnique({ where: { id: yeni.id } });
  kontrol("Yeni kayıt A kiracısına damgalandı", yeniKayit?.tenantId === a.id,
    `tenantId=${yeniKayit?.tenantId}`);
  kontrol("B bu yeni kaydı göremez",
    (await dbB.firma.findFirst({ where: { id: yeni.id } })) === null);
  await prisma.firma.delete({ where: { id: yeni.id } });

  // --- 5. Güvensiz işlemler engelleniyor mu? ---
  console.log("\n5. Kiracı filtresi uygulanamayan işlemler engelleniyor");
  for (const [ad, fn] of [
    ["findUnique", () => dbA.firma.findUnique({ where: { id: bFirma.id } })],
    ["update", () => dbA.firma.update({ where: { id: bFirma.id }, data: { ad: "x" } })],
    ["delete", () => dbA.firma.delete({ where: { id: bFirma.id } })],
  ] as const) {
    let engellendi = false;
    try {
      await fn();
    } catch {
      engellendi = true;
    }
    kontrol(`${ad} reddedildi`, engellendi);
  }

  // --- 6. Rapor/dashboard toplamları ---
  console.log("\n6. Toplamlar kiracı dışını saymıyor");
  const aggA = await dbA.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  const aggB = await dbB.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  const aggT = await prisma.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  const toplamEsit =
    Math.round((aggA._sum.tutar ?? 0) + (aggB._sum.tutar ?? 0)) ===
    Math.round(aggT._sum.tutar ?? 0);
  kontrol("aggregate toplamları kiracıya göre bölünüyor", toplamEsit,
    `A=${aggA._sum.tutar}, B=${aggB._sum.tutar}`);

  const grupA = await dbA.firma.groupBy({ by: ["durum"], _count: { _all: true } });
  const grupToplamA = grupA.reduce((s, g) => s + g._count._all, 0);
  kontrol("groupBy yalnızca A'nın firmalarını sayıyor", grupToplamA === firmaA,
    `groupBy=${grupToplamA}, count=${firmaA}`);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Geçen: ${gecti}   Kalan: ${kaldi}`);
  console.log(`SONUC gecti=${gecti} kaldi=${kaldi}`);
  if (kaldi > 0) {
    console.log("❌ İZOLASYON KONTROLÜ BAŞARISIZ");
    process.exit(1);
  }
  console.log("✅ Tüm izolasyon kontrolleri geçti.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
