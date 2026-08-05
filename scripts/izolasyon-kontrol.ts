/**
 * Kiracı izolasyon kontrolü — veri katmanı + PostgreSQL Row-Level Security.
 *
 *   npm run kontrol:izolasyon
 *
 * Faz 1'de yalnızca uygulama katmanı ölçülüyordu. Faz 2 ile izolasyon
 * veritabanına da indi; bu betik artık İKİ katmanı birden ölçer:
 *
 *   - Uygulama katmanı: `src/lib/rls.ts` üzerinden gelen kiracı istemcisi
 *   - Veritabanı katmanı: RLS politikaları (bağlam yoksa sıfır satır)
 *
 * Önemli: buradaki "gerçek toplamlar" yönetim bağlamıyla okunur; RLS açıkken
 * bağlamsız bir istemci hiçbir satır göremez — zaten kanıtlamak istediğimiz de
 * budur.
 */
import { PrismaClient } from "@prisma/client";
import { kiraciIstemcisi, yonetimIstemcisi, kimlikIstemcisi } from "../src/lib/rls";

const temel = new PrismaClient();
const yonetim = yonetimIstemcisi(temel);

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
  const kiracilar = await yonetim.tenant.findMany({ orderBy: { createdAt: "asc" } });
  const a = kiracilar.find((t) => t.slug === "gezegen");
  const b = kiracilar.find((t) => t.slug === "anadolu");
  if (!a || !b) {
    console.error("İki kiracılı demo veri gerekli. Önce: npm run db:seed");
    process.exit(1);
  }

  console.log(`\nKiracı A: ${a.ad} (${a.slug})`);
  console.log(`Kiracı B: ${b.ad} (${b.slug})\n`);

  const dbA = kiraciIstemcisi(a.id, temel);
  const dbB = kiraciIstemcisi(b.id, temel);

  // ── 1. Liste izolasyonu ────────────────────────────────────────────────
  console.log("1. Liste izolasyonu");
  const firmaA = await dbA.firma.count();
  const firmaB = await dbB.firma.count();
  const firmaToplam = await yonetim.firma.count();
  kontrol(
    "Firma sayıları ayrı",
    firmaA + firmaB === firmaToplam && firmaA > 0 && firmaB > 0,
    `A=${firmaA}, B=${firmaB}, toplam=${firmaToplam}`
  );

  const yA = await dbA.yatirimDestegi.count();
  const yB = await dbB.yatirimDestegi.count();
  kontrol("Yatırım sayıları ayrı", yA + yB === (await yonetim.yatirimDestegi.count()), `A=${yA}, B=${yB}`);

  const eA = await dbA.egitim.count();
  const eB = await dbB.egitim.count();
  kontrol("Eğitim sayıları ayrı", eA + eB === (await yonetim.egitim.count()), `A=${eA}, B=${eB}`);

  const hA = await dbA.hizmet.count();
  const hB = await dbB.hizmet.count();
  kontrol("Hizmet sayıları ayrı", hA + hB === (await yonetim.hizmet.count()), `A=${hA}, B=${hB}`);

  // ── 2. Çapraz kiracı okuma ─────────────────────────────────────────────
  console.log("\n2. Çapraz kiracı okuma (A, B'nin kaydını göremez)");
  const bFirma = (await yonetim.firma.findFirst({ where: { tenantId: b.id } }))!;
  kontrol(
    "A, B'nin firmasını okuyamaz",
    (await dbA.firma.findFirst({ where: { id: bFirma.id } })) === null,
    `id=${bFirma.id.slice(0, 8)}…`
  );

  const bY = (await yonetim.yatirimDestegi.findFirst({ where: { tenantId: b.id } }))!;
  kontrol("A, B'nin yatırım kaydını okuyamaz", (await dbA.yatirimDestegi.findFirst({ where: { id: bY.id } })) === null);

  const bE = (await yonetim.egitim.findFirst({ where: { tenantId: b.id } }))!;
  kontrol("A, B'nin eğitim kaydını okuyamaz", (await dbA.egitim.findFirst({ where: { id: bE.id } })) === null);

  const bH = (await yonetim.hizmet.findFirst({ where: { tenantId: b.id } }))!;
  kontrol("A, B'nin hizmet kaydını okuyamaz", (await dbA.hizmet.findFirst({ where: { id: bH.id } })) === null);

  kontrol(
    "A, B kiracısının kendisini göremez",
    (await dbA.tenant.findFirst({ where: { id: b.id } })) === null
  );
  kontrol("A yalnızca kendi kiracısını görür", (await dbA.tenant.count()) === 1);

  kontrol(
    "A, B'nin kullanıcılarını göremez",
    (await dbA.user.count({ where: { tenantId: b.id } })) === 0
  );

  // ── 3. Çapraz kiracı yazma ─────────────────────────────────────────────
  console.log("\n3. Çapraz kiracı yazma (A, B'nin kaydını değiştiremez)");
  const oncekiAd = bFirma.ad;
  const guncelleme = await dbA.firma.updateMany({ where: { id: bFirma.id }, data: { ad: "SIZINTI TESTI" } });
  kontrol("A'nın güncellemesi B'nin firmasına işlemez", guncelleme.count === 0, `etkilenen satır=${guncelleme.count}`);

  const sonrakiAd = (await yonetim.firma.findFirst({ where: { id: bFirma.id } }))!.ad;
  kontrol("B'nin firma adı değişmedi", sonrakiAd === oncekiAd, `"${sonrakiAd}"`);

  const silme = await dbA.firma.deleteMany({ where: { id: bFirma.id } });
  kontrol("A'nın silmesi B'nin firmasını silmez", silme.count === 0, `etkilenen satır=${silme.count}`);
  kontrol("B'nin firması hâlâ duruyor", (await yonetim.firma.findFirst({ where: { id: bFirma.id } })) !== null);

  // ── 4. Oluşturmada kiracı damgası ──────────────────────────────────────
  console.log("\n4. Oluşturmada kiracı damgası");
  const yeni = await dbA.firma.create({ data: { ad: "Kontrol Firması", tenantId: a.id } });
  const yeniKayit = await yonetim.firma.findFirst({ where: { id: yeni.id } });
  kontrol("Yeni kayıt A kiracısına damgalandı", yeniKayit?.tenantId === a.id, `tenantId=${yeniKayit?.tenantId}`);
  kontrol("B bu yeni kaydı göremez", (await dbB.firma.findFirst({ where: { id: yeni.id } })) === null);

  // RLS WITH CHECK: A, B'nin kimliğiyle kayıt yazamamalı
  let yazmaEngellendi = false;
  try {
    await dbA.firma.create({ data: { ad: "Sahte Kiracı Kaydı", tenantId: b.id } });
  } catch {
    yazmaEngellendi = true;
  }
  kontrol("A, B kiracısı adına kayıt oluşturamaz (RLS WITH CHECK)", yazmaEngellendi);

  await yonetim.firma.deleteMany({ where: { id: yeni.id } });

  // ── 5. RLS: bağlam yoksa veri yok ──────────────────────────────────────
  console.log("\n5. Veritabanı katmanı — bağlamsız erişim (RLS)");
  const bagalamsizSayilar = await Promise.all([
    temel.firma.count(),
    temel.yatirimDestegi.count(),
    temel.egitim.count(),
    temel.hizmet.count(),
    temel.user.count(),
    temel.tenant.count(),
  ]);
  const adlar = ["Firma", "YatirimDestegi", "Egitim", "Hizmet", "User", "Tenant"];
  bagalamsizSayilar.forEach((sayi, i) => {
    kontrol(`${adlar[i]}: bağlamsız sorgu sıfır satır döner`, sayi === 0, `dönen=${sayi}`);
  });

  const hamSatirlar = await temel.$queryRawUnsafe<{ n: bigint }[]>(
    'SELECT count(*)::bigint AS n FROM "Firma"'
  );
  kontrol(
    "Ham SQL de (uygulama katmanı atlanarak) sıfır satır döner",
    Number(hamSatirlar[0].n) === 0,
    `dönen=${hamSatirlar[0].n}`
  );

  // ── 6. Kimlik doğrulama bağlamı sınırlı mı? ────────────────────────────
  console.log("\n6. Kimlik doğrulama bağlamının sınırları");
  const kimlik = kimlikIstemcisi(temel);
  kontrol("Kimlik bağlamı kullanıcıları okuyabilir", (await kimlik.user.count()) > 0);
  kontrol("Kimlik bağlamı kiracıları okuyabilir", (await kimlik.tenant.count()) > 0);
  kontrol("Kimlik bağlamı iş verisini GÖREMEZ", (await kimlik.firma.count()) === 0);

  let kimlikYazamaz = false;
  try {
    await kimlik.user.updateMany({ where: {}, data: { name: "sızıntı" } });
  } catch {
    kimlikYazamaz = true;
  }
  const yazilanVar = await yonetim.user.count({ where: { name: "sızıntı" } });
  kontrol("Kimlik bağlamı yazamaz", kimlikYazamaz || yazilanVar === 0, kimlikYazamaz ? "hata verdi" : "0 satır etkilendi");

  // ── 7. Toplamlar ───────────────────────────────────────────────────────
  console.log("\n7. Toplamlar kiracı dışını saymıyor");
  const aggA = await dbA.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  const aggB = await dbB.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  const aggT = await yonetim.yatirimDestegi.aggregate({ _sum: { tutar: true } });
  kontrol(
    "aggregate toplamları kiracıya göre bölünüyor",
    Math.round((aggA._sum.tutar ?? 0) + (aggB._sum.tutar ?? 0)) === Math.round(aggT._sum.tutar ?? 0),
    `A=${aggA._sum.tutar}, B=${aggB._sum.tutar}`
  );

  const grupA = await dbA.firma.groupBy({ by: ["durum"], _count: { _all: true } });
  const grupToplamA = grupA.reduce((s, g) => s + g._count._all, 0);
  kontrol("groupBy yalnızca A'nın firmalarını sayıyor", grupToplamA === firmaA, `groupBy=${grupToplamA}, count=${firmaA}`);

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
    await temel.$disconnect();
  });
