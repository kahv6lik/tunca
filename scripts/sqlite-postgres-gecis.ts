/**
 * Tek seferlik veri taşıma: SQLite → PostgreSQL (Faz 2 / A4).
 *
 *   ESKI_SQLITE="file:/mutlak/yol/prod.db" \
 *   DATABASE_URL="postgresql://…" \
 *   npm run gecis:postgres
 *
 * Ne yapar: eski SQLite veritabanındaki tüm kayıtları okur ve hedef
 * PostgreSQL veritabanına aynı kimliklerle (id) yazar. Kimlikler korunduğu
 * için ilişkiler bozulmaz.
 *
 * Ne YAPMAZ: hedef veritabanını silmez. Hedefte veri varsa çalışmayı reddeder
 * — yanlışlıkla iki kez çalıştırıp veriyi ikizlemeyi önlemek için.
 *
 * Kaynak veritabanına yalnızca OKUMA yapar; eski dosyanız değişmez.
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { yonetimIstemcisi } from "../src/lib/rls";

const ESKI = process.env.ESKI_SQLITE;
const YENI = process.env.DATABASE_URL;

if (!ESKI) {
  console.error("ESKI_SQLITE tanımlı değil. Örnek: ESKI_SQLITE=\"file:/root/prod.db\"");
  process.exit(1);
}
if (!YENI || !YENI.startsWith("postgres")) {
  console.error("DATABASE_URL bir PostgreSQL adresi olmalı.");
  process.exit(1);
}

const hedefTemel = new PrismaClient();
const hedef = yonetimIstemcisi(hedefTemel);

/**
 * Eski SQLite dosyasını Prisma ile okumak, şemanın SQLite sürümünü gerektirir.
 * Bunun yerine `sqlite3` yerine taşınabilir bir yol izliyoruz: kayıtları JSON
 * olarak dışa aktarmak için Node'un kendi sqlite okuyucusu yok, bu yüzden
 * tablo tablo `prisma db execute` yerine doğrudan `better-sqlite3` benzeri bir
 * bağımlılık eklemek gerekirdi. Bağımlılık eklememek için `sqlite3` komut
 * satırı aracını kullanıyoruz (Docker imajında ve çoğu sunucuda mevcuttur).
 */
function sqliteOku<T>(tablo: string): T[] {
  const dosya = ESKI!.replace(/^file:/, "");
  const cikti = execFileSync(
    "sqlite3",
    [dosya, "-json", `SELECT * FROM "${tablo}";`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  ).trim();
  return cikti ? (JSON.parse(cikti) as T[]) : [];
}

/** SQLite tarihleri milisaniye (INTEGER) veya ISO metin olarak tutulur. */
function tarih(deger: unknown): Date {
  if (deger === null || deger === undefined) return new Date();
  if (typeof deger === "number") return new Date(deger);
  const s = String(deger);
  const sayi = Number(s);
  return Number.isFinite(sayi) && s.trim() !== "" ? new Date(sayi) : new Date(s);
}

const PARCA = 500;
async function parcaliYaz<T>(ad: string, kayitlar: T[], yaz: (p: T[]) => Promise<unknown>) {
  for (let i = 0; i < kayitlar.length; i += PARCA) {
    await yaz(kayitlar.slice(i, i + PARCA));
  }
  console.log(`  ✅ ${ad}: ${kayitlar.length} kayıt`);
}

async function main() {
  console.log(`\nKaynak : ${ESKI}`);
  console.log(`Hedef  : ${YENI!.replace(/:[^:@]*@/, ":****@")}\n`);

  const mevcut =
    (await hedef.tenant.count()) +
    (await hedef.firma.count()) +
    (await hedef.user.count());
  if (mevcut > 0) {
    console.error(
      `✗ Hedef veritabanı boş değil (${mevcut} kayıt). Veriyi ikizlememek için ` +
        `taşıma durduruldu.\n  Boş bir veritabanına taşıyın veya hedefi temizleyin.`
    );
    process.exit(1);
  }

  console.log("▶ Taşınıyor…");

  const kiracilar = sqliteOku<any>("Tenant");
  await parcaliYaz("Tenant", kiracilar, (p) =>
    hedef.tenant.createMany({
      data: p.map((t) => ({
        id: t.id,
        ad: t.ad,
        slug: t.slug,
        durum: t.durum ?? "aktif",
        createdAt: tarih(t.createdAt),
        updatedAt: tarih(t.updatedAt),
      })),
    })
  );

  const kullanicilar = sqliteOku<any>("User");
  await parcaliYaz("User", kullanicilar, (p) =>
    hedef.user.createMany({
      data: p.map((u) => ({
        id: u.id,
        tenantId: u.tenantId,
        email: u.email,
        name: u.name,
        password: u.password,
        role: u.role ?? "user",
        createdAt: tarih(u.createdAt),
      })),
    })
  );

  const firmalar = sqliteOku<any>("Firma");
  await parcaliYaz("Firma", firmalar, (p) =>
    hedef.firma.createMany({
      data: p.map((f) => ({
        id: f.id,
        tenantId: f.tenantId,
        ad: f.ad,
        vergiNo: f.vergiNo,
        sektor: f.sektor,
        il: f.il,
        ilce: f.ilce,
        yetkiliAd: f.yetkiliAd,
        telefon: f.telefon,
        email: f.email,
        adres: f.adres,
        durum: f.durum ?? "aktif",
        notlar: f.notlar,
        createdAt: tarih(f.createdAt),
        updatedAt: tarih(f.updatedAt),
      })),
    })
  );

  const yatirimlar = sqliteOku<any>("YatirimDestegi");
  await parcaliYaz("YatirimDestegi", yatirimlar, (p) =>
    hedef.yatirimDestegi.createMany({
      data: p.map((y) => ({
        id: y.id,
        tenantId: y.tenantId,
        firmaId: y.firmaId,
        baslik: y.baslik,
        tur: y.tur,
        tutar: Number(y.tutar ?? 0),
        paraBirimi: y.paraBirimi ?? "TRY",
        tarih: tarih(y.tarih),
        durum: y.durum ?? "basvuruldu",
        aciklama: y.aciklama,
        createdAt: tarih(y.createdAt),
      })),
    })
  );

  const egitimler = sqliteOku<any>("Egitim");
  await parcaliYaz("Egitim", egitimler, (p) =>
    hedef.egitim.createMany({
      data: p.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        firmaId: e.firmaId,
        baslik: e.baslik,
        konu: e.konu,
        egitmen: e.egitmen,
        tarih: tarih(e.tarih),
        sureSaat: Number(e.sureSaat ?? 0),
        katilimci: Number(e.katilimci ?? 0),
        durum: e.durum ?? "planlandi",
        notlar: e.notlar,
        createdAt: tarih(e.createdAt),
      })),
    })
  );

  const hizmetler = sqliteOku<any>("Hizmet");
  await parcaliYaz("Hizmet", hizmetler, (p) =>
    hedef.hizmet.createMany({
      data: p.map((h) => ({
        id: h.id,
        tenantId: h.tenantId,
        firmaId: h.firmaId,
        baslik: h.baslik,
        tur: h.tur,
        tarih: tarih(h.tarih),
        durum: h.durum ?? "devam",
        aciklama: h.aciklama,
        createdAt: tarih(h.createdAt),
      })),
    })
  );

  // ── Doğrulama: kaynak ve hedef sayıları birebir tutmalı ────────────────
  console.log("\n▶ Doğrulanıyor…");
  const beklenen = {
    Tenant: kiracilar.length,
    User: kullanicilar.length,
    Firma: firmalar.length,
    YatirimDestegi: yatirimlar.length,
    Egitim: egitimler.length,
    Hizmet: hizmetler.length,
  };
  const bulunan = {
    Tenant: await hedef.tenant.count(),
    User: await hedef.user.count(),
    Firma: await hedef.firma.count(),
    YatirimDestegi: await hedef.yatirimDestegi.count(),
    Egitim: await hedef.egitim.count(),
    Hizmet: await hedef.hizmet.count(),
  };

  let hata = false;
  for (const [ad, sayi] of Object.entries(beklenen)) {
    const b = (bulunan as Record<string, number>)[ad];
    const ok = b === sayi;
    if (!ok) hata = true;
    console.log(`  ${ok ? "✅" : "❌"} ${ad}: kaynak ${sayi} → hedef ${b}`);
  }

  if (hata) {
    console.error("\n✗ Sayılar tutmuyor. Hedef veritabanını temizleyip tekrar deneyin.");
    process.exit(1);
  }
  console.log("\n🎉 Taşıma tamamlandı. Kaynak SQLite dosyasına dokunulmadı.");
}

main()
  .catch((e) => {
    console.error("Taşıma hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await hedefTemel.$disconnect();
  });
