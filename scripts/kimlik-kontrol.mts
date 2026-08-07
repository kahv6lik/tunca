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
    kontrol(
      "Akışta farklı modüllerden kayıtlar birleşiyor",
      firmaDetay.govde.includes("Kişiler") && firmaDetay.govde.includes("Fırsatlar")
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
