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
import { ROL, rolNormalize } from "../src/lib/yetki-tanimlar";

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
  kontrol(
    "Demo hesabın rolü kuruluş yöneticisi",
    rolNormalize(demo?.role ?? "") === ROL.tenantAdmin,
    `rol=${demo?.role}`
  );
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

  // 6 — Yetkilendirme (Faz 4)
  console.log("\n6. Yetkilendirme — roller farklı şey görüyor");

  const sayfaGetir = async (email: string, sifre: string, yol: string) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", email);
    await page.fill("#password", sifre);
    await page.click("button[type=submit]");
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}${yol}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const url = page.url();
    const govde = await page.locator("body").innerText();
    await ctx.close();
    return { url, govde };
  };

  // Kuruluş yöneticisi: yönetim ekranlarını görür
  const yoneticiMenu = await sayfaGetir("admin@gezegen.com", "admin123", "/");
  kontrol("Yönetici menüde 'Gruplar' görüyor", yoneticiMenu.govde.includes("Gruplar"));
  kontrol("Yönetici menüde 'Denetim Günlüğü' görüyor", yoneticiMenu.govde.includes("Denetim"));
  kontrol("Yönetici rolü üst çubukta yazıyor", yoneticiMenu.govde.includes("Kuruluş Yöneticisi"));

  const yoneticiGrup = await sayfaGetir("admin@gezegen.com", "admin123", "/gruplar");
  kontrol("Yönetici gruplar sayfasını açabiliyor", !yoneticiGrup.url.includes("/yetkisiz"));

  const yoneticiDenetim = await sayfaGetir("admin@gezegen.com", "admin123", "/denetim");
  kontrol("Yönetici denetim günlüğünü açabiliyor", !yoneticiDenetim.url.includes("/yetkisiz"));

  // Üye: yönetim ekranlarını GÖREMEZ
  const uyeMenu = await sayfaGetir("kullanici@gezegen.com", "user123", "/");
  kontrol("Üye menüde 'Gruplar' GÖRMÜYOR", !uyeMenu.govde.includes("Gruplar"));
  kontrol("Üye menüde 'Denetim Günlüğü' GÖRMÜYOR", !uyeMenu.govde.includes("Denetim Günlüğü"));
  kontrol("Üye rolü üst çubukta yazıyor", uyeMenu.govde.includes("Üye"));

  const uyeGrup = await sayfaGetir("kullanici@gezegen.com", "user123", "/gruplar");
  kontrol(
    "Üye doğrudan URL ile gruplara giremiyor",
    uyeGrup.url.includes("/yetkisiz") || uyeGrup.govde.includes("erişim yetkiniz yok"),
    uyeGrup.url
  );

  const uyeDenetim = await sayfaGetir("kullanici@gezegen.com", "user123", "/denetim");
  kontrol(
    "Üye doğrudan URL ile denetim günlüğüne giremiyor",
    uyeDenetim.url.includes("/yetkisiz") || uyeDenetim.govde.includes("erişim yetkiniz yok")
  );

  // Salt okunur: yazma düğmelerini görmez
  const okuyucu = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/firmalar");
  kontrol("Salt okunur firma listesini görebiliyor", okuyucu.govde.includes("firma listeleniyor"));
  kontrol("Salt okunur rolü üst çubukta yazıyor", okuyucu.govde.includes("Salt Okunur"));

  // Seed'deki "Saha Ekibi" grubu okuyucuya firma.olustur veriyor →
  // grupların yetki EKLEDİĞİNİ uçtan uca kanıtlar.
  kontrol(
    "Grup üyeliği salt okunur kullanıcıya 'Yeni Firma' yetkisi ekliyor",
    okuyucu.govde.includes("Yeni Firma"),
    "grup: Saha Ekibi → firma.olustur"
  );

  const okuyucuRapor = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/raporlar");
  kontrol("Salt okunur raporları görebiliyor", !okuyucuRapor.url.includes("/yetkisiz"));

  // 7 — Admin panel (Faz 5)
  console.log("\n7. Admin panel — platform sınırı");

  const platformKullanici = await prisma.user.findFirst({
    where: { email: "platform@gezegen.com" },
    include: { tenant: true },
  });
  kontrol(
    "Platform yöneticisi hesabı var ve rolü doğru",
    rolNormalize(platformKullanici?.role ?? "") === ROL.platformAdmin,
    `rol=${platformKullanici?.role}`
  );

  const platformPanel = await sayfaGetir("platform@gezegen.com", "platform123", "/admin/kiracilar");
  kontrol(
    "Platform yöneticisi admin paneli açabiliyor",
    !platformPanel.url.includes("/yetkisiz") && platformPanel.govde.includes("Kuruluşlar")
  );
  kontrol(
    "Admin panelde bütün kuruluşlar görünüyor",
    platformPanel.govde.includes("Gezegen Danışmanlık") &&
      platformPanel.govde.includes("Anadolu Yatırım"),
    "kiracılar ötesi görünüm yalnızca burada"
  );

  const platformPaket = await sayfaGetir("platform@gezegen.com", "platform123", "/admin/paketler");
  kontrol(
    "Platform yöneticisi paketleri yönetebiliyor",
    !platformPaket.url.includes("/yetkisiz") && platformPaket.govde.includes("Profesyonel")
  );

  // Kuruluş yöneticisi platform paneline GİREMEZ — doğrudan URL yazsa bile.
  const yoneticiAdmin = await sayfaGetir("admin@gezegen.com", "admin123", "/admin/kiracilar");
  kontrol(
    "Kuruluş yöneticisi admin paneline giremiyor",
    yoneticiAdmin.url.includes("/yetkisiz"),
    yoneticiAdmin.url
  );
  kontrol(
    "Kuruluş yöneticisi başka kuruluşun adını görmüyor",
    !yoneticiAdmin.govde.includes("Anadolu Yatırım")
  );

  const uyeAdmin = await sayfaGetir("kullanici@gezegen.com", "user123", "/admin");
  kontrol("Üye admin paneline giremiyor", uyeAdmin.url.includes("/yetkisiz"), uyeAdmin.url);

  // Davet sayfası giriş gerektirmez ama geçersiz token bilgi sızdırmaz.
  const ctxDavet = await browser.newContext();
  const davetSayfa = await ctxDavet.newPage();
  await davetSayfa.goto(`${BASE}/davet/gecersiz-token-denemesi`, {
    waitUntil: "domcontentloaded",
  });
  await davetSayfa.waitForTimeout(800);
  const davetUrl = davetSayfa.url();
  const davetGovde = await davetSayfa.locator("body").innerText();
  await ctxDavet.close();

  kontrol("Davet sayfası girişsiz açılıyor", !davetUrl.includes("/login"), davetUrl);
  kontrol("Geçersiz davet reddediliyor", davetGovde.includes("Davet geçersiz"));
  kontrol(
    "Geçersiz davette hiçbir kuruluş adı sızmıyor",
    !davetGovde.includes("Gezegen Danışmanlık") && !davetGovde.includes("Anadolu Yatırım")
  );

  // 8 — Satış çekirdeği (Faz 6)
  console.log("\n8. Satış çekirdeği — kişiler, fırsatlar, kanban");

  const yoneticiKisiler = await sayfaGetir("admin@gezegen.com", "admin123", "/kisiler");
  kontrol(
    "Yönetici kişi listesini açabiliyor",
    !yoneticiKisiler.url.includes("/yetkisiz") && yoneticiKisiler.govde.includes("Kişiler")
  );

  const yoneticiFirsatlar = await sayfaGetir("admin@gezegen.com", "admin123", "/firsatlar");
  kontrol(
    "Yönetici satış hattını açabiliyor",
    !yoneticiFirsatlar.url.includes("/yetkisiz") && yoneticiFirsatlar.govde.includes("Fırsatlar")
  );
  kontrol(
    "Kanban aşama sütunları görünüyor",
    yoneticiFirsatlar.govde.includes("Teklif") && yoneticiFirsatlar.govde.includes("Müzakere"),
    "varsayılan hat: Yeni → İletişim → Teklif → Müzakere → Sonuç"
  );
  // NOT: bu etiketler CSS'te `uppercase` ile büyütülür ve `innerText`
  // dönüştürülmüş metni verir; o yüzden karşılaştırma küçük harfe indirilerek
  // yapılır.
  const firsatGovdeKucuk = yoneticiFirsatlar.govde.toLocaleLowerCase("tr");
  kontrol(
    "Hat özeti hesaplanıyor",
    firsatGovdeKucuk.includes("beklenen ciro") && firsatGovdeKucuk.includes("kazanılan")
  );

  const yoneticiAsama = await sayfaGetir("admin@gezegen.com", "admin123", "/firsatlar/asamalar");
  kontrol(
    "Yönetici aşamaları yönetebiliyor",
    !yoneticiAsama.url.includes("/yetkisiz") && yoneticiAsama.govde.includes("Satış Hattı")
  );

  // Aşama yönetimi kuruluş çapında bir karardır — üye erişemez.
  const uyeAsama = await sayfaGetir("kullanici@gezegen.com", "user123", "/firsatlar/asamalar");
  kontrol(
    "Üye aşama yönetimine giremiyor",
    uyeAsama.url.includes("/yetkisiz"),
    uyeAsama.url
  );

  const uyeFirsat = await sayfaGetir("kullanici@gezegen.com", "user123", "/firsatlar");
  kontrol("Üye fırsatları görebiliyor", !uyeFirsat.url.includes("/yetkisiz"));
  kontrol("Üye menüde 'Aşamalar' düğmesini GÖRMÜYOR", !uyeFirsat.govde.includes("Aşamalar"));

  // Salt okunur kullanıcı yazma düğmelerini görmez.
  const okuyucuFirsat = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/firsatlar");
  kontrol("Salt okunur fırsatları görebiliyor", !okuyucuFirsat.url.includes("/yetkisiz"));
  kontrol(
    "Salt okunur 'Yeni Fırsat' düğmesini GÖRMÜYOR",
    !okuyucuFirsat.govde.includes("Yeni Fırsat")
  );

  // İkinci kiracı yalnızca kendi satış hattını görür.
  const ikinciFirsat = await sayfaGetir("admin@anadolu.com", "anadolu123", "/firsatlar");
  kontrol(
    "İkinci kiracı kendi hattını görüyor",
    !ikinciFirsat.url.includes("/yetkisiz") && ikinciFirsat.govde.includes("Fırsatlar")
  );
  kontrol(
    "İkinci kiracı diğerinin firmasını fırsatlarda görmüyor",
    !ikinciFirsat.govde.includes("Gezegen Danışmanlık")
  );

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
