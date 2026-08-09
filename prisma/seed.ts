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
import { DEPARTMANLAR } from "../src/lib/constants";
import { firmaNoUret } from "../src/lib/firma-no-saf";

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

// Faz 6 — satış çekirdeği
const ADLAR = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif", "Can", "Deniz"];
const SOYADLAR = ["Yılmaz", "Demir", "Kaya", "Şahin", "Çelik", "Aydın", "Öztürk", "Arslan"];
const UNVANLAR = [
  "Genel Müdür", "Satın Alma Müdürü", "Mali İşler Müdürü", "Fabrika Müdürü",
  "İnsan Kaynakları Uzmanı", "Kalite Sorumlusu", "Ar-Ge Müdürü",
];
const FIRSAT_BASLIKLARI = [
  "Yıllık danışmanlık anlaşması", "Teşvik başvuru danışmanlığı",
  "ISO belgelendirme projesi", "Dijital dönüşüm paketi",
  "Eğitim programı anlaşması", "Ar-Ge merkezi kurulumu",
  "İhracat danışmanlığı", "Süreç iyileştirme projesi",
];
// Faz 7
const AKTIVITE_BASLIKLARI = [
  "Tanışma görüşmesi yapıldı", "Teklif için arandı", "Fiyat revizyonu konuşuldu",
  "Toplantı planlandı", "Sözleşme taslağı gönderildi", "Referans görüşmesi",
  "Teknik ekiple toplantı", "Yıllık değerlendirme",
];
const LEAD_KAYNAK_ORNEK = ["Web sitesi", "Fuar", "Referans", "Telefon", "Sosyal medya"];
const TEKLIF_KALEMLERI = [
  { aciklama: "Danışmanlık hizmeti", birim: "ay", birimFiyat: 45000 },
  { aciklama: "Süreç analizi ve raporlama", birim: "paket", birimFiyat: 120000 },
  { aciklama: "Eğitim programı", birim: "gün", birimFiyat: 28000 },
  { aciklama: "Belgelendirme desteği", birim: "paket", birimFiyat: 75000 },
  { aciklama: "Yerinde denetim", birim: "gün", birimFiyat: 18000 },
];

const VARSAYILAN_ASAMALAR = [
  { ad: "Yeni", sira: 0, olasilik: 10, renk: "#6366f1" },
  { ad: "İletişim", sira: 1, olasilik: 25, renk: "#0ea5e9" },
  { ad: "Teklif", sira: 2, olasilik: 50, renk: "#f59e0b" },
  { ad: "Müzakere", sira: 3, olasilik: 75, renk: "#a855f7" },
  { ad: "Sonuç", sira: 4, olasilik: 90, renk: "#10b981" },
];

const BATCH = 200;

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * Rastgele tarih. Pozitif değer geçmişe, negatif değer geleceğe bakar
 * (fırsatların tahmini kapanış tarihi ileri bir gündür).
 */
function rndTarih(gunOnce: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - (gunOnce >= 0 ? rndInt(0, gunOnce) : -rndInt(0, -gunOnce)));
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

/**
 * Ticari çekirdek demo verisi (Faz 14).
 *
 * Yalnızca Gezegen kiracısında üretilir; katalogun kiracıya özel olduğu elle
 * de görülsün. Stok bakiyesi doğrudan yazılmaz — HAREKETLE yüklenir, çünkü
 * bakiye defterin toplamıdır (T7) ve demo veri bu kuralı bozmamalıdır.
 */
async function ticariVeri(tenantId: string) {
  const mevcut = await prisma.urun.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log("ℹ️  Ticari veri zaten var, üretim atlanıyor.");
    return;
  }

  const urunTanimlari = [
    { kod: "DAN-001", ad: "Yatırım Teşvik Danışmanlığı", kategori: "Danışmanlık", birim: "saat", listeFiyat: 2500, stokTakibi: false, kritikStok: 0 },
    { kod: "DAN-002", ad: "KOSGEB Başvuru Desteği", kategori: "Danışmanlık", birim: "hizmet", listeFiyat: 18000, stokTakibi: false, kritikStok: 0 },
    { kod: "EGT-001", ad: "İhracat Eğitimi (2 gün)", kategori: "Eğitim", birim: "adet", listeFiyat: 12000, stokTakibi: false, kritikStok: 0 },
    { kod: "EGT-002", ad: "Kalite Yönetimi Eğitimi", kategori: "Eğitim", birim: "adet", listeFiyat: 9500, stokTakibi: false, kritikStok: 0 },
    { kod: "YAZ-001", ad: "CRM Kullanıcı Lisansı (yıllık)", kategori: "Yazılım", birim: "yıl", listeFiyat: 4800, stokTakibi: true, kritikStok: 20 },
    { kod: "DON-001", ad: "Barkod Okuyucu", kategori: "Donanım", birim: "adet", listeFiyat: 3200, stokTakibi: true, kritikStok: 10 },
    { kod: "DON-002", ad: "El Terminali", kategori: "Donanım", birim: "adet", listeFiyat: 14500, stokTakibi: true, kritikStok: 5 },
    { kod: "SRF-001", ad: "Sarf Malzeme Paketi", kategori: "Sarf", birim: "kutu", listeFiyat: 850, stokTakibi: true, kritikStok: 30 },
  ];

  const urunler: Record<string, string> = {};
  for (const u of urunTanimlari) {
    const kayit = await prisma.urun.create({
      data: { tenantId, ...u, paraBirimi: "TRY", kdvOrani: 20, durum: "aktif" },
    });
    urunler[u.kod] = kayit.id;
  }

  // Stok girişleri — biri bilinçli olarak KRİTİK seviyenin altında bırakılır
  // ki uyarı bandı demo veride de görünsün.
  const girisler: [string, number][] = [
    ["YAZ-001", 150], ["DON-001", 45], ["DON-002", 3], ["SRF-001", 120],
  ];
  for (const [kod, miktar] of girisler) {
    await prisma.urun.update({
      where: { id: urunler[kod] },
      data: { stokMiktar: miktar },
    });
    await prisma.stokHareketi.create({
      data: {
        tenantId,
        urunId: urunler[kod],
        tur: "giris",
        miktar,
        sonrakiBakiye: miktar,
        aciklama: "Açılış stoğu",
      },
    });
  }

  // Paket: iki ürünü sabit fiyatla birleştirir.
  const paket = await prisma.paket.create({
    data: {
      tenantId,
      kod: "PKT-BASLANGIC",
      ad: "Başlangıç Paketi",
      aciklama: "Lisans + barkod okuyucu",
      sabitFiyat: true,
      fiyat: 7000, // liste toplamı 8000
      paraBirimi: "TRY",
      durum: "aktif",
    },
  });
  await prisma.paketKalemi.createMany({
    data: [
      { tenantId, paketId: paket.id, urunId: urunler["YAZ-001"], miktar: 1, sira: 0 },
      { tenantId, paketId: paket.id, urunId: urunler["DON-001"], miktar: 1, sira: 1 },
    ],
  });

  const bugun = new Date();
  const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const aySonu = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0, 23, 59, 59);

  await prisma.kampanya.create({
    data: {
      tenantId,
      kod: "BAHAR20",
      ad: "Bahar Kampanyası",
      aciklama: "Eğitimlerde %20 indirim",
      tip: "yuzde",
      durum: "aktif",
      baslangic: ayBasi,
      bitis: aySonu,
      deger: 20,
      kota: 50,
      kullanilan: 12,
    },
  });

  await prisma.kampanya.create({
    data: {
      tenantId,
      kod: "3AL2ODE",
      ad: "3 Al 2 Öde — Sarf",
      tip: "alnodem",
      durum: "aktif",
      baslangic: ayBasi,
      bitis: aySonu,
      alN: 3,
      odeM: 2,
      kota: 0,
    },
  });

  console.log(
    `✅ Ticari veri: ${urunTanimlari.length} ürün, 1 paket, 2 kampanya, ` +
      `${girisler.length} stok girişi.`
  );

  return urunler;
}

/**
 * Sipariş ve sevkiyat demo verisi (Faz 15).
 *
 * ÜÇ DURUM üretilir: onay bekleyen, onaylanmış (sevkiyatı açık) ve
 * reddedilmiş. Böylece onay kuyruğu, sevkiyat kuyruğu ve ret gerekçesi
 * ekranları demo veride de dolu görünür.
 *
 * Onaylanan siparişin stoğu HAREKETLE düşülür — bakiye elle yazılmaz;
 * demo veri de defterin kuralını bozmamalıdır (Faz 14 / T7).
 */
async function siparisVerisi(tenantId: string, urunler: Record<string, string>) {
  const mevcut = await prisma.siparis.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log("ℹ️  Sipariş verisi zaten var, üretim atlanıyor.");
    return;
  }

  const firmalar = await prisma.firma.findMany({
    where: { tenantId },
    take: 3,
    select: { id: true },
  });
  if (firmalar.length === 0) return;

  const yonetici = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["tenant_admin", "admin"] } },
    select: { id: true },
  });
  const uye = await prisma.user.findFirst({
    where: { tenantId, role: "uye" },
    select: { id: true },
  });

  const yil = new Date().getFullYear();
  let sira = 0;
  const no = () => `SIP-${yil}-${String(++sira).padStart(4, "0")}`;

  // 1) Onay bekleyen
  const bekleyen = await prisma.siparis.create({
    data: {
      tenantId,
      no: no(),
      firmaId: firmalar[0].id,
      durum: "onaybekliyor",
      olusturanId: uye?.id ?? null,
      araToplam: 9600, indirimTutari: 0, kdvTutari: 1920, toplam: 11520,
    },
  });
  await prisma.siparisKalemi.create({
    data: {
      tenantId, siparisId: bekleyen.id, sira: 0,
      urunId: urunler["YAZ-001"], aciklama: "CRM Kullanıcı Lisansı (yıllık)",
      miktar: 2, birim: "yıl", birimFiyat: 4800, kdvOrani: 20, tutar: 9600,
    },
  });

  // 2) Onaylanmış + sevkiyatı açık (stok hareketiyle düşülmüş)
  const onayli = await prisma.siparis.create({
    data: {
      tenantId,
      no: no(),
      firmaId: firmalar[1]?.id ?? firmalar[0].id,
      durum: "onaylandi",
      olusturanId: uye?.id ?? null,
      onaylayanId: yonetici?.id ?? null,
      onayTarihi: new Date(Date.now() - 2 * 86_400_000),
      stokDusuldu: true,
      araToplam: 16000, indirimTutari: 0, kdvTutari: 3200, toplam: 19200,
    },
  });
  await prisma.siparisKalemi.create({
    data: {
      tenantId, siparisId: onayli.id, sira: 0,
      urunId: urunler["DON-001"], aciklama: "Barkod Okuyucu",
      miktar: 5, birim: "adet", birimFiyat: 3200, kdvOrani: 20, tutar: 16000,
    },
  });

  const barkod = await prisma.urun.findFirst({
    where: { id: urunler["DON-001"] },
    select: { stokMiktar: true },
  });
  const yeniBakiye = (barkod?.stokMiktar ?? 0) - 5;
  await prisma.urun.update({
    where: { id: urunler["DON-001"] },
    data: { stokMiktar: yeniBakiye },
  });
  await prisma.stokHareketi.create({
    data: {
      tenantId, urunId: urunler["DON-001"], tur: "cikis", miktar: -5,
      sonrakiBakiye: yeniBakiye, referans: onayli.no,
      aciklama: `Sipariş onayı: ${onayli.no}`,
    },
  });
  await prisma.sevkiyat.create({
    data: {
      tenantId, siparisId: onayli.id,
      no: `SVK-${yil}-0001`,
      durum: "hazirlaniyor",
      tasiyici: "Aras Kargo",
    },
  });

  // 3) Reddedilmiş — gerekçesiyle
  const red = await prisma.siparis.create({
    data: {
      tenantId,
      no: no(),
      firmaId: firmalar[2]?.id ?? firmalar[0].id,
      durum: "reddedildi",
      olusturanId: uye?.id ?? null,
      onaylayanId: yonetici?.id ?? null,
      onayTarihi: new Date(Date.now() - 86_400_000),
      redSebebi: "İskonto oranı satış yetkisini aşıyor; revize edip yeniden gönderin.",
      araToplam: 29000, indirimTutari: 5800, kdvTutari: 4640, toplam: 27840,
    },
  });
  await prisma.siparisKalemi.create({
    data: {
      tenantId, siparisId: red.id, sira: 0,
      urunId: urunler["DON-002"], aciklama: "El Terminali",
      miktar: 2, birim: "adet", birimFiyat: 14500, iskontoOrani: 20,
      kdvOrani: 20, indirimTutari: 5800, tutar: 23200,
    },
  });

  // Belge sayacı üretilen numaralarla hizalanır: arayüzden açılan ilk
  // sipariş çakışan numara almasın.
  await prisma.belgeSayac.upsert({
    where: { tenantId_tur_yil: { tenantId, tur: "siparis", yil } },
    create: { tenantId, tur: "siparis", yil, sonSira: sira },
    update: { sonSira: sira },
  });
  await prisma.belgeSayac.upsert({
    where: { tenantId_tur_yil: { tenantId, tur: "sevkiyat", yil } },
    create: { tenantId, tur: "sevkiyat", yil, sonSira: 1 },
    update: { sonSira: 1 },
  });

  console.log("✅ Sipariş verisi: 3 sipariş (onay bekleyen, onaylı, reddedilen) + 1 sevkiyat.");
}

/**
 * Proje, destek kaydı ve SSS demo verisi (Faz 16).
 *
 * Destek kayıtları BİLEREK farklı durumlarda üretilir (açık, işlemde,
 * çözülmüş, kapanmış): çözüm süresi raporu ve kişi yükü ekranı demo veride
 * de anlamlı çıkmalı, yoksa "ortalama yok" gösterir ve rapor sınanmamış olur.
 */
async function projeDestekVerisi(tenantId: string) {
  const mevcut = await prisma.destekKaydi.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log("ℹ️  Proje/destek verisi zaten var, üretim atlanıyor.");
    return;
  }

  const firmalar = await prisma.firma.findMany({
    where: { tenantId },
    take: 4,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firmalar.length === 0) return;

  const yonetici = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["tenant_admin", "admin"] } },
    select: { id: true },
  });
  const uye = await prisma.user.findFirst({
    where: { tenantId, role: "uye" },
    select: { id: true },
  });

  const proje = await prisma.proje.create({
    data: {
      tenantId,
      kod: "PRJ-001",
      ad: "ERP Geçiş Projesi",
      aciklama: "Mevcut sistemden yeni CRM'e veri taşıma ve eğitim.",
      firmaId: firmalar[0].id,
      sorumluId: yonetici?.id ?? null,
      durum: "devam",
      baslangic: new Date(Date.now() - 30 * 86_400_000),
      bitis: new Date(Date.now() + 60 * 86_400_000),
      butce: 250_000,
    },
  });
  await prisma.proje.create({
    data: {
      tenantId,
      kod: "PRJ-002",
      ad: "Saha Ekibi Mobil Kurulum",
      firmaId: firmalar[1]?.id ?? firmalar[0].id,
      sorumluId: uye?.id ?? null,
      durum: "planlandi",
      butce: 80_000,
    },
  });

  const yil = new Date().getFullYear();
  const gun = 86_400_000;
  let sira = 0;
  const no = () => `DST-${yil}-${String(++sira).padStart(4, "0")}`;

  const kayitlar = [
    {
      baslik: "Barkod okuyucu bilgisayara bağlanmıyor",
      kanal: "telefon",
      oncelik: "kritik",
      durum: "acik",
      atananId: uye?.id ?? null,
      projeId: null as string | null,
      gecmis: 2,
      cozumGun: null as number | null,
    },
    {
      baslik: "Veri aktarımında Türkçe karakterler bozuk geliyor",
      kanal: "eposta",
      oncelik: "yuksek",
      durum: "islemde",
      atananId: yonetici?.id ?? null,
      projeId: proje.id,
      gecmis: 5,
      cozumGun: null,
    },
    {
      baslik: "Fatura adresi güncellemesi",
      kanal: "web",
      oncelik: "dusuk",
      durum: "cozuldu",
      atananId: uye?.id ?? null,
      projeId: null,
      gecmis: 7,
      cozumGun: 6,
    },
    {
      baslik: "Kullanıcı eğitimi talebi",
      kanal: "saha",
      oncelik: "orta",
      durum: "kapandi",
      atananId: yonetici?.id ?? null,
      projeId: proje.id,
      gecmis: 12,
      cozumGun: 9,
    },
    {
      baslik: "Yeni kullanıcı hesabı açılması",
      kanal: "whatsapp",
      oncelik: "orta",
      durum: "beklemede",
      atananId: null,
      projeId: null,
      gecmis: 3,
      cozumGun: null,
    },
  ];

  for (const [i, k] of kayitlar.entries()) {
    const acilis = new Date(Date.now() - k.gecmis * gun);
    const cozum = k.cozumGun === null ? null : new Date(Date.now() - k.cozumGun * gun);
    const kayit = await prisma.destekKaydi.create({
      data: {
        tenantId,
        no: no(),
        firmaId: firmalar[i % firmalar.length].id,
        projeId: k.projeId,
        baslik: k.baslik,
        kanal: k.kanal,
        oncelik: k.oncelik,
        durum: k.durum,
        atananId: k.atananId,
        acanId: yonetici?.id ?? null,
        createdAt: acilis,
        cozumTarihi: cozum,
        kapanisTarihi: k.durum === "kapandi" ? cozum : null,
      },
    });

    // İşlem geçmişi AKTİVİTE olarak yazılır; firma zaman akışında da görünür.
    if (k.durum !== "acik") {
      await prisma.aktivite.create({
        data: {
          tenantId,
          tur: "arama",
          baslik: "Müşteri arandı, durum bilgisi verildi",
          destekId: kayit.id,
          firmaId: kayit.firmaId,
          olusturanId: k.atananId ?? yonetici?.id ?? null,
          createdAt: new Date(acilis.getTime() + gun / 2),
        },
      });
    }
  }

  await prisma.belgeSayac.upsert({
    where: { tenantId_tur_yil: { tenantId, tur: "destek", yil } },
    create: { tenantId, tur: "destek", yil, sonSira: sira },
    update: { sonSira: sira },
  });

  const sorular = [
    {
      soru: "Şifremi unuttum, nasıl sıfırlarım?",
      yanit:
        "Giriş ekranındaki \"Şifremi unuttum\" bağlantısına tıklayın. E-posta adresinize gelen bağlantı 1 saat geçerlidir.",
      kategori: "Hesap",
      etiketler: ["şifre", "giriş"],
      sira: 0,
    },
    {
      soru: "Fatura adresimi nasıl değiştiririm?",
      yanit:
        "Firma detay ekranından Düzenle'ye basıp adres alanını güncelleyin. Değişiklik yalnızca yeni faturalara yansır.",
      kategori: "Faturalama",
      etiketler: ["fatura", "adres"],
      sira: 1,
    },
    {
      soru: "Siparişim neden onay bekliyor?",
      yanit:
        "Her sipariş yönetici onayından geçer. Onay anında stok ve kampanya kotası düşülür; onaylanmadan sevkiyat açılamaz.",
      kategori: "Sipariş",
      etiketler: ["sipariş", "onay"],
      sira: 2,
    },
    {
      soru: "Verilerimin yedeği alınıyor mu?",
      yanit:
        "Evet, her gece otomatik yedek alınır ve son 7 yedek saklanır. Yedekler ekranından elle de yedek alabilir, indirebilirsiniz.",
      kategori: "Güvenlik",
      etiketler: ["yedek", "veri"],
      sira: 3,
    },
  ];
  for (const s of sorular) {
    await prisma.sss.create({ data: { tenantId, ...s, goruntulenme: s.sira * 3 } });
  }

  console.log("✅ Proje/destek verisi: 2 proje, 5 destek kaydı, 4 SSS.");
}

/**
 * Saha çalışması demo verisi (Faz 17).
 *
 * Üç ziyaret üretilir ve ÜÇÜ DE FARKLI doğrulama sonucundadır (doğrulandı /
 * uzak / alınamadı): ziyaret listesi ve rozetleri demo veride de üç durumu
 * birden göstermeli, yoksa "kırmızı nasıl görünüyor" sorusu sınanmamış kalır.
 *
 * Dosya EKİ üretilmez: ek içeriği diskte durur ve seed'in diske yazması,
 * demo veriyi volume'e bağımlı hâle getirirdi.
 */
async function sahaVerisi(tenantId: string) {
  const mevcut = await prisma.ziyaret.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log("ℹ️  Ziyaret verisi zaten var, üretim atlanıyor.");
    return;
  }

  const firmalar = await prisma.firma.findMany({
    where: { tenantId },
    take: 3,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firmalar.length === 0) return;

  // Ankara Kızılay çevresinde üç nokta; koordinatlar demo amaçlıdır.
  const konumlar = [
    { enlem: 39.920777, boylam: 32.854108 },
    { enlem: 39.933365, boylam: 32.859742 },
    { enlem: 39.891234, boylam: 32.812345 },
  ];
  for (const [i, f] of firmalar.entries()) {
    await prisma.firma.update({
      where: { id: f.id },
      data: {
        enlem: konumlar[i].enlem,
        boylam: konumlar[i].boylam,
        konumKaynak: "elle",
      },
    });
  }

  const uye = await prisma.user.findFirst({
    where: { tenantId, role: "uye" },
    select: { id: true },
  });
  const yonetici = await prisma.user.findFirst({
    where: { tenantId, role: { in: ["tenant_admin", "admin"] } },
    select: { id: true },
  });

  const gun = 86_400_000;
  const ziyaretler = [
    // Yerinde: firmanın 40 m yakınında.
    { i: 0, kullanici: uye?.id, gecmis: 1, sure: 55, mesafeM: 40, dogrulama: "dogrulandi", not: "Yıllık sözleşme görüşüldü." },
    // Uzak: 2,4 km — yöneticiye bildirim giden durum.
    { i: 1, kullanici: uye?.id, gecmis: 3, sure: 35, mesafeM: 2400, dogrulama: "uzak", not: "Toplantı firma dışında yapıldı." },
    // Konum alınamadı: izin reddi ya da kapalı GPS.
    { i: 2, kullanici: yonetici?.id, gecmis: 6, sure: 80, mesafeM: null, dogrulama: "alinamadi", not: "Tesis gezisi." },
  ];

  for (const z of ziyaretler) {
    if (!z.kullanici) continue;
    const baslangic = new Date(Date.now() - z.gecmis * gun);
    const bitis = new Date(baslangic.getTime() + z.sure * 60_000);
    const firmaId = firmalar[z.i % firmalar.length].id;

    const aktivite = await prisma.aktivite.create({
      data: {
        tenantId,
        tur: "toplanti",
        baslik: "Saha ziyareti",
        aciklama: z.not,
        firmaId,
        olusturanId: z.kullanici,
        createdAt: bitis,
      },
    });

    await prisma.ziyaret.create({
      data: {
        tenantId,
        firmaId,
        kullaniciId: z.kullanici,
        aktiviteId: aktivite.id,
        baslangic,
        bitis,
        sureDakika: z.sure,
        enlem: z.dogrulama === "alinamadi" ? null : konumlar[z.i % konumlar.length].enlem,
        boylam: z.dogrulama === "alinamadi" ? null : konumlar[z.i % konumlar.length].boylam,
        mesafeM: z.mesafeM,
        dogrulama: z.dogrulama,
        yaricapM: 300,
        not: z.not,
      },
    });
  }

  console.log("✅ Saha verisi: 3 firmaya koordinat, 3 ziyaret (yerinde / uzak / doğrulanamadı).");
}

/**
 * Anket demo verisi (Faz 19).
 *
 * İKİ ANKET üretilir: biri ANONİM (memnuniyet), biri KİMLİKLİ (eğitim geri
 * bildirimi). Anonimliğin veri katmanındaki karşılığı demo veride de
 * görülmeli — anonim ankette yanıt satırlarında gonderimId ve firmaId
 * YAZILMAZ, kimliklide yazılır.
 */
async function anketVerisi(tenantId: string) {
  const mevcut = await prisma.anket.count({ where: { tenantId } });
  if (mevcut > 0) {
    console.log("ℹ️  Anket verisi zaten var, üretim atlanıyor.");
    return;
  }

  const kisiler = await prisma.kisi.findMany({
    where: { tenantId, email: { not: null } },
    take: 12,
    select: { id: true, ad: true, email: true, firmaId: true },
  });
  if (kisiler.length === 0) return;

  const anketler = [
    {
      baslik: "2026 Müşteri Memnuniyeti",
      aciklama: "Hizmetlerimizi değerlendirmeniz bizim için değerli.",
      anonim: true,
      sorular: [
        { tip: "olcek10", metin: "Bizi bir iş ortağınıza tavsiye eder misiniz?", zorunlu: true, secenekler: [] as string[] },
        { tip: "olcek5", metin: "Genel memnuniyetiniz", zorunlu: true, secenekler: [] as string[] },
        { tip: "coktan", metin: "Hangi hizmetimizi kullanıyorsunuz?", zorunlu: false, secenekler: ["Danışmanlık", "Eğitim", "Yazılım", "Diğer"] },
        { tip: "metin", metin: "Eklemek istedikleriniz", zorunlu: false, secenekler: [] as string[] },
      ],
    },
    {
      baslik: "Eğitim Geri Bildirimi",
      aciklama: "Katıldığınız eğitim hakkındaki görüşleriniz.",
      anonim: false,
      sorular: [
        { tip: "olcek5", metin: "Eğitimin içeriği beklentinizi karşıladı mı?", zorunlu: true, secenekler: [] as string[] },
        { tip: "evethayir", metin: "Eğitimi başkalarına önerir misiniz?", zorunlu: true, secenekler: [] as string[] },
        { tip: "metin", metin: "Görüşleriniz", zorunlu: false, secenekler: [] as string[] },
      ],
    },
  ];

  for (const [ai, a] of anketler.entries()) {
    const anket = await prisma.anket.create({
      data: {
        tenantId,
        baslik: a.baslik,
        aciklama: a.aciklama,
        anonim: a.anonim,
        durum: "yayinda",
        bitisTarihi: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const soruIdler: string[] = [];
    for (const [si, soru] of a.sorular.entries()) {
      const kayit = await prisma.anketSorusu.create({
        data: {
          tenantId,
          anketId: anket.id,
          sira: si,
          tip: soru.tip,
          metin: soru.metin,
          secenekler: soru.secenekler,
          zorunlu: soru.zorunlu,
        },
      });
      soruIdler.push(kayit.id);
    }

    // Altı kişiye gönderilir, dördü yanıtlar — yanıtlama oranı demo veride
    // de %100 olmasın ki rapor gerçekçi görünsün.
    const alicilar = kisiler.slice(ai * 6, ai * 6 + 6);
    for (const [ki, kisi] of alicilar.entries()) {
      const yanitladi = ki < 4;
      const gonderim = await prisma.anketGonderim.create({
        data: {
          tenantId,
          anketId: anket.id,
          firmaId: kisi.firmaId,
          kisiId: kisi.id,
          ad: kisi.ad,
          email: kisi.email!,
          // Demo veride token'ın kendisi hiç üretilmez; yalnızca benzersiz
          // bir özet yazılır — bağlantı zaten gönderilmedi.
          tokenOzeti: `demo-${anket.id}-${kisi.id}`,
          gonderimTarihi: new Date(Date.now() - (10 - ki) * 86_400_000),
          yanitTarihi: yanitladi
            ? new Date(Date.now() - (8 - ki) * 86_400_000)
            : null,
        },
      });

      if (!yanitladi) continue;

      const grup = `demo-grup-${anket.id}-${ki}`;
      for (const [si, soru] of a.sorular.entries()) {
        const deger =
          soru.tip === "olcek10"
            ? String([10, 9, 7, 4][ki % 4])
            : soru.tip === "olcek5"
              ? String([5, 4, 4, 3][ki % 4])
              : soru.tip === "evethayir"
                ? (ki % 3 === 0 ? "hayir" : "evet")
                : soru.tip === "coktan"
                  ? soru.secenekler[ki % soru.secenekler.length]
                  : ["Ekip çok ilgili.", "Süreç biraz yavaş ilerledi.", "Memnunuz.", "Raporlama geliştirilebilir."][ki % 4];

        await prisma.anketYanit.create({
          data: {
            tenantId,
            anketId: anket.id,
            soruId: soruIdler[si],
            // ANONİM ANKETTE KİMLİK BAĞI YAZILMAZ.
            gonderimId: a.anonim ? null : gonderim.id,
            firmaId: a.anonim ? null : kisi.firmaId,
            yanitGrubu: grup,
            deger,
          },
        });
      }
    }
  }

  console.log("✅ Anket verisi: 2 anket (1 anonim), 12 gönderim, 8 yanıt.");
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
      // Faz 13 / H1 — demo veri de gerçek numaralandırmayı taşır.
      firmaNo: firmaNoUret(i + 1),
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

  // Sayaç, üretilen son numaranın üstünden devam etsin — aksi halde arayüzden
  // açılan ilk firma A0001'i ikinci kez isterdi ve tekil kısıt hata verirdi.
  await prisma.firmaNoSayac.upsert({
    where: { tenantId },
    create: { tenantId, sonSira: firmaData.length },
    update: { sonSira: firmaData.length },
  });

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

  // ── Faz 6: kişiler ve fırsatlar ─────────────────────────────────────────
  // Kişi her firmaya, fırsat firmaların bir kısmına üretilir. Kanban'ın boş
  // açılmaması için fırsatlar aşamalara dağıtılır.
  const asamalar = await asamalariKur(tenantId);
  const kullanicilar = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const kisiler: any[] = [];
  for (const f of firmalar) {
    const kisiSayisi = rndInt(1, 3);
    for (let k = 0; k < kisiSayisi; k++) {
      kisiler.push({
        tenantId,
        firmaId: f.id,
        ad: `${rnd(ADLAR)} ${rnd(SOYADLAR)}`,
        unvan: rnd(UNVANLAR),
        departman: rnd(DEPARTMANLAR as unknown as string[]),
        telefon: `0${rndInt(500, 555)} ${rndInt(100, 999)} ${rndInt(10, 99)} ${rndInt(10, 99)}`,
        email: `kisi${kisiler.length + 1}@firma.com.tr`,
        birincil: k === 0, // ilk kişi birincil muhatap
      });
    }
  }
  for (let i = 0; i < kisiler.length; i += BATCH)
    await prisma.kisi.createMany({ data: kisiler.slice(i, i + BATCH) });

  const uretilenKisiler = await prisma.kisi.findMany({
    where: { tenantId },
    select: { id: true, firmaId: true },
  });
  const firmaKisi = new Map<string, string>();
  for (const k of uretilenKisiler) if (!firmaKisi.has(k.firmaId)) firmaKisi.set(k.firmaId, k.id);

  const firsatlar: any[] = [];
  for (const f of firmalar) {
    if (Math.random() > 0.35) continue;
    const asama = rnd(asamalar);
    const durum =
      Math.random() < 0.7 ? "acik" : Math.random() < 0.6 ? "kazanildi" : "kaybedildi";
    firsatlar.push({
      tenantId,
      firmaId: f.id,
      kisiId: firmaKisi.get(f.id) ?? null,
      asamaId: asama.id,
      baslik: rnd(FIRSAT_BASLIKLARI),
      tutar: rndInt(25, 900) * 1000,
      paraBirimi: "TRY",
      olasilik: durum === "kazanildi" ? 100 : durum === "kaybedildi" ? 0 : asama.olasilik,
      kapanisTarihi: rndTarih(-90),
      sorumluId: kullanicilar.length ? rnd(kullanicilar).id : null,
      durum,
      kapanisSebebi: durum === "kaybedildi" ? rnd(["Fiyat", "Rakip", "Bütçe iptal"]) : null,
    });
  }
  for (let i = 0; i < firsatlar.length; i += BATCH)
    await prisma.firsat.createMany({ data: firsatlar.slice(i, i + BATCH) });

  // ── Faz 7: aktiviteler, adaylar ve teklifler ────────────────────────────
  const uretilenFirsatlar = await prisma.firsat.findMany({
    where: { tenantId },
    select: { id: true, firmaId: true, baslik: true, tutar: true, kisiId: true },
  });

  // Aktiviteler: bir kısmı geçmiş kayıt (not/arama), bir kısmı açık görev.
  const aktiviteler: any[] = [];
  for (const f of uretilenFirsatlar) {
    for (let k = 0; k < rndInt(1, 3); k++) {
      const gorev = Math.random() < 0.4;
      aktiviteler.push({
        tenantId,
        firmaId: f.firmaId,
        firsatId: f.id,
        kisiId: f.kisiId,
        tur: gorev ? "gorev" : rnd(["arama", "toplanti", "eposta", "not"]),
        baslik: rnd(AKTIVITE_BASLIKLARI),
        // Görevlerin bir kısmı bugüne/geçmişe düşsün ki "Bugün" sekmesi dolu olsun.
        sonTarih: gorev ? rndTarih(rndInt(-20, 10)) : null,
        tamamlandi: gorev && Math.random() < 0.35 ? rndTarih(20) : null,
        atananId: kullanicilar.length ? rnd(kullanicilar).id : null,
        createdAt: rndTarih(180),
      });
    }
  }
  for (let i = 0; i < aktiviteler.length; i += BATCH)
    await prisma.aktivite.createMany({ data: aktiviteler.slice(i, i + BATCH) });

  // Adaylar — bir kısmı dönüşmüş sayılmaz; dönüşüm elle denenebilsin.
  const leadler = Array.from({ length: Math.max(8, Math.round(firmaSayisi / 25)) }).map(() => ({
    tenantId,
    ad: `${rnd(ADLAR)} ${rnd(SOYADLAR)}`,
    firmaAd: `${rnd(FIRMA_EKLERI)} ${rnd(SEKTORLER)} Ltd. Şti.`,
    unvan: rnd(UNVANLAR),
    email: `aday${rndInt(1000, 9999)}@ornek.com`,
    telefon: `0${rndInt(500, 555)} ${rndInt(100, 999)} ${rndInt(10, 99)} ${rndInt(10, 99)}`,
    il: rnd(ILLER),
    sektor: rnd(SEKTORLER),
    kaynak: rnd(LEAD_KAYNAK_ORNEK),
    durum: rnd(["yeni", "yeni", "iletisim", "nitelikli", "elendi"]),
    atananId: kullanicilar.length ? rnd(kullanicilar).id : null,
    createdAt: rndTarih(120),
  }));
  await prisma.lead.createMany({ data: leadler });

  // Teklifler — açık fırsatların bir kısmına kalemli teklif.
  let teklifSayisi = 0;
  let kalemSayisi = 0;
  const yil = new Date().getFullYear();
  for (const f of uretilenFirsatlar) {
    if (Math.random() > 0.3) continue;
    teklifSayisi++;

    const secilenler = [rnd(TEKLIF_KALEMLERI), rnd(TEKLIF_KALEMLERI)];
    const kalemler = secilenler.map((k, i) => {
      const miktar = rndInt(1, 12);
      return { ...k, sira: i, miktar, tutar: miktar * k.birimFiyat };
    });

    const araToplam = kalemler.reduce((s, k) => s + k.tutar, 0);
    const indirimOrani = rnd([0, 0, 5, 10]);
    const indirimTutari = (araToplam * indirimOrani) / 100;
    const kdvTutari = ((araToplam - indirimTutari) * 20) / 100;

    const durum = rnd(["taslak", "gonderildi", "gonderildi", "kabul", "red"]);
    const teklif = await prisma.teklif.create({
      data: {
        tenantId,
        firmaId: f.firmaId,
        firsatId: f.id,
        kisiId: f.kisiId,
        no: `TKF-${yil}-${String(teklifSayisi).padStart(4, "0")}`,
        baslik: `${f.baslik} teklifi`,
        durum,
        paraBirimi: "TRY",
        indirimOrani,
        kdvOrani: 20,
        araToplam,
        indirimTutari,
        kdvTutari,
        toplam: araToplam - indirimTutari + kdvTutari,
        gecerlilikTarihi: rndTarih(-30),
        gonderimTarihi: durum === "taslak" ? null : rndTarih(60),
        olusturanEmail: "seed@gezegen.com",
      },
    });

    await prisma.teklifKalemi.createMany({
      data: kalemler.map((k) => ({ tenantId, teklifId: teklif.id, ...k })),
    });
    kalemSayisi += kalemler.length;
  }

  // ── Faz 8: örnek iş akışı kuralları ─────────────────────────────────────
  // Kurallar zamanlanmış çalışır; burada yalnızca TANIMLANIR ki otomasyon
  // ekranı boş açılmasın ve "şimdi çalıştır" denenebilsin.
  const kurallar = [
    {
      ad: "Bekleyen fırsatları hatırlat",
      aciklama: "7 gündür hareketsiz açık fırsatların sorumlusuna bildirim gönderir.",
      tetikleyici: "firsat.beklemede",
      kosullar: { gun: 7 },
      eylemler: [{ tur: "bildirim", baslik: "{kayit} 7 gündür hareketsiz" }],
    },
    {
      ad: "Yaklaşan görevleri bildir",
      aciklama: "Son tarihine 2 gün kalan görevler için bildirim gönderir.",
      tetikleyici: "gorev.yaklasti",
      kosullar: { gun: 2 },
      eylemler: [{ tur: "bildirim", baslik: "Görev yaklaşıyor: {kayit}" }],
    },
    {
      ad: "Süresi dolan teklifleri takip et",
      aciklama: "Geçerliliğine 3 gün kalan tekliflerde takip görevi açar.",
      tetikleyici: "teklif.suresiDoluyor",
      kosullar: { gun: 3 },
      eylemler: [
        { tur: "bildirim", baslik: "{kayit} geçerliliği doluyor" },
        { tur: "gorev", baslik: "Teklifi takip et: {kayit}", gun: 1 },
      ],
    },
  ];
  for (const k of kurallar) {
    const mevcut = await prisma.isAkisi.findFirst({ where: { tenantId, ad: k.ad } });
    if (!mevcut) await prisma.isAkisi.create({ data: { tenantId, ...k } as never });
  }

  console.log(
    `✅ ${etiket}: ${firmaSayisi} firma, ${yatirimlar.length} yatırım, ` +
      `${egitimler.length} eğitim, ${hizmetler.length} hizmet, ` +
      `${kisiler.length} kişi, ${firsatlar.length} fırsat, ` +
      `${aktiviteler.length} aktivite, ${leadler.length} aday, ` +
      `${teklifSayisi} teklif (${kalemSayisi} kalem), ${kurallar.length} iş akışı.`
  );
}

/** Kiracının satış hattını kurar (varsa dokunmaz). */
async function asamalariKur(tenantId: string) {
  for (const a of VARSAYILAN_ASAMALAR) {
    const mevcut = await prisma.asama.findFirst({ where: { tenantId, ad: a.ad } });
    if (!mevcut) await prisma.asama.create({ data: { tenantId, ...a } });
  }
  return prisma.asama.findMany({ where: { tenantId }, orderBy: { sira: "asc" } });
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
      aciklama: "Küçük ekipler için — yatırım, hizmet, fırsat ve teklif kapalı",
      kullaniciLimiti: 3,
      firmaLimiti: 25,
      // Bilinçli olarak dar: paket kısıtının gerçekten çalıştığı bir hesapla
      // denenebilsin diye "firsat" ve "hizmet" burada kapalıdır.
      moduller: ["firma", "egitim", "kisi", "aktivite", "takvim", "rapor"],
    },
    {
      ad: "Profesyonel",
      aciklama: "Tüm modüller, orta ölçekli kuruluşlar için",
      kullaniciLimiti: 25,
      firmaLimiti: 500,
      moduller: [
        "firma", "yatirim", "egitim", "hizmet", "kisi", "firsat",
        "aktivite", "lead", "teklif", "takvim", "otomasyon", "rapor", "ozelalan",
        // Faz 14 — ticari çekirdek. DİKKAT: yeni bir paket modülü eklendiğinde
        // BURASI da güncellenmelidir. Migration mevcut paketlere modülü ekler
        // ama seed paketleri SIFIRDAN yaratır; liste eksik kalırsa modül
        // kapalı sayılır ve ekranlar /yetkisiz'e düşer (bir kez yaşandı).
        "urun", "kampanya", "stok",
        "siparis", "sevkiyat",
        "proje", "destek", "sss",
        "dosya", "ziyaret", "anket",
        // Faz 21 — AI. Modül paketlerde AÇIKTIR ama `Tenant.aiAcik`
        // varsayılan false olduğu için kiracıda kendiliğinden çalışmaz.
        "ai",
      ],
    },
    {
      ad: "Kurumsal",
      aciklama: "Sınırsız kullanıcı ve firma",
      kullaniciLimiti: 0,
      firmaLimiti: 0,
      moduller: [
        "firma", "yatirim", "egitim", "hizmet", "kisi", "firsat",
        "aktivite", "lead", "teklif", "takvim", "otomasyon", "rapor", "ozelalan",
        // Faz 14 — ticari çekirdek. DİKKAT: yeni bir paket modülü eklendiğinde
        // BURASI da güncellenmelidir. Migration mevcut paketlere modülü ekler
        // ama seed paketleri SIFIRDAN yaratır; liste eksik kalırsa modül
        // kapalı sayılır ve ekranlar /yetkisiz'e düşer (bir kez yaşandı).
        "urun", "kampanya", "stok",
        "siparis", "sevkiyat",
        "proje", "destek", "sss",
        "dosya", "ziyaret", "anket",
        // Faz 21 — AI. Modül paketlerde AÇIKTIR ama `Tenant.aiAcik`
        // varsayılan false olduğu için kiracıda kendiliğinden çalışmaz.
        "ai",
      ],
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

  // Platform kiracısının da çalışabilir bir hattı olsun (iş verisi üretilmez).
  await asamalariKur(platform.id);

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

  // --- Örnek özel alanlar (Faz 11 / E6) — yalnızca Gezegen kiracısında ---
  // Diğer kiracıda YOK: özel alanların kiracıya özel olduğu elle de görülsün.
  const ozelAlanlar = [
    { varlik: "firma", ad: "Müşteri No", tip: "metin", secenekler: [], zorunlu: false, sira: 1 },
    {
      varlik: "firma",
      ad: "Segment",
      tip: "secim",
      secenekler: ["Altın", "Gümüş", "Bronz"],
      zorunlu: false,
      sira: 2,
    },
    { varlik: "kisi", ad: "LinkedIn", tip: "metin", secenekler: [], zorunlu: false, sira: 1 },
    { varlik: "firsat", ad: "İhale No", tip: "metin", secenekler: [], zorunlu: false, sira: 1 },
  ];
  for (const a of ozelAlanlar) {
    const mevcut = await prisma.ozelAlan.findFirst({
      where: { tenantId: gezegen.id, varlik: a.varlik, ad: a.ad },
    });
    if (!mevcut) await prisma.ozelAlan.create({ data: { tenantId: gezegen.id, ...a } });
  }
  console.log("✅ Örnek özel alanlar hazır (Müşteri No, Segment, LinkedIn, İhale No).");

  // --- Ticari çekirdek (Faz 14) — katalog, paket, kampanya, stok ---
  const ticariUrunler = await ticariVeri(gezegen.id);

  await veriUret(gezegen.id, 800, "Gezegen Danışmanlık");
  if (ticariUrunler) await siparisVerisi(gezegen.id, ticariUrunler);
  await projeDestekVerisi(gezegen.id);
  await sahaVerisi(gezegen.id);
  await anketVerisi(gezegen.id);
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
