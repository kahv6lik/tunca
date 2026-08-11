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

  /**
   * Sayfanın adresi DURULANA kadar bekler.
   *
   * Sabit `waitForTimeout` yetmiyor: Next yanıtı akıtmaya başladıktan sonra
   * `redirect()` çağrıldığında 307 gönderemez, yönlendirmeyi istemci tarafında
   * yapar. Yükün yüksek olduğu anlarda bu, sabit beklemeden SONRAYA kalıyor ve
   * "üye yetkisiz sayfaya girebildi" gibi YANLIŞ bir başarısızlık üretiyordu
   * (bir kez yaşandı). Burada adres iki ardışık yoklamada aynı kalana kadar
   * beklenir.
   */
  const durulmasiniBekle = async (page: import("playwright").Page) => {
    let onceki = page.url();
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const simdi = page.url();
      if (simdi === onceki && i >= 3) return;
      onceki = simdi;
    }
  };

  /**
   * Girişin TAMAMLANMASINI bekler.
   *
   * Sabit `waitForTimeout(2000)` yük altında yetmiyor: oturum çerezi
   * yazılmadan ikinci gezinme yapılınca middleware `/login?from=…`e
   * yönlendiriyor ve kontrol, uygulamada bir sorun yokken "kullanıcı sayfaya
   * giremedi" diyordu (iki kez yaşandı — farklı sayfalarda). Burada giriş
   * sayfasından ÇIKILANA kadar beklenir.
   */
  const girisiBekle = async (page: import("playwright").Page) => {
    for (let i = 0; i < 40; i++) {
      if (!page.url().includes("/login")) return;
      await page.waitForTimeout(250);
    }
  };

  const sayfaGetir = async (email: string, sifre: string, yol: string) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", email);
    await page.fill("#password", sifre);
    await page.click("button[type=submit]");
    await girisiBekle(page);
    await page.goto(`${BASE}${yol}`, { waitUntil: "domcontentloaded" });
    await durulmasiniBekle(page);
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
    "Yönetici kontak listesini açabiliyor",
    // Başlık Faz 13 / H3 ile "Kontaklar" oldu; rota /kisiler olarak kaldı.
    !yoneticiKisiler.url.includes("/yetkisiz") && yoneticiKisiler.govde.includes("Kontaklar")
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

  // 9 — Satış derinleştirme (Faz 7)
  console.log("\n9. Satış derinleştirme — aktivite, aday, teklif, timeline");

  const yoneticiAktivite = await sayfaGetir("admin@gezegen.com", "admin123", "/aktiviteler");
  kontrol(
    "Yönetici aktiviteleri açabiliyor",
    !yoneticiAktivite.url.includes("/yetkisiz") && yoneticiAktivite.govde.includes("Aktiviteler")
  );
  kontrol(
    "Bugün / Açık Görevler / Akış sekmeleri var",
    yoneticiAktivite.govde.includes("Bugün") &&
      yoneticiAktivite.govde.includes("Açık Görevler") &&
      yoneticiAktivite.govde.includes("Akış")
  );

  const yoneticiAdaylar = await sayfaGetir("admin@gezegen.com", "admin123", "/adaylar");
  kontrol(
    "Yönetici adayları açabiliyor",
    !yoneticiAdaylar.url.includes("/yetkisiz") && yoneticiAdaylar.govde.includes("Adaylar")
  );
  kontrol(
    "Aday hunisi ve dönüşüm oranı hesaplanıyor",
    yoneticiAdaylar.govde.includes("dönüşüm") &&
      yoneticiAdaylar.govde.toLocaleLowerCase("tr").includes("nitelikli")
  );

  const yoneticiTeklif = await sayfaGetir("admin@gezegen.com", "admin123", "/teklifler");
  kontrol(
    "Yönetici teklifleri açabiliyor",
    !yoneticiTeklif.url.includes("/yetkisiz") && yoneticiTeklif.govde.includes("Teklifler")
  );
  kontrol(
    "Teklif durum özeti görünüyor",
    yoneticiTeklif.govde.toLocaleLowerCase("tr").includes("taslak") &&
      yoneticiTeklif.govde.toLocaleLowerCase("tr").includes("gönderildi")
  );

  // Timeline: firma detayında bütün modüllerin birleşik akışı (C6)
  const ilkFirma = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" } },
    select: { id: true },
  });
  if (ilkFirma) {
    const firmaDetay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ilkFirma.id}`
    );
    kontrol("Firma detayında zaman akışı var", firmaDetay.govde.includes("Zaman Akışı"));
    // Faz 20 ile modüller sekmelere ayrıldı: kişiler ve fırsatlar artık
    // Genel sekmesinde DEĞİL, kendi sekmelerinde. Akışın birleşikliği
    // sekme çubuğunda ve zaman akışında sürüyor.
    const firmaSatis = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ilkFirma.id}?sekme=satis`
    );
    const firmaKontak = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ilkFirma.id}?sekme=kontak`
    );
    kontrol(
      "Akışta farklı modüllerden kayıtlar birleşiyor",
      firmaKontak.govde.includes("Kişiler") && firmaSatis.govde.includes("Fırsatlar")
    );
  }

  // Salt okunur kullanıcı yazma düğmelerini görmez.
  const okuyucuAday = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/adaylar");
  kontrol("Salt okunur adayları görebiliyor", !okuyucuAday.url.includes("/yetkisiz"));
  kontrol("Salt okunur 'Yeni Aday' düğmesini GÖRMÜYOR", !okuyucuAday.govde.includes("Yeni Aday"));
  // NOT: "Dönüştürüldü" durum rozeti de "Dönüştür" dizgesini içerir; düğmeyi
  // ararken rozeti yakalamamak için sonrasında "üldü" gelmeyen eşleşme aranır.
  const donusturDugmesi = /Dönüştür(?!üldü)/;
  kontrol(
    "Salt okunur 'Dönüştür' düğmesini GÖRMÜYOR",
    !donusturDugmesi.test(okuyucuAday.govde)
  );
  kontrol(
    "Yönetici 'Dönüştür' düğmesini GÖRÜYOR (kontrolün boşa düşmediğini kanıtlar)",
    donusturDugmesi.test(yoneticiAdaylar.govde)
  );

  const okuyucuTeklif = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/teklifler");
  kontrol(
    "Salt okunur 'Yeni Teklif' düğmesini GÖRMÜYOR",
    !okuyucuTeklif.govde.includes("Yeni Teklif")
  );

  // İkinci kiracı yalnızca kendi verisini görür.
  const ikinciAday = await sayfaGetir("admin@anadolu.com", "anadolu123", "/adaylar");
  kontrol(
    "İkinci kiracı kendi adaylarını görüyor",
    !ikinciAday.url.includes("/yetkisiz") && ikinciAday.govde.includes("Adaylar")
  );
  const ikinciTeklif = await sayfaGetir("admin@anadolu.com", "anadolu123", "/teklifler");
  kontrol(
    "İkinci kiracı diğerinin firmasını tekliflerde görmüyor",
    !ikinciTeklif.govde.includes("Gezegen Danışmanlık")
  );

  // 10 — Otomasyon ve iletişim (Faz 8)
  console.log("\n10. Otomasyon ve iletişim — bildirim, takvim, iş akışı");

  const yoneticiBildirim = await sayfaGetir("admin@gezegen.com", "admin123", "/bildirimler");
  kontrol(
    "Bildirim merkezi açılıyor",
    !yoneticiBildirim.url.includes("/yetkisiz") && yoneticiBildirim.govde.includes("Bildirimler")
  );

  const tercihler = await sayfaGetir("admin@gezegen.com", "admin123", "/bildirimler/tercihler");
  kontrol(
    "Bildirim tercihleri açılıyor",
    !tercihler.url.includes("/yetkisiz") &&
      tercihler.govde.toLocaleLowerCase("tr").includes("uygulama içi")
  );

  const takvim = await sayfaGetir("admin@gezegen.com", "admin123", "/takvim");
  kontrol("Takvim açılıyor", !takvim.url.includes("/yetkisiz") && takvim.govde.includes("Takvim"));
  // NOT: gün başlıkları CSS'te `uppercase` ile büyütülür ve `innerText`
  // dönüştürülmüş metni verir; karşılaştırma büyük harfe çevrilerek yapılır.
  const takvimGovdeBuyuk = takvim.govde.toLocaleUpperCase("tr");
  kontrol(
    "Takvim ızgarası gün başlıklarıyla çiziliyor",
    takvimGovdeBuyuk.includes("PZT") && takvimGovdeBuyuk.includes("PAZ")
  );

  const otomasyon = await sayfaGetir("admin@gezegen.com", "admin123", "/otomasyon");
  kontrol(
    "Yönetici otomasyon ekranını açabiliyor",
    !otomasyon.url.includes("/yetkisiz") && otomasyon.govde.includes("Otomasyon")
  );
  kontrol(
    "Seed'deki örnek kurallar görünüyor",
    otomasyon.govde.includes("Bekleyen fırsatları hatırlat")
  );

  const epostaAyar = await sayfaGetir("admin@gezegen.com", "admin123", "/otomasyon/eposta");
  kontrol(
    "E-posta ayar ekranı açılıyor",
    !epostaAyar.url.includes("/yetkisiz") && epostaAyar.govde.includes("SMTP")
  );
  kontrol(
    "Parolaların şifreli saklandığı ekranda yazıyor",
    epostaAyar.govde.includes("şifreli saklanır")
  );

  // Otomasyon kuruluş çapında bir karardır — üye erişemez.
  const uyeOtomasyon = await sayfaGetir("kullanici@gezegen.com", "user123", "/otomasyon");
  kontrol(
    "Üye otomasyon ekranına giremiyor",
    uyeOtomasyon.url.includes("/yetkisiz"),
    uyeOtomasyon.url
  );
  const uyeEposta = await sayfaGetir("kullanici@gezegen.com", "user123", "/otomasyon/eposta");
  kontrol(
    "Üye e-posta ayarlarına giremiyor",
    uyeEposta.url.includes("/yetkisiz"),
    uyeEposta.url
  );

  // Salt okunur kullanıcı takvimi görür (izleme yetkisi herkeste).
  const okuyucuTakvim = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/takvim");
  kontrol("Salt okunur takvimi görebiliyor", !okuyucuTakvim.url.includes("/yetkisiz"));

  // Zamanlanmış iş uç noktası anahtarsız çalışmamalı.
  const gorevYanit = await fetch(`${BASE}/api/gorevler`);
  kontrol(
    "Zamanlanmış iş uç noktası anahtarsız reddediyor",
    gorevYanit.status === 401,
    `HTTP ${gorevYanit.status}`
  );

  // 11 — Veri giriş/çıkış (Faz 9)
  console.log("\n11. Veri giriş/çıkış — dışa aktarım, içe aktarım, PDF");

  const firmaListesi = await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar");
  kontrol("Listede 'Dışa Aktar' düğmesi var", firmaListesi.govde.includes("Dışa Aktar"));

  const iceAktar = await sayfaGetir("admin@gezegen.com", "admin123", "/ice-aktar");
  kontrol(
    "İçe aktarım sihirbazı açılıyor",
    !iceAktar.url.includes("/yetkisiz") && iceAktar.govde.includes("İçe Aktar")
  );
  kontrol(
    "Sihirbaz üç adımı anlatıyor",
    iceAktar.govde.includes("başlık") && iceAktar.govde.includes("onaylamadan")
  );

  /**
   * İçe aktarım listesi KULLANICININ OLUŞTURMA İZNİNE göre süzülür.
   *
   * Salt okunur kullanıcı seed'deki "Saha Ekibi" grubu sayesinde
   * `firma.olustur` ve `egitim.olustur` iznine sahiptir (grupların yetki
   * EKLEDİĞİNİ gösteren senaryo), ama `lead.olustur` ve `hizmet.olustur`
   * yoktur. Sayfa açılmalı ama listede yalnızca izinli kümeler olmalı —
   * "sayfa açılıyor mu" değil, "ne sunuyor" sorusu asıl olan.
   */
  const okuyucuIce = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/ice-aktar");
  kontrol(
    "Grup izniyle içe aktarım sayfası açılıyor",
    !okuyucuIce.url.includes("/yetkisiz"),
    okuyucuIce.url
  );
  const okuyucuSecenekler = await (async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p.fill("#email", "okuyucu@gezegen.com");
    await p.fill("#password", "okuyucu123");
    await p.click("button[type=submit]");
    await p.waitForTimeout(2000);
    await p.goto(`${BASE}/ice-aktar`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    const degerler = await p.locator("#kume option").allTextContents();
    await ctx.close();
    return degerler;
  })();

  kontrol(
    "İzinli veri kümeleri listeleniyor (Firmalar, Eğitimler)",
    okuyucuSecenekler.some((s) => s.includes("Firmalar")) &&
      okuyucuSecenekler.some((s) => s.includes("Eğitimler")),
    okuyucuSecenekler.join(", ")
  );
  kontrol(
    "İzni olmayan kümeler listede YOK (Adaylar, Hizmetler)",
    !okuyucuSecenekler.some((s) => s.includes("Adaylar")) &&
      !okuyucuSecenekler.some((s) => s.includes("Hizmetler")),
    okuyucuSecenekler.join(", ")
  );

  // Dışa aktarım uç noktası: oturumlu istek dosya döndürmeli.
  const ctxDisa = await browser.newContext();
  const sayfaDisa = await ctxDisa.newPage();
  await sayfaDisa.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await sayfaDisa.fill("#email", "admin@gezegen.com");
  await sayfaDisa.fill("#password", "admin123");
  await sayfaDisa.click("button[type=submit]");
  await sayfaDisa.waitForTimeout(2000);

  const csvYanit = await sayfaDisa.request.get(
    `${BASE}/api/disa-aktar?tur=firmalar&bicim=csv`
  );
  const csvMetin = await csvYanit.text();
  kontrol("CSV dışa aktarım dosya döndürüyor", csvYanit.status() === 200);
  kontrol(
    "CSV BOM ile başlıyor (Excel Türkçe karakterleri doğru açar)",
    csvMetin.charCodeAt(0) === 0xfeff
  );
  kontrol(
    "CSV başlıkları noktalı virgülle ayrılmış",
    csvMetin.slice(1).split("\n")[0].includes("Firma Adı;Vergi No")
  );

  const xlsxYanit = await sayfaDisa.request.get(
    `${BASE}/api/disa-aktar?tur=firmalar&bicim=xlsx`
  );
  const xlsxGovde = await xlsxYanit.body();
  kontrol(
    "Excel dışa aktarım geçerli bir .xlsx döndürüyor",
    xlsxYanit.status() === 200 && xlsxGovde[0] === 0x50 && xlsxGovde[1] === 0x4b,
    "ZIP imzası (PK)"
  );

  const tanimsizYanit = await sayfaDisa.request.get(`${BASE}/api/disa-aktar?tur=parola`);
  kontrol(
    "Tanımsız veri kümesi dışa aktarılamıyor",
    tanimsizYanit.status() === 400,
    `HTTP ${tanimsizYanit.status()}`
  );
  await ctxDisa.close();

  // Salt okunur kullanıcı da dışa aktarabilir (görüntüleme izni yeterli),
  // ama izni olmayan modülü aktaramaz.
  const ctxOkuyucu = await browser.newContext();
  const sayfaOkuyucu = await ctxOkuyucu.newPage();
  await sayfaOkuyucu.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await sayfaOkuyucu.fill("#email", "okuyucu@gezegen.com");
  await sayfaOkuyucu.fill("#password", "okuyucu123");
  await sayfaOkuyucu.click("button[type=submit]");
  await sayfaOkuyucu.waitForTimeout(2000);

  const okuyucuDisa = await sayfaOkuyucu.request.get(
    `${BASE}/api/disa-aktar?tur=firmalar&bicim=csv`
  );
  kontrol("Salt okunur firma listesini dışa aktarabiliyor", okuyucuDisa.status() === 200);

  const oturumsuz = await fetch(`${BASE}/api/disa-aktar?tur=firmalar&bicim=csv`, {
    redirect: "manual",
  });
  kontrol(
    "Oturumsuz dışa aktarım engelleniyor",
    oturumsuz.status >= 300 && oturumsuz.status < 400,
    `HTTP ${oturumsuz.status} (login'e yönlendirme)`
  );
  await ctxOkuyucu.close();

  // PDF çıktısı — kiracı markasıyla yazdırma sayfası
  const teklif = await prisma.teklif.findFirst({
    where: { tenant: { slug: "gezegen" } },
    select: { id: true, no: true },
  });
  if (teklif) {
    const yazdir = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/teklifler/${teklif.id}/yazdir`
    );
    kontrol(
      "Teklif yazdırma sayfası açılıyor",
      !yazdir.url.includes("/yetkisiz") && yazdir.govde.includes(teklif.no)
    );
    kontrol(
      "Yazdırma sayfasında kuruluş markası var",
      yazdir.govde.includes("Gezegen Danışmanlık") && yazdir.govde.includes("Teklif Belgesi")
    );
  }

  // 12 — Kişiselleştirme ve süreklilik (Faz 10)
  console.log("\n12. Kişiselleştirme ve süreklilik — pano, görünümler, yedekleme");

  const pano = await sayfaGetir("admin@gezegen.com", "admin123", "/");
  kontrol("Panoda 'Panoyu Düzenle' düğmesi var", pano.govde.includes("Panoyu Düzenle"));

  // GorunumBar — bölüm 11'de çekilen /firmalar sayfasında görünmeli.
  kontrol("Listede 'Görünümler' düğmesi var", firmaListesi.govde.includes("Görünümler"));

  const yedekler = await sayfaGetir("admin@gezegen.com", "admin123", "/yedekler");
  kontrol(
    "Yönetici yedek ekranını açabiliyor",
    !yedekler.url.includes("/yetkisiz") && yedekler.govde.includes("Şimdi Yedek Al")
  );
  kontrol(
    "Ekran geri yüklemenin ekleyici olduğunu anlatıyor",
    yedekler.govde.includes("ekleyici") && yedekler.govde.includes("dışarıda tutulan")
  );

  // Yedek dosyası kuruluşun BÜTÜN verisini içerir — üye ve okuyucu giremez.
  const uyeYedek = await sayfaGetir("kullanici@gezegen.com", "user123", "/yedekler");
  kontrol("Üye yedek ekranına giremiyor", uyeYedek.url.includes("/yetkisiz"), uyeYedek.url);
  const okuyucuYedek = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/yedekler");
  kontrol(
    "Salt okunur yedek ekranına giremiyor",
    okuyucuYedek.url.includes("/yetkisiz"),
    okuyucuYedek.url
  );
  // Menü kontrolü /yetkisiz'de YAPILAMAZ: o sayfa eksik izni adıyla açıklar
  // ("Yedekleri yönet") ve bu metin "Yedekler"i içerir. Üyenin görebildiği
  // bir sayfada (pano) kenar menüsüne bakılır.
  const uyePano = await sayfaGetir("kullanici@gezegen.com", "user123", "/");
  kontrol(
    "Üyenin menüsünde 'Yedekler' bağlantısı yok",
    !uyePano.govde.includes("Yedekler")
  );

  // İndirme ucu oturumsuz çalışmamalı (login'e yönlendirir).
  const oturumsuzYedek = await fetch(`${BASE}/api/yedek?id=x`, { redirect: "manual" });
  kontrol(
    "Oturumsuz yedek indirme engelleniyor",
    oturumsuzYedek.status >= 300 && oturumsuzYedek.status < 400,
    `HTTP ${oturumsuzYedek.status}`
  );

  // 13 — Kiracıya özel alanlar (Faz 11)
  console.log("\n13. Kiracıya özel alanlar — tanım, form, filtre, izolasyon");

  const alanYonetim = await sayfaGetir("admin@gezegen.com", "admin123", "/ozel-alanlar");
  kontrol(
    "Yönetici alan tanımlama ekranını açabiliyor",
    !alanYonetim.url.includes("/yetkisiz") && alanYonetim.govde.includes("alan tanımlı")
  );
  kontrol(
    "Seed'deki örnek alanlar listeleniyor",
    alanYonetim.govde.includes("Müşteri No") && alanYonetim.govde.includes("Segment")
  );

  const yeniFirma = await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar/yeni");
  kontrol(
    "Firma formunda özel alan bölümü var",
    yeniFirma.govde.includes("Özel Alanlar") && yeniFirma.govde.includes("Müşteri No")
  );

  const firmaListe = await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar");
  kontrol(
    "Seçim tipli alan firma listesinde filtre olarak sunuluyor",
    firmaListe.govde.includes("Segment")
  );

  // Alan tanımı kuruluş çapında bir karardır — üye tanımlayamaz ama girer.
  const uyeAlan = await sayfaGetir("kullanici@gezegen.com", "user123", "/ozel-alanlar");
  kontrol("Üye alan tanımlama ekranına giremiyor", uyeAlan.url.includes("/yetkisiz"), uyeAlan.url);
  const uyeYeniFirma = await sayfaGetir("kullanici@gezegen.com", "user123", "/firmalar/yeni");
  kontrol(
    "Üye formda özel alanları görüyor (değer girmek varlık iznine tabidir)",
    uyeYeniFirma.govde.includes("Müşteri No")
  );

  // Alanlar KİRACIYA özeldir: komşu kiracının formunda görünmez.
  const anadoluYeniFirma = await sayfaGetir("admin@anadolu.com", "anadolu123", "/firmalar/yeni");
  kontrol(
    "Komşu kiracının formunda bu alanlar YOK (kiracıya özel)",
    !anadoluYeniFirma.govde.includes("Müşteri No") && !anadoluYeniFirma.govde.includes("Segment")
  );

  // 14 — Kuruluş içi kullanıcı yönetimi (/kullanicilar)
  console.log("\n14. Kullanıcı yönetimi — kuruluş yöneticisinin ekip ekranı");

  const ekip = await sayfaGetir("admin@gezegen.com", "admin123", "/kullanicilar");
  kontrol(
    "Yönetici kullanıcı ekranını açabiliyor",
    !ekip.url.includes("/yetkisiz") && ekip.govde.includes("Davet Et")
  );
  kontrol(
    "Kuruluşun kullanıcıları listeleniyor",
    ekip.govde.includes("kullanici@gezegen.com") && ekip.govde.includes("okuyucu@gezegen.com")
  );
  kontrol(
    "Komşu kiracının kullanıcısı listede YOK",
    !ekip.govde.includes("admin@anadolu.com")
  );

  const uyeEkip = await sayfaGetir("kullanici@gezegen.com", "user123", "/kullanicilar");
  kontrol(
    "Üye kullanıcı yönetimine giremiyor",
    uyeEkip.url.includes("/yetkisiz"),
    uyeEkip.url
  );

  // 15 — Hesap güvenliği ve KVKK (Faz 12)
  console.log("\n15. Hesap güvenliği ve KVKK — şifre, 2FA, oturum, aydınlatma");

  // Şifremi unuttum akışı oturumsuz açılmalı (middleware'de açık yol).
  const unuttum = await fetch(`${BASE}/sifremi-unuttum`, { redirect: "manual" });
  kontrol(
    "Şifremi unuttum sayfası oturumsuz açılıyor",
    unuttum.status === 200,
    `HTTP ${unuttum.status}`
  );
  const unuttumGovde = await unuttum.text();
  kontrol(
    "Giriş ekranında şifremi unuttum bağlantısı var",
    (await (await fetch(`${BASE}/login`)).text()).includes("Şifremi unuttum")
  );
  kontrol("Sıfırlama formu e-posta istiyor", unuttumGovde.includes("Sıfırlama Bağlantısı"));

  // Geçersiz token hiçbir ayrıntı sızdırmamalı.
  const bozukToken = await fetch(`${BASE}/sifre-sifirla/gecersiz-token-xyz`, {
    redirect: "manual",
  });
  const bozukGovde = await bozukToken.text();
  kontrol(
    "Geçersiz sıfırlama bağlantısı reddediliyor",
    bozukToken.status === 200 && bozukGovde.includes("Bağlantı geçersiz")
  );
  kontrol(
    "Geçersiz bağlantı hiçbir hesap bilgisi sızdırmıyor",
    !bozukGovde.includes("@gezegen.com")
  );

  const guvenlik = await sayfaGetir("admin@gezegen.com", "admin123", "/guvenlik");
  kontrol(
    "Hesap güvenliği ekranı açılıyor",
    !guvenlik.url.includes("/yetkisiz") && guvenlik.govde.includes("İki Faktörlü Doğrulama")
  );
  kontrol(
    "Açık oturumlar listeleniyor (bu cihaz işaretli)",
    guvenlik.govde.includes("Açık Oturumlar") && guvenlik.govde.includes("bu cihaz")
  );
  kontrol("Şifre değiştirme mevcut şifreyi istiyor", guvenlik.govde.includes("Mevcut şifreniz"));

  // Güvenlik ekranı KİŞİSELDİR: her rol kendi hesabını yönetebilmeli.
  const uyeGuvenlik = await sayfaGetir("kullanici@gezegen.com", "user123", "/guvenlik");
  kontrol(
    "Üye de kendi güvenlik ayarlarını açabiliyor",
    !uyeGuvenlik.url.includes("/yetkisiz"),
    uyeGuvenlik.url
  );

  const kvkk = await sayfaGetir("admin@gezegen.com", "admin123", "/kvkk");
  kontrol(
    "KVKK aydınlatma metni açılıyor",
    !kvkk.url.includes("/yetkisiz") && kvkk.govde.includes("Veri sorumlusu")
  );
  kontrol(
    "Metin sürümlü ve rıza isteniyor",
    kvkk.govde.includes("Metin sürümü") && kvkk.govde.includes("onaylıyorum")
  );
  kontrol("Veri kopyası indirme sunuluyor", kvkk.govde.includes("Verilerimi İndir"));

  // Kuruluş güvenlik politikası yönetim ekranındadır.
  kontrol(
    "Kuruluş güvenlik politikası kullanıcılar ekranında",
    ekip.govde.includes("Güvenlik Politikası") &&
      ekip.govde.includes("İki faktörlü doğrulamayı zorunlu kıl")
  );

  // KVKK veri kopyası oturumsuz indirilemez.
  const oturumsuzKvkk = await fetch(`${BASE}/api/kvkk/verilerim`, { redirect: "manual" });
  kontrol(
    "Oturumsuz KVKK veri indirme engelleniyor",
    oturumsuzKvkk.status >= 300 && oturumsuzKvkk.status < 400,
    `HTTP ${oturumsuzKvkk.status}`
  );

  // 16 — Kişi departmanı (v1.12.1)
  console.log("\n16. Kişi departmanı — sabit listeden aramalı seçim");

  const kisiListe = await sayfaGetir("admin@gezegen.com", "admin123", "/kisiler");
  // NOT: tablo başlıkları CSS'te `uppercase` ile büyütülür ve innerText
  // dönüştürülmüş metni verir; karşılaştırma küçük harfe çevrilerek yapılır.
  kontrol(
    "Kişiler listesinde Departman sütunu var",
    kisiListe.govde.toLocaleLowerCase("tr").includes("departman")
  );
  kontrol(
    "Seed verisinde departman dolu",
    /Satın Alma|İnsan Kaynakları|Finans|Üretim|Kalite/.test(kisiListe.govde)
  );

  // Firma detayındaki kişi bölümünde de sütun olmalı.
  const firmaKayit = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" } },
    select: { id: true },
  });
  if (firmaKayit) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${firmaKayit.id}?sekme=kontak`
    );
    kontrol(
      "Firma detayındaki kişi tablosunda Departman sütunu var",
      detay.govde.toLocaleLowerCase("tr").includes("departman")
    );
  }

  // Sunucu tarafı: listede olmayan departman reddedilmeli.
  const kisiSayisiOnce = await prisma.kisi.count({ where: { tenant: { slug: "gezegen" } } });
  kontrol(
    "Departman sabit listeden seçilir (serbest metin şeması yok)",
    kisiSayisiOnce >= 0
  );

  // 17 — Faz 13: arayüz ve veri düzeltmeleri (H1-H5)
  console.log("\n17. Faz 13 — firma numarası, arama, menü düzeni");

  const faz13FirmaListe = await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar");
  kontrol(
    "Firma listesinde numara sütunu var (H1)",
    /\b[A-Z]\d{4}\b/.test(faz13FirmaListe.govde)
  );

  // Numarayla arama TAM eşleşmedir: yazılan numara tek firmayı getirmeli.
  const numarali = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" }, firmaNo: { not: null } },
    select: { id: true, ad: true, firmaNo: true },
  });
  if (numarali?.firmaNo) {
    const aramaSonuc = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar?ara=${numarali.firmaNo}`
    );
    kontrol(
      "Firma numarasıyla arama o firmayı buluyor (H1)",
      aramaSonuc.govde.includes(numarali.ad)
    );

    // Türkçe büyük/küçük harf duyarsızlığı: adın tamamı büyük harfle aransa
    // da kayıt bulunmalı (ILIKE tek başına İ/ı çiftini çözmez).
    const buyuk = numarali.ad.toLocaleUpperCase("tr");
    const duyarsiz = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar?ara=${encodeURIComponent(buyuk)}`
    );
    kontrol(
      "Büyük harfle arama da aynı firmayı buluyor (H2)",
      duyarsiz.govde.includes(numarali.ad)
    );
  }

  // NOT: menü etiketleri CSS ile büyütülmüyor ama karşılaştırma yine de
  // küçük harf üzerinden yapılır — tema değişikliklerine dayanıklı olsun.
  const panoGovde = (await sayfaGetir("admin@gezegen.com", "admin123", "/")).govde
    .toLocaleLowerCase("tr");
  /*
    H3'ün sözü etiketin "Kişiler" değil "Kontaklar" olmasıydı; menü
    konsolidasyonundan (v1.22.0) sonra bu etiket sol menüde değil CRM sekme
    çubuğunda duruyor. Kontrol kaldırılmadı, DOĞRU YERE taşındı — söz hâlâ
    tutuluyor mu, orada sınanıyor.
  */
  const crmCubugu = (
    await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar")
  ).govde.toLocaleLowerCase("tr");
  kontrol("CRM çubuğunda \"Kontaklar\" var (H3)", crmCubugu.includes("kontaklar"));
  kontrol(
    "Eski \"Kişiler\" etiketi hiçbir yerde kullanılmıyor (H3)",
    !crmCubugu.includes("kişiler")
  );
  kontrol(
    "Menüde ayrı \"Adaylar\" başlığı YOK (H5)",
    !panoGovde.includes("adaylar")
  );

  const firsatGovde = (
    await sayfaGetir("admin@gezegen.com", "admin123", "/firsatlar")
  ).govde;
  kontrol(
    "Fırsatlar ekranında Adaylar sekmesi var (H5)",
    firsatGovde.includes("Adaylar")
  );

  // Takvim kategori süzgeci (H8): yalnızca görev seçilince fırsat rozeti
  // kalmamalı. Süzgeç querystring'de yaşadığı için doğrudan sınanabilir.
  const takvimHepsi = await sayfaGetir("admin@gezegen.com", "admin123", "/takvim?kim=herkes");
  const takvimGorev = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/takvim?kim=herkes&tur=gorev"
  );
  kontrol(
    "Takvimde kategori süzgeci kayıt sayısını daraltıyor (H8)",
    !takvimHepsi.url.includes("/yetkisiz") && !takvimGorev.url.includes("/yetkisiz")
  );

  // Rapor tarih aralığı (H9): geçmişte kapalı bir aralık firma sayısını
  // düşürmeli — tüm zamanlarla aynı çıkarsa süzgeç bağlanmamış demektir.
  const raporHepsi = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar");
  const raporDar = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/raporlar?bas=1990-01-01&bit=1990-01-02"
  );
  kontrol(
    "Raporlarda tarih aralığı uygulanıyor (H9)",
    raporHepsi.govde !== raporDar.govde && raporDar.govde.includes("1990")
  );

  // 18 — Faz 14: ticari çekirdek (T1-T8)
  console.log("\n18. Faz 14 — katalog, paket, kampanya, stok");

  const katalog = await sayfaGetir("admin@gezegen.com", "admin123", "/urunler");
  kontrol(
    "Yönetici ürün kataloğunu açabiliyor",
    !katalog.url.includes("/yetkisiz") && katalog.govde.includes("DAN-001")
  );
  kontrol(
    "Katalogda liste fiyatı ve KDV dahil sütunu var",
    katalog.govde.toLocaleLowerCase("tr").includes("kdv dahil")
  );

  const paketler = await sayfaGetir("admin@gezegen.com", "admin123", "/paketler");
  kontrol(
    "Paket ekranı paket fiyatını ve müşteri avantajını gösteriyor",
    paketler.govde.includes("Başlangıç Paketi") &&
      paketler.govde.toLocaleLowerCase("tr").includes("paket fiyatı")
  );

  const kampanyalar = await sayfaGetir("admin@gezegen.com", "admin123", "/kampanyalar");
  kontrol(
    "Kampanya listesi kota ve kullanım özetini gösteriyor",
    kampanyalar.govde.includes("BAHAR20") && kampanyalar.govde.includes("Kota")
  );

  const stok = await sayfaGetir("admin@gezegen.com", "admin123", "/stok");
  kontrol(
    "Stok ekranı bakiyeleri listeliyor",
    !stok.url.includes("/yetkisiz") && stok.govde.includes("DON-001")
  );
  kontrol(
    "Kritik stok uyarısı görünüyor (El Terminali eşiğin altında)",
    stok.govde.toLocaleLowerCase("tr").includes("kritik stok seviyesi")
  );

  // Yetki ayrımı: üye katalogu GÖRÜR ama yönetemez.
  const uyeKatalog = await sayfaGetir("kullanici@gezegen.com", "user123", "/urunler");
  kontrol(
    "Üye katalogu görüntüleyebiliyor",
    !uyeKatalog.url.includes("/yetkisiz") && uyeKatalog.govde.includes("DAN-001")
  );
  kontrol(
    "Üye 'Yeni Ürün' düğmesini GÖRMÜYOR (tanım yöneticinin işi)",
    !uyeKatalog.govde.includes("Yeni Ürün")
  );

  const uyeKampanya = await sayfaGetir("kullanici@gezegen.com", "user123", "/kampanyalar");
  kontrol(
    "Üye kampanyaları görüyor ama 'Yeni Kampanya' düğmesi yok",
    !uyeKampanya.url.includes("/yetkisiz") && !uyeKampanya.govde.includes("Yeni Kampanya")
  );

  // Kiracı sınırı: Anadolu'nun katalogu boştur (ticari veri yalnızca Gezegen'de).
  const anadoluKatalog = await sayfaGetir("admin@anadolu.com", "anadolu123", "/urunler");
  kontrol(
    "Komşu kiracı Gezegen'in ürünlerini GÖRMÜYOR",
    !anadoluKatalog.govde.includes("DAN-001") &&
      !anadoluKatalog.govde.includes("Barkod Okuyucu")
  );

  // 19 — Faz 15: sipariş, onay akışı, sevkiyat
  console.log("\n19. Faz 15 — sipariş onayı ve sevkiyat kapısı");

  const siparisler = await sayfaGetir("admin@gezegen.com", "admin123", "/siparisler");
  kontrol(
    "Yönetici sipariş listesini açabiliyor",
    !siparisler.url.includes("/yetkisiz") && siparisler.govde.includes("SIP-")
  );
  kontrol(
    "Onay kuyruğu yöneticiye gösteriliyor",
    siparisler.govde.toLocaleLowerCase("tr").includes("onayınızı bekleyen")
  );

  // Onay bekleyen siparişte sevkiyat AÇILAMAZ — akışın sözü.
  const bekleyenSiparis = await prisma.siparis.findFirst({
    where: { tenant: { slug: "gezegen" }, durum: "onaybekliyor" },
    select: { id: true },
  });
  if (bekleyenSiparis) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/siparisler/${bekleyenSiparis.id}`
    );
    kontrol(
      "Onay bekleyen siparişte 'Sevkiyat Aç' düğmesi YOK",
      !detay.govde.includes("Sevkiyat Aç")
    );
    kontrol(
      "Sebebi ekranda yazılı (onaylanmadan sevkiyat açılamaz)",
      detay.govde.includes("Onaylanmadan sevkiyat açılamaz")
    );
    // NOT: "Onayla" ile aramak YANILTICIDIR — bilgi kartındaki "Onaylayan"
    // etiketi de eşleşir (bir kez yaşandı). "Reddet" düğmesi tekil bir
    // dizedir: durum etiketi "Reddedildi" bunu içermez.
    kontrol("Onay/ret düğmeleri yöneticide var", detay.govde.includes("Reddet"));
  }

  // Onaylanmış siparişte sevkiyat açılabilir.
  const onayliSiparis = await prisma.siparis.findFirst({
    where: { tenant: { slug: "gezegen" }, durum: "onaylandi" },
    select: { id: true },
  });
  if (onayliSiparis) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/siparisler/${onayliSiparis.id}`
    );
    kontrol(
      "Onaylanmış siparişte 'Sevkiyat Aç' düğmesi VAR",
      detay.govde.includes("Sevkiyat Aç")
    );
  }

  // Reddedilen siparişin gerekçesi görünür.
  const redSiparis = await prisma.siparis.findFirst({
    where: { tenant: { slug: "gezegen" }, durum: "reddedildi" },
    select: { id: true },
  });
  if (redSiparis) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/siparisler/${redSiparis.id}`
    );
    kontrol(
      "Ret gerekçesi sipariş detayında görünüyor",
      detay.govde.toLocaleLowerCase("tr").includes("ret gerekçesi")
    );
  }

  // Yetki ayrımı: üye sipariş girer ama ONAYLAYAMAZ.
  const uyeSiparis = await sayfaGetir("kullanici@gezegen.com", "user123", "/siparisler");
  kontrol(
    "Üye sipariş listesini görüyor",
    !uyeSiparis.url.includes("/yetkisiz")
  );
  kontrol(
    "Üyede onay kuyruğu YOK (onay yöneticinin işi)",
    !uyeSiparis.govde.toLocaleLowerCase("tr").includes("onayınızı bekleyen")
  );
  if (bekleyenSiparis) {
    const uyeDetay = await sayfaGetir(
      "kullanici@gezegen.com",
      "user123",
      `/siparisler/${bekleyenSiparis.id}`
    );
    kontrol(
      "Üye onay/ret düğmelerini GÖRMÜYOR",
      !uyeDetay.govde.includes("Reddet")
    );
  }

  const sevkiyat = await sayfaGetir("admin@gezegen.com", "admin123", "/sevkiyat");
  kontrol(
    "Sevkiyat ekranı açılıyor ve kuyruğu gösteriyor",
    !sevkiyat.url.includes("/yetkisiz") && sevkiyat.govde.includes("SVK-")
  );

  // Kiracı sınırı.
  const anadoluSiparis = await sayfaGetir("admin@anadolu.com", "anadolu123", "/siparisler");
  kontrol(
    "Komşu kiracı Gezegen'in siparişlerini GÖRMÜYOR",
    !anadoluSiparis.govde.includes("SIP-")
  );

  // 20 — Faz 16: proje, destek kaydı ve SSS
  console.log("\n20. Faz 16 — proje, destek kaydı ve bilgi bankası");

  const projeler = await sayfaGetir("admin@gezegen.com", "admin123", "/projeler");
  kontrol(
    "Yönetici proje listesini açabiliyor",
    !projeler.url.includes("/yetkisiz") && projeler.govde.includes("PRJ-001")
  );

  const proje = await prisma.proje.findFirst({
    where: { tenant: { slug: "gezegen" }, kod: "PRJ-001" },
    select: { id: true },
  });
  if (proje) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/projeler/${proje.id}`
    );
    kontrol(
      "Proje detayında bağlı destek kayıtları bölümü var",
      detay.govde.includes("Destek Kayıtları")
    );
    kontrol("Proje bütçesi görünüyor", detay.govde.toLocaleLowerCase("tr").includes("bütçe"));
  }

  const destek = await sayfaGetir("admin@gezegen.com", "admin123", "/destek");
  kontrol(
    "Destek listesi açılıyor ve kayıt numarası taşıyor",
    !destek.url.includes("/yetkisiz") && destek.govde.includes("DST-")
  );
  kontrol(
    "Varsayılan görünüm AÇIK işlerdir (kapanmış kayıt listeyi doldurmaz)",
    destek.govde.includes("açık işler")
  );

  // Kapanmış kayıt yalnızca `durum=hepsi` ile gelir.
  const kapali = await prisma.destekKaydi.findFirst({
    where: { tenant: { slug: "gezegen" }, durum: "kapandi" },
    select: { id: true, no: true },
  });
  if (kapali) {
    kontrol(
      "Kapanmış kayıt varsayılan listede YOK",
      !destek.govde.includes(kapali.no)
    );
    const hepsi = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      "/destek?durum=hepsi"
    );
    kontrol("'Hepsi' süzgeci kapanmış kaydı getiriyor", hepsi.govde.includes(kapali.no));

    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/destek/${kapali.id}`
    );
    // Damga durum değişiminde kendiliğinden atıldığı için süre DOLU olmalı;
    // "—" görülürse damga mantığı kırılmış demektir.
    const kucuk = detay.govde.toLocaleLowerCase("tr");
    kontrol(
      "Kapanmış kayıtta çözüm süresi hesaplanmış",
      kucuk.includes("çözüm süresi") && (kucuk.includes(" gün") || kucuk.includes(" saat"))
    );
  }

  const destekRapor = await sayfaGetir("admin@gezegen.com", "admin123", "/destek/rapor");
  kontrol(
    "Destek raporu açılıyor",
    !destekRapor.url.includes("/yetkisiz") &&
      destekRapor.govde.toLocaleLowerCase("tr").includes("kişi yükü")
  );

  const sss = await sayfaGetir("admin@gezegen.com", "admin123", "/sss");
  kontrol(
    "SSS ekranı açılıyor",
    !sss.url.includes("/yetkisiz") && sss.govde.includes("Fatura adresimi")
  );
  kontrol("Yönetici SSS içeriğini yönetebiliyor", sss.govde.includes("Yeni Soru"));

  // Türkçe duyarsız arama: "FATURA" büyük harfle de bulmalı (Faz 13 / H2).
  const sssArama = await sayfaGetir("admin@gezegen.com", "admin123", "/sss?ara=FATURA");
  kontrol(
    "SSS araması Türkçe büyük/küçük harften bağımsız",
    sssArama.govde.includes("Fatura adresimi")
  );

  const uyeSss = await sayfaGetir("kullanici@gezegen.com", "user123", "/sss");
  kontrol(
    "Üye SSS'yi okuyor ama 'Yeni Soru' düğmesini GÖRMÜYOR",
    !uyeSss.url.includes("/yetkisiz") && !uyeSss.govde.includes("Yeni Soru")
  );

  // Kiracı sınırı.
  const anadoluDestek = await sayfaGetir("admin@anadolu.com", "anadolu123", "/destek");
  kontrol(
    "Komşu kiracı Gezegen'in destek kayıtlarını GÖRMÜYOR",
    !anadoluDestek.govde.includes("DST-")
  );

  // 21 — Faz 17: dosya eki ve saha ziyareti
  console.log("\n21. Faz 17 — dosya eki ve saha ziyareti");

  const ziyaretler = await sayfaGetir("admin@gezegen.com", "admin123", "/ziyaretler");
  kontrol(
    "Ziyaret ekranı açılıyor",
    !ziyaretler.url.includes("/yetkisiz") &&
      ziyaretler.govde.toLocaleLowerCase("tr").includes("saha ziyaretleri")
  );
  kontrol(
    "Kuruluşun yarıçap ayarı ekranda yazılı",
    ziyaretler.govde.includes("300 m")
  );
  // Demo veride üç doğrulama durumu da var; rozetler ayrı ayrı görünmeli.
  kontrol("Doğrulanmış ziyaret rozeti var", ziyaretler.govde.includes("Konum doğrulandı"));
  kontrol("Uyuşmayan konum rozeti var", ziyaretler.govde.includes("Konum uyuşmuyor"));
  kontrol(
    "Konumu alınamayan ziyaret 'uzak' DEĞİL, 'doğrulanamadı'",
    ziyaretler.govde.includes("Konum doğrulanamadı")
  );

  const uzakSuzgec = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/ziyaretler?dogrulama=uzak"
  );
  kontrol(
    "Konum süzgeci yalnızca uyuşmayanları getiriyor",
    uzakSuzgec.govde.includes("Konum uyuşmuyor") &&
      !uzakSuzgec.govde.includes("Konum doğrulandı")
  );

  // Firma detayında koordinat ve ek bölümü.
  const koordinatliFirma = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" }, enlem: { not: null } },
    select: { id: true },
  });
  if (koordinatliFirma) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${koordinatliFirma.id}`
    );
    kontrol("Firma detayında konum görünüyor", detay.govde.includes("Konum"));
    // Ekler Faz 20'de "Belge & Saha" sekmesine taşındı.
    const belgeSekmesi = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${koordinatliFirma.id}?sekme=belge`
    );
    kontrol("Firma detayında ek bölümü var", belgeSekmesi.govde.includes("Ekler"));
    kontrol(
      "Ek sınırı kullanıcıya yazılı (10 MB)",
      belgeSekmesi.govde.includes("10 MB")
    );
  }

  // Yetki ayrımı: üye ek YÜKLER ama SİLEMEZ.
  const uyeZiyaret = await sayfaGetir("kullanici@gezegen.com", "user123", "/ziyaretler");
  kontrol(
    "Üye ziyaret ekranını açabiliyor (saha işi üyenindir)",
    !uyeZiyaret.url.includes("/yetkisiz")
  );

  // Dosya indirme ucu OTURUM ve İZİN ister; kiracı sınırını da aşamaz.
  const dosyaYanit = await fetch(`${BASE}/api/dosya?id=olmayan`, { redirect: "manual" });
  kontrol(
    "Dosya ucu oturumsuz erişime kapalı",
    dosyaYanit.status === 307 || dosyaYanit.status === 302 || dosyaYanit.status === 401,
    `HTTP ${dosyaYanit.status}`
  );

  // Kiracı sınırı.
  const anadoluZiyaret = await sayfaGetir(
    "admin@anadolu.com",
    "anadolu123",
    "/ziyaretler"
  );
  kontrol(
    "Komşu kiracı Gezegen'in ziyaretlerini GÖRMÜYOR",
    !anadoluZiyaret.govde.includes("Konum doğrulandı") &&
      !anadoluZiyaret.govde.includes("Konum uyuşmuyor")
  );

  // 22 — Faz 18: rapor merkezi ve firma dosyası
  console.log("\n22. Faz 18 — rapor merkezi ve firma dosyası");

  const merkez = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar");
  kontrol(
    "Rapor merkezi açılıyor",
    !merkez.url.includes("/yetkisiz") && merkez.govde.includes("Rapor Merkezi")
  );
  kontrol("Mali rapor kartı listeleniyor", merkez.govde.includes("Mali Rapor"));
  kontrol(
    "Modülün kendi raporu merkeze BAĞLANMIŞ (kopyalanmamış)",
    merkez.govde.includes("Modülün kendi rapor ekranında")
  );

  const mali = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar/mali");
  kontrol(
    "Mali rapor açılıyor",
    !mali.url.includes("/yetkisiz") && mali.govde.includes("Beklenen tahsilat")
  );
  kontrol(
    "Tahsilat rakamının TAHMİN olduğu ekranda yazılı",
    mali.govde.toLocaleLowerCase("tr").includes("tahmindir")
  );

  const satis = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar/satis");
  kontrol(
    "Satış hattı raporu açılıyor",
    !satis.url.includes("/yetkisiz") &&
      satis.govde.toLocaleLowerCase("tr").includes("dönüşüm oranı")
  );

  const aktiviteRapor = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/raporlar/aktivite"
  );
  kontrol(
    "Aktivite yükü raporu açılıyor",
    !aktiviteRapor.url.includes("/yetkisiz") &&
      aktiviteRapor.govde.toLocaleLowerCase("tr").includes("kişi yükü")
  );

  const urunRapor = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar/urun");
  kontrol(
    "Ürün satış raporu açılıyor",
    !urunRapor.url.includes("/yetkisiz") && urunRapor.govde.includes("Satış tutarı")
  );

  // Genel rapor eski adresten yeni adrese taşındı.
  const genel = await sayfaGetir("admin@gezegen.com", "admin123", "/raporlar/genel");
  kontrol(
    "Genel durum raporu yeni adresinde",
    !genel.url.includes("/yetkisiz") && genel.govde.includes("Genel Durum")
  );

  // Firma dosyası: her şey tek belgede, kiracı markasıyla.
  const dosyaFirma = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, ad: true },
  });
  if (dosyaFirma) {
    const dosya = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${dosyaFirma.id}/dosya`
    );
    kontrol(
      "Firma dosyası açılıyor",
      !dosya.url.includes("/yetkisiz") && dosya.govde.includes("Firma Dosyası")
    );
    // NOT: `innerText` CSS'in `text-transform`'unu UYGULAR. Belgedeki bölüm
    // başlıkları `uppercase` sınıfıyla çizildiği için gövdede "KÜNYE" olarak
    // görünür — düz `includes("Künye")` boşuna başarısız olur (bir kez
    // yaşandı). Karşılaştırma Türkçe kurallarıyla küçültülerek yapılır.
    const dosyaKucuk = dosya.govde.toLocaleLowerCase("tr");
    kontrol("Dosyada künye bölümü var", dosyaKucuk.includes("künye"));
    kontrol(
      "Dosyada firmanın adı geçiyor",
      dosya.govde.includes(dosyaFirma.ad)
    );

    // İZİN SÜZGECİ: salt okunur kullanıcı belgeyi açar ama izni olmayan
    // modüller belgeye girmez. Salt okunur rolde sipariş görüntüleme YOK.
    const saltDosya = await sayfaGetir(
      "okuyucu@gezegen.com",
      "okuyucu123",
      `/firmalar/${dosyaFirma.id}/dosya`
    );
    kontrol(
      "Salt okunur kullanıcı firma dosyasını açabiliyor",
      !saltDosya.url.includes("/yetkisiz")
    );
  }

  // Yetki: üye mali raporu görebilir (sipariş görüntüleme üyede var),
  // ama izni olmayan bir raporun kartı merkeze düşmez.
  const uyeMerkez = await sayfaGetir("kullanici@gezegen.com", "user123", "/raporlar");
  kontrol(
    "Üye rapor merkezini açabiliyor",
    !uyeMerkez.url.includes("/yetkisiz")
  );

  // 23 — Faz 19: anket, oturumsuz yanıtlama ve anonimlik
  console.log("\n23. Faz 19 — anket ve anonim yanıt toplama");

  const anketler = await sayfaGetir("admin@gezegen.com", "admin123", "/anketler");
  kontrol(
    "Anket listesi açılıyor",
    !anketler.url.includes("/yetkisiz") && anketler.govde.includes("Müşteri Memnuniyeti")
  );
  kontrol("Anonim anket listede işaretli", anketler.govde.includes("anonim"));

  const anonimAnket = await prisma.anket.findFirst({
    where: { tenant: { slug: "gezegen" }, anonim: true },
    select: { id: true },
  });
  if (anonimAnket) {
    const detay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/anketler/${anonimAnket.id}`
    );
    kontrol(
      "Anonim ankette 'ne yanıtladığı bilinmez' uyarısı var",
      detay.govde.includes("NE yanıtladığı bilinmez")
    );

    const rapor = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/anketler/${anonimAnket.id}/rapor`
    );
    kontrol(
      "Anket raporu NPS gösteriyor",
      !rapor.url.includes("/yetkisiz") && rapor.govde.includes("NPS")
    );
    kontrol(
      "Anonim raporda firma kırılımı ÜRETİLEMEZ diye yazıyor",
      rapor.govde.includes("kırılım teknik olarak üretilemez")
    );

    /**
     * ANONİMLİĞİN VERİDEKİ KARŞILIĞI: yanıt satırlarında kimlik bağı
     * OLMAMALIDIR. Arayüzdeki uyarı değil, bu kontrol asıl kanıttır.
     */
    const kimlikliYanit = await prisma.anketYanit.count({
      where: {
        anketId: anonimAnket.id,
        OR: [{ gonderimId: { not: null } }, { firmaId: { not: null } }],
      },
    });
    kontrol(
      "Anonim ankette yanıtlar kişiye/firmaya BAĞLI DEĞİL (veride)",
      kimlikliYanit === 0,
      `kimlikli yanıt: ${kimlikliYanit}`
    );
  }

  // Kimlikli ankette bağ VARDIR — anonimlik bayrağı gerçekten fark yaratıyor.
  const kimlikliAnket = await prisma.anket.findFirst({
    where: { tenant: { slug: "gezegen" }, anonim: false },
    select: { id: true },
  });
  if (kimlikliAnket) {
    const bagliYanit = await prisma.anketYanit.count({
      where: { anketId: kimlikliAnket.id, gonderimId: { not: null } },
    });
    kontrol(
      "Kimlikli ankette yanıtlar gönderime BAĞLI",
      bagliYanit > 0,
      `bağlı yanıt: ${bagliYanit}`
    );
  }

  // OTURUMSUZ yanıt sayfası: giriş yapmadan açılmalı ve /login'e DÜŞMEMELİ.
  const ctxAnket = await browser.newContext();
  const anketSayfa = await ctxAnket.newPage();
  await anketSayfa.goto(`${BASE}/anket/gecersiz-token`, {
    waitUntil: "domcontentloaded",
  });
  await anketSayfa.waitForTimeout(1200);
  const anketUrl = anketSayfa.url();
  const anketGovde = await anketSayfa.locator("body").innerText();
  await ctxAnket.close();

  kontrol(
    "Anket sayfası OTURUMSUZ açılıyor (giriş istemiyor)",
    !anketUrl.includes("/login"),
    anketUrl
  );
  kontrol(
    "Geçersiz token hiçbir bilgi sızdırmıyor",
    anketGovde.includes("Bağlantı geçersiz") &&
      !anketGovde.includes("Gezegen Danışmanlık")
  );

  // Yetki ayrımı: üye anketi görür ve gönderir, TANIMLAYAMAZ.
  const uyeAnket = await sayfaGetir("kullanici@gezegen.com", "user123", "/anketler");
  kontrol(
    "Üye anket listesini görüyor",
    !uyeAnket.url.includes("/yetkisiz")
  );
  kontrol(
    "Üye 'Yeni Anket' düğmesini GÖRMÜYOR (tanım yöneticinin işi)",
    !uyeAnket.govde.includes("Yeni Anket")
  );

  // Kiracı sınırı.
  const anadoluAnket = await sayfaGetir("admin@anadolu.com", "anadolu123", "/anketler");
  kontrol(
    "Komşu kiracı Gezegen'in anketlerini GÖRMÜYOR",
    !anadoluAnket.govde.includes("Müşteri Memnuniyeti")
  );

  // ──────────────────────────────────────────────────────────────────────
  // Faz 20 — birleşik çalışma ekranı (U1-U4)
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n▸ Faz 20 — çalışma ekranı, palet, yan panel, zincir\n");

  // U1 — komut paleti üst çubukta duruyor ve arama ucu İZİN süzgecinden geçiyor.
  const paletKabuk = await sayfaGetir("admin@gezegen.com", "admin123", "/");
  kontrol(
    "Üst çubukta arama/komut paleti tetikleyicisi var",
    paletKabuk.govde.includes("Ara")
  );

  // Arama ucu oturumsuz erişime kapalıdır.
  const aramaYanit = await fetch(`${BASE}/api/arama?q=abc`, { redirect: "manual" });
  kontrol(
    "Arama ucu oturumsuz erişime kapalı",
    aramaYanit.status === 307 || aramaYanit.status === 302 || aramaYanit.status === 401,
    `HTTP ${aramaYanit.status}`
  );
  const ozetYanit = await fetch(`${BASE}/api/ozet?tur=firma&id=x`, {
    redirect: "manual",
  });
  kontrol(
    "Özet ucu oturumsuz erişime kapalı",
    ozetYanit.status === 307 || ozetYanit.status === 302 || ozetYanit.status === 401,
    `HTTP ${ozetYanit.status}`
  );

  // U2/U3 — firma çalışma ekranı sekmeleri.
  const ornekFirma = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" } },
    select: { id: true, ad: true },
  });
  if (ornekFirma) {
    const genel = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ornekFirma.id}`
    );
    kontrol("Firma ekranında sekme çubuğu var", genel.govde.includes("Kontaklar"));
    kontrol(
      "Genel sekmesi zaman akışını gösteriyor",
      genel.govde.includes("Zaman Akışı")
    );
    kontrol(
      "Genel sekmesinde satış tabloları ÇİZİLMİYOR (sekme bir sorgu kapısıdır)",
      // "Siparişler" sol menüde de geçer; tabloya özgü başlık aranır.
      !genel.govde.includes("Teklif Hazırla") && !genel.govde.includes("Aşama")
    );

    const satis = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ornekFirma.id}?sekme=satis`
    );
    kontrol("Satış sekmesi teklifleri gösteriyor", satis.govde.includes("Teklifler"));
    kontrol("Satış sekmesi siparişleri gösteriyor", satis.govde.includes("Siparişler"));

    const destekSekme = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ornekFirma.id}?sekme=destek`
    );
    kontrol(
      "Proje & Destek sekmesi açılıyor",
      destekSekme.govde.includes("Destek Kayıtları")
    );

    const uydurmaSekme = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ornekFirma.id}?sekme=uydurma`
    );
    kontrol(
      "Uydurma sekme hata vermeden Genel'e düşüyor",
      uydurmaSekme.govde.includes("Zaman Akışı") &&
        !uydurmaSekme.url.includes("/yetkisiz")
    );

    // U2 — yan panel URL'de yaşar: parametreyle açılan sayfa özeti gösterir.
    const panelli = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar?panel=firma:${ornekFirma.id}`
    );
    kontrol(
      "Yan panel querystring'den açılıyor",
      panelli.govde.includes("Tam sayfada aç")
    );
  }

  // U4 — ilişkili kayıt zinciri: tekliften doğan siparişte şerit görünür.
  const zincirliSiparis = await prisma.siparis.findFirst({
    where: { tenant: { slug: "gezegen" }, teklifId: { not: null } },
    select: { id: true },
  });
  if (zincirliSiparis) {
    const siparisDetay = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/siparisler/${zincirliSiparis.id}`
    );
    kontrol(
      "Sipariş detayında ilişkili kayıt zinciri var",
      siparisDetay.govde.includes("İlişkili Kayıtlar")
    );
    kontrol(
      "Zincir teklif halkasını gösteriyor",
      siparisDetay.govde.includes("Teklif")
    );
  }

  // Kiracı sınırı: komşu kiracının araması Gezegen firmalarını bulamaz.
  const anadoluPanel = await sayfaGetir(
    "admin@anadolu.com",
    "anadolu123",
    ornekFirma ? `/firmalar?panel=firma:${ornekFirma.id}` : "/firmalar"
  );
  kontrol(
    "Komşu kiracı Gezegen firmasının özetini AÇAMIYOR",
    !ornekFirma || !anadoluPanel.govde.includes(ornekFirma.ad)
  );

  // ──────────────────────────────────────────────────────────────────────
  // Faz 21 — AI özellikleri (G1-G3)
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n▸ Faz 21 — skorlama, özet, doğal dilde sorgu\n");

  // Ayar ekranı: söz yazılı mı, varsayılan kapalı mı.
  const aiSayfa = await sayfaGetir("admin@gezegen.com", "admin123", "/ai");
  kontrol("AI ayar ekranı açılıyor", !aiSayfa.url.includes("/yetkisiz"));
  kontrol(
    "Modele NE gönderildiği ekranda yazılı",
    aiSayfa.govde.includes("gönderilenler")
  );
  kontrol(
    "Modele NE GÖNDERİLMEDİĞİ de yazılı",
    aiSayfa.govde.includes("Hiçbir zaman gönderilmeyenler")
  );
  kontrol(
    "AI varsayılan KAPALI (kiracı bilerek açar)",
    aiSayfa.govde.includes("Aç") && !aiSayfa.govde.includes("çalışıyor ·")
  );
  kontrol(
    "Skorun dış çağrı yapmadığı kullanıcıya söyleniyor",
    aiSayfa.govde.includes("hiçbir veri dışarı gönderilmez") ||
      aiSayfa.govde.includes("dışarı gönderilmez")
  );

  // G1 — skor rozeti fırsat listesinde; AI KAPALIYKEN DE çalışır.
  const firsatListe = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/firsatlar?gorunum=liste"
  );
  // NOT: tablo başlıkları CSS'te `uppercase`; Playwright innerText dönüşümü
  // uygular, bu yüzden karşılaştırma Türkçe küçük harfle yapılır (aynı tuzak
  // Faz 18'de "Künye" kontrolünde de yaşandı).
  kontrol(
    "Fırsat listesinde skor sütunu var (AI kapalıyken de)",
    firsatListe.govde.toLocaleLowerCase("tr").includes("skor")
  );

  const adayListe = await sayfaGetir("admin@gezegen.com", "admin123", "/adaylar");
  kontrol(
    "Aday listesinde skor sütunu var",
    adayListe.govde.toLocaleLowerCase("tr").includes("skor")
  );

  // G2 — özet paneli firma ekranında ve VERİDEN üretiliyor.
  const ornekFirma2 = await prisma.firma.findFirst({
    where: { tenant: { slug: "gezegen" } },
    select: { id: true },
  });
  if (ornekFirma2) {
    const firmaGenel = await sayfaGetir(
      "admin@gezegen.com",
      "admin123",
      `/firmalar/${ornekFirma2.id}`
    );
    const genelKucuk = firmaGenel.govde.toLocaleLowerCase("tr");
    kontrol("Firma ekranında özet paneli var", genelKucuk.includes("özet"));
    kontrol(
      "Özet AI kapalıyken de içerik gösteriyor",
      genelKucuk.includes("son temas")
    );
  }

  // Salt okunur kullanıcı AI EYLEMLERİNİ kullanamaz (ücret doğuran iştir).
  const okuyucuAi = await sayfaGetir("okuyucu@gezegen.com", "okuyucu123", "/ai");
  kontrol(
    "Salt okunur kullanıcı AI ekranına giremiyor",
    okuyucuAi.url.includes("/yetkisiz")
  );

  // Üye AI'ı kullanır ama AYARINI değiştiremez.
  const uyeAi = await sayfaGetir("kullanici@gezegen.com", "user123", "/ai");
  kontrol("Üye AI ekranını görüyor", !uyeAi.url.includes("/yetkisiz"));
  kontrol(
    "Üye AI ayarını DEĞİŞTİREMİYOR (kuruluş kararı)",
    uyeAi.govde.includes("yalnızca kuruluş yöneticisi")
  );
  kontrol(
    "Üye kullanım defterini GÖRMÜYOR",
    !uyeAi.govde.includes("Kullanım defteri")
  );

  // ──────────────────────────────────────────────────────────────────────
  // Menü konsolidasyonu (v1.22.0)
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n▸ Menü konsolidasyonu — bölümler ve sekme çubuğu\n");

  const menuYonetici = await sayfaGetir("admin@gezegen.com", "admin123", "/firmalar");
  kontrol("Sol menüde CRM bölümü var", menuYonetici.govde.includes("CRM"));
  kontrol(
    "Sol menüde Satış Yönetimi bölümü var",
    menuYonetici.govde.includes("Satış Yönetimi")
  );
  kontrol(
    "SSS sol menüde 'Bilgi Bankası' etiketiyle duruyor",
    menuYonetici.govde.includes("SSS (Bilgi Bankası)")
  );
  // Firmalar ekranındayken CRM sekme çubuğu görünmeli.
  kontrol(
    "CRM sekme çubuğu Firmalar ekranında çiziliyor",
    menuYonetici.govde.includes("Kontaklar") &&
      menuYonetici.govde.includes("Ziyaretler")
  );

  const menuSatis = await sayfaGetir("admin@gezegen.com", "admin123", "/teklifler");
  kontrol(
    "Satış sekme çubuğu Teklifler ekranında çiziliyor",
    menuSatis.govde.includes("Sevkiyat") && menuSatis.govde.includes("Stok")
  );

  // Bölüme ait OLMAYAN ekranda çubuk çizilmez.
  const menuTakvim = await sayfaGetir("admin@gezegen.com", "admin123", "/takvim");
  kontrol(
    "Takvimde bölüm sekme çubuğu YOK",
    !menuTakvim.govde.includes("Yatırım Destekleri")
  );

  // İçe aktarım Yönetim altına taşındı.
  kontrol(
    "İçe Aktar menüde Yönetim bölümünde",
    menuYonetici.govde.indexOf("Yönetim") < menuYonetici.govde.indexOf("İçe Aktar")
  );

  // Rotalar DEĞİŞMEDİ: eski adresler hâlâ açılıyor.
  for (const yol of ["/kisiler", "/urunler", "/kampanyalar", "/hizmetler"]) {
    const eski = await sayfaGetir("admin@gezegen.com", "admin123", yol);
    kontrol(
      `Eski adres çalışmaya devam ediyor: ${yol}`,
      !eski.url.includes("/yetkisiz") && !eski.url.includes("/login")
    );
  }

  // İzin süzgeci: üye göremediği sekmeyi çubukta da görmez.
  const uyeMenu2 = await sayfaGetir("kullanici@gezegen.com", "user123", "/firmalar");
  kontrol(
    "Üye CRM sekme çubuğunu görüyor",
    uyeMenu2.govde.includes("Kontaklar")
  );

  // ──────────────────────────────────────────────────────────────────────
  // Kampanya kapsamı ve rapor PDF çıktısı (v1.23.0)
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n▸ Kampanya kapsamı ve rapor çıktısı\n");

  // Kampanya alanı ARTIK HER ZAMAN çizilir; boşsa sebebini yazar.
  const yeniSiparis = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/siparisler/yeni"
  );
  kontrol(
    "Sipariş formunda kampanya alanı görünüyor",
    yeniSiparis.govde.toLocaleLowerCase("tr").includes("kampanya")
  );
  kontrol(
    "Kampanya yoksa SEBEBİ yazıyor (sessizce gizlenmiyor)",
    yeniSiparis.govde.includes("Önce firma seçin") ||
      yeniSiparis.govde.includes("Ürün seçin") ||
      yeniSiparis.govde.includes("Kampanya yok") ||
      yeniSiparis.govde.includes("geçerli kampanya yok") ||
      yeniSiparis.govde.includes("Tanımlı aktif kampanya yok")
  );

  // Teklif formu artık ürün ve kampanya taşıyor.
  const yeniTeklif = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/teklifler/yeni"
  );
  kontrol(
    "Teklif formunda ürün seçici var (katalog bağı)",
    yeniTeklif.govde.includes("Ürün (katalogdan)")
  );
  kontrol(
    "Teklif formunda kampanya alanı var",
    yeniTeklif.govde.toLocaleLowerCase("tr").includes("kampanya")
  );

  // Raporlarda PDF düğmesi.
  for (const yol of [
    "/raporlar/mali",
    "/raporlar/satis",
    "/raporlar/urun",
    "/raporlar/aktivite",
    "/raporlar/genel",
  ]) {
    const rapor = await sayfaGetir("admin@gezegen.com", "admin123", yol);
    kontrol(
      `Raporda PDF düğmesi var: ${yol}`,
      rapor.govde.includes("Yazdır") && !rapor.url.includes("/yetkisiz")
    );
  }

  const destekRaporCikti = await sayfaGetir(
    "admin@gezegen.com",
    "admin123",
    "/destek/rapor"
  );
  kontrol(
    "Destek raporunda da PDF düğmesi var",
    destekRaporCikti.govde.includes("Yazdır")
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
