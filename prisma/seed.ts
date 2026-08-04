import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

const YATIRIM_TURLERI = ["hibe", "kredi", "teşvik", "diğer"];
const YATIRIM_DURUMLARI = ["basvuruldu", "onaylandi", "reddedildi", "tamamlandi"];
const EGITIM_KONULARI = [
  "İş Sağlığı ve Güvenliği", "Kalite Yönetimi", "Dijital Dönüşüm",
  "İhracat", "Finansal Okuryazarlık", "Yalın Üretim", "Pazarlama",
  "İnsan Kaynakları", "Sürdürülebilirlik", "Siber Güvenlik",
];
const EGITIM_DURUMLARI = ["planlandi", "tamamlandi", "iptal"];
const HIZMET_TURLERI = ["danışmanlık", "denetim", "raporlama", "eğitim", "diğer"];
const HIZMET_DURUMLARI = ["devam", "tamamlandi", "iptal"];

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

async function main() {
  console.log("🌱 Seed başlıyor…");

  // --- Kullanıcılar ---
  const adminHash = await bcrypt.hash("admin123", 10);
  const userHash = await bcrypt.hash("user123", 10);

  await prisma.user.upsert({
    where: { email: "admin@gezegen.com" },
    update: {},
    create: {
      email: "admin@gezegen.com",
      name: "Sistem Yöneticisi",
      password: adminHash,
      role: "admin",
    },
  });
  await prisma.user.upsert({
    where: { email: "kullanici@gezegen.com" },
    update: {},
    create: {
      email: "kullanici@gezegen.com",
      name: "Örnek Kullanıcı",
      password: userHash,
      role: "user",
    },
  });
  console.log("✅ Kullanıcılar oluşturuldu (admin@gezegen.com / admin123)");

  // --- Firmalar ---
  const mevcut = await prisma.firma.count();
  if (mevcut > 0) {
    console.log(`ℹ️  Zaten ${mevcut} firma var, örnek firma üretimi atlanıyor.`);
    return;
  }

  const HEDEF = 800;
  const firmaData = Array.from({ length: HEDEF }).map((_, i) => {
    const sektor = rnd(SEKTORLER);
    const ad = `${rnd(FIRMA_EKLERI)} ${sektor} ${rnd(["A.Ş.", "Ltd. Şti.", "San. Tic."])} ${i + 1}`;
    const il = rnd(ILLER);
    return {
      ad,
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

  // SQLite'ta createMany parça parça daha güvenli
  const BATCH = 200;
  for (let i = 0; i < firmaData.length; i += BATCH) {
    await prisma.firma.createMany({ data: firmaData.slice(i, i + BATCH) });
  }
  console.log(`✅ ${HEDEF} firma oluşturuldu.`);

  const firmalar = await prisma.firma.findMany({ select: { id: true } });

  // --- Alt kayıtlar ---
  const yatirimlar: any[] = [];
  const egitimler: any[] = [];
  const hizmetler: any[] = [];

  for (const f of firmalar) {
    // yatırımlar (~%60 firmada)
    if (Math.random() < 0.6) {
      const adet = rndInt(1, 3);
      for (let k = 0; k < adet; k++) {
        yatirimlar.push({
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
    // eğitimler (~%50 firmada)
    if (Math.random() < 0.5) {
      const adet = rndInt(1, 2);
      for (let k = 0; k < adet; k++) {
        egitimler.push({
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
    // hizmetler (~%40 firmada)
    if (Math.random() < 0.4) {
      hizmetler.push({
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
    `✅ ${yatirimlar.length} yatırım, ${egitimler.length} eğitim, ${hizmetler.length} hizmet oluşturuldu.`
  );
  console.log("🎉 Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
