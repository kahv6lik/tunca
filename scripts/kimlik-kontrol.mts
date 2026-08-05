/**
 * Kimlik doğrulama kontrolleri — GERÇEK TARAYICI, GERÇEK FORM.
 *
 *   npm run kontrol:kimlik        (sunucu çalışırken)
 *
 * Neden tarayıcı: izolasyon kontrolleri oturum çerezini kendisi üretiyor,
 * yani giriş formunu ve Server Action'ı atlıyor. Bu betik formu gerçekten
 * doldurup gönderir; giriş akışının kendisini kanıtlar.
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { yonetimIstemcisi } from "../src/lib/rls";
import bcrypt from "bcryptjs";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const CHROME = process.env.PW_CHROME ?? "/opt/pw-browsers/chromium";
// RLS açık: gerçek toplamları okumak için yönetim bağlamı gerekir.
const temel = new PrismaClient();
const prisma = yonetimIstemcisi(temel);

let gecti = 0;
let kaldi = 0;
const kontrol = (ad: string, ok: boolean, detay = "") => {
  ok ? gecti++ : kaldi++;
  console.log(`  ${ok ? "✅" : "❌"} ${ad}${detay ? ` — ${detay}` : ""}`);
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME });

  const girisDene = async (email: string, sifre: string, kiraci?: string) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", email);
    await page.fill("#password", sifre);
    if (kiraci) {
      await page.fill("#kiraci", kiraci).catch(() => {});
    }
    await page.click("button[type=submit]");
    await page.waitForTimeout(2500);
    const url = page.url();
    const govde = await page.locator("body").innerText();
    await ctx.close();
    return { url, govde, girdi: !url.includes("/login") };
  };

  // 1 — Demo hesabı
  console.log("1. Demo yönetici hesabı");
  const demo = await prisma.user.findFirst({
    where: { email: "admin@gezegen.com" },
    include: { tenant: true },
  });
  kontrol("Demo hesap veritabanında var", !!demo, demo ? demo.email : "YOK");
  kontrol("Demo hesabın rolü admin", demo?.role === "admin", `rol=${demo?.role}`);
  kontrol("Demo hesabın kiracısı aktif", demo?.tenant.durum === "aktif", `durum=${demo?.tenant.durum}`);
  kontrol(
    "Demo şifresi 'admin123' geçerli",
    demo ? await bcrypt.compare("admin123", demo.password) : false
  );

  // 2 — Gerçek form ile giriş
  console.log("\n2. Giriş formu (gerçek tarayıcı)");
  const dogru = await girisDene("admin@gezegen.com", "admin123");
  kontrol("Doğru bilgiyle giriş başarılı", dogru.girdi, dogru.url);
  kontrol("Panele yönlendirildi", dogru.govde.includes("Genel Bakış"));
  kontrol("Kendi kuruluşunu görüyor", dogru.govde.includes("Gezegen Danışmanlık"));

  const ikinci = await girisDene("admin@anadolu.com", "anadolu123");
  kontrol("İkinci kiracı da giriş yapabiliyor", ikinci.girdi, ikinci.url);
  kontrol("İkinci kiracı kendi kuruluşunu görüyor", ikinci.govde.includes("Anadolu Yatırım"));
  kontrol("İkinci kiracı diğerinin adını görmüyor", !ikinci.govde.includes("Gezegen Danışmanlık"));

  // 3 — Hatalı giriş denemeleri
  console.log("\n3. Hatalı giriş reddediliyor");
  const yanlisSifre = await girisDene("admin@gezegen.com", "yanlis-sifre");
  kontrol("Yanlış şifre reddedildi", !yanlisSifre.girdi);
  kontrol("Genel hata mesajı gösteriliyor", yanlisSifre.govde.includes("E-posta veya şifre hatalı"));

  const yokEmail = await girisDene("olmayan@hicbiryer.com", "admin123");
  kontrol("Var olmayan e-posta reddedildi", !yokEmail.girdi);
  kontrol(
    "Hata mesajı kullanıcının varlığını sızdırmıyor",
    yokEmail.govde.includes("E-posta veya şifre hatalı"),
    "yanlış şifre ile aynı mesaj"
  );

  // 4 — Çapraz kiracı şifre denemesi
  console.log("\n4. Kiracılar arası kimlik sızıntısı");
  const capraz = await girisDene("admin@anadolu.com", "admin123");
  kontrol("Bir kiracının şifresi diğerinde işe yaramıyor", !capraz.girdi);

  // 5 — Askıya alınmış kiracı
  console.log("\n5. Askıya alınmış kiracı");
  const anadolu = await prisma.tenant.findUnique({ where: { slug: "anadolu" } });
  if (anadolu) {
    await prisma.tenant.update({ where: { id: anadolu.id }, data: { durum: "askida" } });
    const askida = await girisDene("admin@anadolu.com", "anadolu123");
    kontrol("Askıya alınmış kiracının kullanıcısı giremiyor", !askida.girdi);
    kontrol("Açıklayıcı mesaj gösteriliyor", askida.govde.includes("erişimi durdurulmuş"));
    await prisma.tenant.update({ where: { id: anadolu.id }, data: { durum: "aktif" } });
    const tekrar = await girisDene("admin@anadolu.com", "anadolu123");
    kontrol("Yeniden aktifleştirilince girebiliyor", tekrar.girdi);
  }

  await browser.close();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Geçen: ${gecti}   Kalan: ${kaldi}`);
  console.log(`SONUC gecti=${gecti} kaldi=${kaldi}`);
  if (kaldi > 0) {
    console.log("❌ KİMLİK DOĞRULAMA KONTROLÜ BAŞARISIZ");
    process.exit(1);
  }
  console.log("✅ Tüm kimlik doğrulama kontrolleri geçti.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await temel.$disconnect();
  });
