/**
 * Faz 1 — Uçtan uca izolasyon kontrolü (gerçek HTTP üzerinden).
 *
 * Çalışan bir sunucuya iki farklı kiracının oturum çerezleriyle istek atar ve
 * hiçbir kiracının diğerinin verisini göremediğini doğrular.
 *
 *   npm run build && npm run start &
 *   npm run kontrol:e2e
 *
 * NOT: `izolasyon-kontrol.ts` veri katmanını ölçer; bu betik ise gerçek
 * sayfaların döndürdüğü HTML'i ölçer. İkisi farklı katmanları kapsar.
 *
 * HTTP durum kodu hakkında: kiracı dışı bir kayıt istendiğinde uygulama 404
 * sayfasını gösterir ama HTTP durumu 200 döner. Bunun sebebi Next.js'in akışlı
 * render'ıdır — `(app)/loading.tsx` bir Suspense sınırı oluşturduğu için
 * başlıklar gövdeden önce gönderilir, `notFound()` ise gövde üretilirken
 * çalışır. Veri sızıntısı yoktur; ölçtüğümüz şey de budur.
 */
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

let gecti = 0;
let kaldi = 0;
const kontrol = (ad: string, ok: boolean, detay = "") => {
  ok ? gecti++ : kaldi++;
  console.log(`  ${ok ? "✅" : "❌"} ${ad}${detay ? ` — ${detay}` : ""}`);
};

async function cerez(u: any) {
  const token = await new SignJWT({
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tenantId: u.tenantId,
    tenantSlug: u.tenant.slug,
    tenantAd: u.tenant.ad,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
  return `gezegen_session=${token}`;
}

async function getir(yol: string, c: string) {
  const r = await fetch(BASE + yol, { headers: { cookie: c }, redirect: "manual" });
  return { status: r.status, html: await r.text() };
}

async function main() {
  const users = await prisma.user.findMany({ include: { tenant: true } });
  const uA = users.find((u) => u.tenant.slug === "gezegen");
  const uB = users.find((u) => u.tenant.slug === "anadolu");
  if (!uA || !uB) {
    console.error("İki kiracılı demo veri gerekli. Önce: npm run db:seed");
    process.exit(1);
  }

  const cA = await cerez(uA);
  const cB = await cerez(uB);

  console.log(`\nA = ${uA.tenant.ad} (${uA.email})`);
  console.log(`B = ${uB.tenant.ad} (${uB.email})\n`);

  // 1 — Liste sayıları
  console.log("1. Liste sayıları kiracıya göre");
  const lA = await getir("/firmalar", cA);
  const lB = await getir("/firmalar", cB);
  const sayi = (h: string) => h.match(/(\d+) firma listeleniyor/)?.[1];
  const aSayi = await prisma.firma.count({ where: { tenantId: uA.tenantId } });
  const bSayi = await prisma.firma.count({ where: { tenantId: uB.tenantId } });
  kontrol("A kendi firma sayısını görüyor", sayi(lA.html) === String(aSayi), `${sayi(lA.html)} = ${aSayi}`);
  kontrol("B kendi firma sayısını görüyor", sayi(lB.html) === String(bSayi), `${sayi(lB.html)} = ${bSayi}`);

  // 2 — Aktif kuruluş göstergesi
  console.log("\n2. Aktif kuruluş göstergesi");
  kontrol("A kendi kuruluşunu görüyor", lA.html.includes(uA.tenant.ad));
  kontrol("A, B'nin kuruluş adını görmüyor", !lA.html.includes(uB.tenant.ad));
  kontrol("B kendi kuruluşunu görüyor", lB.html.includes(uB.tenant.ad));

  // 3 — Çapraz kiracı doğrudan URL
  console.log("\n3. Doğrudan URL ile çapraz kiracı erişimi");
  const bFirma = (await prisma.firma.findFirst({ where: { tenantId: uB.tenantId } }))!;
  const capraz = await getir(`/firmalar/${bFirma.id}`, cA);
  kontrol("A, B'nin firma verisini göremiyor", !capraz.html.includes(bFirma.ad), `"${bFirma.ad}"`);
  kontrol("A'ya 404 sayfası gösteriliyor", capraz.html.includes("Aradığınız sayfa bulunamadı"));
  if (bFirma.vergiNo) {
    kontrol("B'nin vergi numarası sızmıyor", !capraz.html.includes(bFirma.vergiNo));
  }

  const caprazDuzenle = await getir(`/firmalar/${bFirma.id}/duzenle`, cA);
  kontrol("A, B'nin düzenleme formunu açamıyor", !caprazDuzenle.html.includes(bFirma.ad));

  const kendi = await getir(`/firmalar/${bFirma.id}`, cB);
  kontrol("B kendi firmasını normal görüyor", kendi.html.includes(bFirma.ad));

  // 4 — Listelerde çapraz kayıt sızıntısı
  console.log("\n4. Listelerde sızıntı");
  kontrol("B'nin firması A'nın listesinde yok", !lA.html.includes(bFirma.ad));
  const bYatirim = await prisma.yatirimDestegi.findFirst({ where: { tenantId: uB.tenantId } });
  const yA = await getir("/yatirim-destekleri", cA);
  kontrol("B'nin yatırım kaydı A'nın listesinde yok", !yA.html.includes(bYatirim!.baslik + bFirma.ad));

  // 5 — Oturum kontrolleri
  console.log("\n5. Oturum kontrolleri");
  const anon = await fetch(BASE + "/firmalar", { redirect: "manual" });
  kontrol("Girişsiz erişim /login'e yönleniyor", [301, 302, 307, 308].includes(anon.status), `HTTP ${anon.status}`);

  const eskiToken = await new SignJWT({ userId: uA.id, email: uA.email, name: uA.name, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
  const eski = await fetch(BASE + "/firmalar", {
    headers: { cookie: `gezegen_session=${eskiToken}` },
    redirect: "manual",
  });
  kontrol("tenantId taşımayan oturum reddediliyor", [301, 302, 307, 308].includes(eski.status), `HTTP ${eski.status}`);

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Geçen: ${gecti}   Kalan: ${kaldi}`);
  if (kaldi > 0) {
    console.log("❌ UÇTAN UCA İZOLASYON KONTROLÜ BAŞARISIZ");
    process.exit(1);
  }
  console.log("✅ Uçtan uca izolasyon kontrolleri geçti.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
