/**
 * Demo veri üretici — ÜRETİMDE KULLANILMAZ.
 *
 * Faz 1'den itibaren İKİ kiracı üretir. Bunun sebebi kolaylık değil:
 * çok kiracılı izolasyonun elle doğrulanabilmesi için farklı kiracılara ait
 * en az iki veri kümesi gerekir. İki kullanıcıyla giriş yapıp listelerin
 * birbirinden tamamen ayrı olduğu görülebilir.
 */
import { PrismaClient } from "@prisma/client";
import { yonetimIstemcisi } from "../src/lib/rls";
import bcrypt from "bcryptjs";

// RLS yönetim bağlamı: kurulum betikleri kiracılar ötesi yazabilmelidir.
const temelIstemci = new PrismaClient();
const prisma = yonetimIstemcisi(temelIstemci) as unknown as PrismaClient;

const ILLER = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Konya", "Gaziantep",
  "Kayseri", "Kocaeli", "Adana", "Mersin", "Denizli", "Manisa", "Samsun",
  "Eskişehir", "Trabzon", "Sakarya", "Tekirdağ", "Balıkesir", "Hatay",
];

const SEKTORLER = [
  "Tekstil", "Gıda", "Otomotiv", "Makine", "İnşaat", "Kimya", "Elektronik",
  "Mobilya", "Lojistik", "Turizm", "Tarım", "Enerji", "Sağlık", "Yazılım",
  "Metal", "Plastik", "Ambalaj", "Kozmetik", "Tarım Makineleri", "Savunma",
];

const FIRMA_EKLERI = [
  "Sanayi", "Ticaret", "Üretim", "Teknoloji", "Endüstri", "Grup", "Holding",
  "Global", "Anadolu", "Ege", "Marmara", "Yıldız", "Öncü", "Star", "Mega",
];

const YATIRIM_TURLERI = ["Hibe", "Teşvik", "Kredi", "Diğer"];
const YATIRIM_DURUMLARI = ["basvuruldu", "onaylandi", "reddedildi", "tamamlandi"];
const EGITIM_KONULARI = [
  "İş Sağlığı ve Güvenliği", "Kalite Yönetimi", "Dijital Dönüşüm",
  "İhracat", "Finansal Okuryazarlık", "Yalın Üretim", "Pazarlama",
  "İnsan Kaynakları", "Sürdürülebilirlik", "Siber Güvenlik",
];
const EGITIM_DURUMLARI = ["planlandi", "tamamlandi", "iptal"];
const HIZMET_TURLERI = ["Danışmanlık", "Denetim", "Raporlama", "Eğitim", "Diğer"];
const HIZMET_DURUMLARI = ["devam", "tamamlandi", "iptal"];

const BATCH = 200;

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rndTarih(gunOnce: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rndInt(0, gunOnce));
  return d;
}

async function kiraciOlustur(ad: string, slug: string) {
  const mevcut = await prisma.tenant.findUnique({ where: { slug } });
  if (mevcut) return mevcut;
  return prisma.tenant.create({ data: { ad, slug } });
}

async function kullaniciOlustur(
  tenantId: string,
  email: string,
  name: string,
  sifre: string,
  role: string
) {
  const hash = await bcrypt.hash(sifre, 10);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {},
    create: { tenantId, email, name, password: hash, role },
  });
}

async function veriUret(tenantId: string, firmaSayisi: number, etiket: string) {
  const mevcut = await prisma.firma.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log(`ℹ️  ${etiket}: zaten ${mevcut} firma var, üretim atlanıyor.`);
    return;
  }

  const firmaData = Array.from({ length: firmaSayisi }).map((_, i) => {
    const sektor = rnd(SEKTORLER);
    const il = rnd(ILLER);
    return {
      tenantId,
      ad: `${rnd(FIRMA_EKLERI)} ${sektor} ${rnd(["A.Ş.", "Ltd. Şti.", "San. Tic."])} ${i + 1}`,
      vergiNo: String(rndInt(1000000000, 9999999999)),
      sektor,
      il,
      ilce: rnd(["Merkez", "Organize Sanayi", "Sanayi Bölgesi", "Çarşı"]),
      yetkiliAd: `${rnd(["Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif"])} ${rnd(["Yılmaz", "Demir", "Kaya", "Şahin", "Çelik", "Aydın", "Öztürk"])}`,
      telefon: `0${rndInt(500, 555)} ${rndInt(100, 999)} ${rndInt(10, 99)} ${rndInt(10, 99)}`,
      email: `info@firma${i + 1}.com.tr`,
      adres: `${il} ${rnd(["OSB", "Sanayi Sitesi"])} No:${rndInt(1, 200)}`,
      durum: Math.random() < 0.85 ? "aktif" : "pasif",
      createdAt: rndTarih(720),
    };
  });

  for (let i = 0; i < firmaData.length; i += BATCH) {
    await prisma.firma.createMany({ data: firmaData.slice(i, i + BATCH) });
  }

  const firmalar = await prisma.firma.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const yatirimlar: any[] = [];
  const egitimler: any[] = [];
  const hizmetler: any[] = [];

  for (const f of firmalar) {
    if (Math.random() < 0.6) {
      for (let k = 0; k < rndInt(1, 3); k++) {
        yatirimlar.push({
          tenantId,
          firmaId: f.id,
          baslik: `${rnd(["KOSGEB", "TÜBİTAK", "Kalkınma Ajansı", "Yatırım Teşvik"])} Desteği`,
          tur: rnd(YATIRIM_TURLERI),
          tutar: rndInt(50, 5000) * 1000,
          paraBirimi: "TRY",
          tarih: rndTarih(700),
          durum: rnd(YATIRIM_DURUMLARI),
        });
      }
    }
    if (Math.random() < 0.5) {
      for (let k = 0; k < rndInt(1, 2); k++) {
        egitimler.push({
          tenantId,
          firmaId: f.id,
          baslik: rnd(EGITIM_KONULARI) + " Eğitimi",
          konu: rnd(EGITIM_KONULARI),
          egitmen: rnd(["Dr. Kaya", "Uzm. Demir", "Prof. Yıldız", "Eğitmen Aksoy"]),
          tarih: rndTarih(365),
          sureSaat: rndInt(4, 40),
          katilimci: rndInt(5, 50),
          durum: rnd(EGITIM_DURUMLARI),
        });
      }
    }
    if (Math.random() < 0.4) {
      hizmetler.push({
        tenantId,
        firmaId: f.id,
        baslik: rnd(["Süreç Danışmanlığı", "Mali Denetim", "Raporlama Hizmeti", "Kalite Belgelendirme"]),
        tur: rnd(HIZMET_TURLERI),
        tarih: rndTarih(365),
        durum: rnd(HIZMET_DURUMLARI),
      });
    }
  }

  for (let i = 0; i < yatirimlar.length; i += BATCH)
    await prisma.yatirimDestegi.createMany({ data: yatirimlar.slice(i, i + BATCH) });
  for (let i = 0; i < egitimler.length; i += BATCH)
    await prisma.egitim.createMany({ data: egitimler.slice(i, i + BATCH) });
  for (let i = 0; i < hizmetler.length; i += BATCH)
    await prisma.hizmet.createMany({ data: hizmetler.slice(i, i + BATCH) });

  console.log(
    `✅ ${etiket}: ${firmaSayisi} firma, ${yatirimlar.length} yatırım, ` +
      `${egitimler.length} eğitim, ${hizmetler.length} hizmet.`
  );
}

/**
 * Örnek paketler (Faz 5 / B4).
 *
 * "Başlangıç" bilinçli olarak dar tutulmuştur: limit ve modül kısıtlarının
 * gerçekten çalıştığı, hiç kod okumadan bir hesapla denenebilsin.
 */
async function paketleriKur() {
  const paketler = [
    {
      ad: "Başlangıç",
      aciklama: "Küçük ekipler için — yatırım ve hizmet modülleri kapalı",
      kullaniciLimiti: 3,
      firmaLimiti: 25,
      moduller: ["firma", "egitim", "rapor"],
    },
    {
      ad: "Profesyonel",
      aciklama: "Tüm modüller, orta ölçekli kuruluşlar için",
      kullaniciLimiti: 25,
      firmaLimiti: 500,
      moduller: ["firma", "yatirim", "egitim", "hizmet", "rapor"],
    },
    {
      ad: "Kurumsal",
      aciklama: "Sınırsız kullanıcı ve firma",
      kullaniciLimiti: 0,
      firmaLimiti: 0,
      moduller: ["firma", "yatirim", "egitim", "hizmet", "rapor"],
    },
  ];

  const sonuc: Record<string, string> = {};
  for (const p of paketler) {
    const mevcut = await prisma.plan.findUnique({ where: { ad: p.ad } });
    const kayit = mevcut
      ? await prisma.plan.update({ where: { id: mevcut.id }, data: p })
      : await prisma.plan.create({ data: p });
    sonuc[p.ad] = kayit.id;
  }
  console.log("✅ Paketler hazır: Başlangıç, Profesyonel, Kurumsal");
  return sonuc;
}

async function main() {
  console.log("🌱 Seed başlıyor…");

  const paketler = await paketleriKur();

  // --- Platform kiracısı (Faz 5) ---
  // Platform yöneticisi de bir User'dır, dolayısıyla bir kiracıya bağlıdır.
  // Bu kiracı yalnızca platform ekibi içindir; içinde iş verisi tutulmaz ve
  // admin panelde diğer müşterilerle aynı listede görünür.
  const platform = await kiraciOlustur("Gezegen Platform", "platform");
  await kullaniciOlustur(
    platform.id,
    "platform@gezegen.com",
    "Platform Yöneticisi",
    "platform123",
    "platform_admin"
  );

  // --- Kiracı 1 ---
  // Faz 4'ten itibaren dört rol var; seed her rolden bir hesap üretir ki
  // yetkilendirme elle de denenebilsin.
  const gezegen = await kiraciOlustur("Gezegen Danışmanlık", "gezegen");
  await kullaniciOlustur(gezegen.id, "admin@gezegen.com", "Sistem Yöneticisi", "admin123", "tenant_admin");
  await kullaniciOlustur(gezegen.id, "kullanici@gezegen.com", "Örnek Kullanıcı", "user123", "uye");
  await kullaniciOlustur(gezegen.id, "okuyucu@gezegen.com", "Salt Okunur Kullanıcı", "okuyucu123", "salt_okunur");

  // --- Kiracı 2 (izolasyon doğrulaması için) ---
  const anadolu = await kiraciOlustur("Anadolu Yatırım", "anadolu");
  await kullaniciOlustur(anadolu.id, "admin@anadolu.com", "Anadolu Yöneticisi", "anadolu123", "tenant_admin");

  // Paket ataması: Gezegen sınırsız (800 firma üretiliyor), Anadolu profesyonel.
  await prisma.tenant.update({
    where: { id: gezegen.id },
    data: { planId: paketler["Kurumsal"] },
  });
  await prisma.tenant.update({
    where: { id: anadolu.id },
    data: { planId: paketler["Profesyonel"] },
  });

  console.log("✅ Kiracılar ve kullanıcılar hazır.");

  // --- Örnek grup: salt okunur kullanıcıya rapor dışında ekleme yetkisi ---
  // Grupların yalnızca yetki EKLEDİĞİNİ göstermek için.
  const mevcutGrup = await prisma.grup.findFirst({
    where: { tenantId: gezegen.id, ad: "Saha Ekibi" },
  });
  if (!mevcutGrup) {
    const grup = await prisma.grup.create({
      data: {
        tenantId: gezegen.id,
        ad: "Saha Ekibi",
        aciklama: "Firma ve eğitim kaydı ekleyebilen ekip",
        izinler: ["firma.olustur", "egitim.olustur", "egitim.duzenle"],
      },
    });
    const okuyucu = await prisma.user.findFirst({
      where: { tenantId: gezegen.id, email: "okuyucu@gezegen.com" },
    });
    if (okuyucu) {
      await prisma.kullaniciGrup.create({
        data: { tenantId: gezegen.id, userId: okuyucu.id, grupId: grup.id },
      });
    }
    console.log("✅ Örnek grup oluşturuldu: Saha Ekibi");
  }

  await veriUret(gezegen.id, 800, "Gezegen Danışmanlık");
  await veriUret(anadolu.id, 120, "Anadolu Yatırım");

  console.log("\n🎉 Seed tamamlandı. Giriş bilgileri:");
  console.log("   Platform · Platform Yöneticisi → platform@gezegen.com / platform123");
  console.log("   Gezegen · Kuruluş Yöneticisi → admin@gezegen.com / admin123");
  console.log("   Gezegen · Üye                → kullanici@gezegen.com / user123");
  console.log("   Gezegen · Salt Okunur        → okuyucu@gezegen.com / okuyucu123");
  console.log("   Anadolu · Kuruluş Yöneticisi → admin@anadolu.com / anadolu123");
  console.log("\n   İki kiracıyla girip listelerin ayrı olduğunu,");
  console.log("   farklı rollerle girip yetkilerin değiştiğini doğrulayın.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await temelIstemci.$disconnect();
  });
