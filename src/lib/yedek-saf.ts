import { gzipSync, gunzipSync } from "node:zlib";
import { firmaNoSira, firmaNoUret } from "./firma-no-saf";

/**
 * Bu dosya bilinçli olarak `server-only` DEĞİLDİR (yetki-tanimlar deseni):
 * testler tam yedekleme/geri yükleme hattını veritabanıyla doğrudan sınar.
 * İstemci tipi YAPISALDIR — tenant-db'ye bağımlılık yoktur; hem kiracı
 * katmanının istemcisi hem testlerdeki RLS istemcisi uyar. `tenantId`
 * parametre olarak açıkça alınır ve her yazılan satıra damgalanır; RLS'in
 * WITH CHECK politikası yanlış kiracıya yazmayı zaten reddeder.
 */
/**
 * Prisma istemcisini yapısal tipe indirger. Prisma'nın üretilmiş imzaları
 * `unknown` parametre kabul etmediği için doğrudan atama TypeScript'te
 * uyuşmaz; çalışma zamanında birebir aynı nesnedir. Dönüşüm TEK buradadır —
 * çağrı yerlerine `as never` serpiştirilmez.
 */
export function yedekIstemcisi(db: unknown): YedekIstemcisi {
  return db as YedekIstemcisi;
}

export type YedekIstemcisi = Record<
  string,
  {
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args?: unknown) => Promise<Record<string, unknown> | null>;
    create: (args: unknown) => Promise<{ id: string }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    upsert: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  }
>;

/**
 * Kiracı yedeği — Faz 10 / E7.
 *
 * KAPSAM: iş verisi. Kullanıcılar, gruplar ve denetim günlüğü BİLİNÇLİ
 * olarak dışarıdadır — kimlik verisi geri yüklemeyle çoğaltılmamalı
 * (parola hash'leri taşınmamalı) ve denetim günlüğü değiştirilemez olduğu
 * için "geri yüklenmesi" kavramın kendisiyle çelişir.
 *
 * GERİ YÜKLEME EKLEYİCİDİR: yalnızca VAR OLMAYAN kayıtlar (id'ye göre)
 * eklenir, mevcut kayıtlara dokunulmaz. "Yanlışlıkla sildim" senaryosunu
 * çözer ve iki kez çalıştırmak zararsızdır. Silip baştan kurma davranışı
 * bilinçli olarak YOKTUR — bir geri yüklemenin mevcut veriyi ezebilmesi,
 * yedeğin çözdüğünden daha büyük bir kaza kapısı açardı.
 *
 * Yedek dosyası gzip'li JSON'dur; hem veritabanında saklanır (hızlı geri
 * dönüş) hem indirilebilir (gerçek yedek her zaman dışarıda tutulandır).
 */

export const YEDEK_BICIM_SURUMU = 1;

/**
 * Dışa alınan modeller — SIRALI. Geri yüklemede aynı sıra kullanılır ki
 * FK bağları tutarsın (firma kişiden önce, teklif kaleminden önce).
 */
const MODELLER = [
  "firma",
  "asama",
  "kisi",
  "firsat",
  "aktivite",
  "lead",
  "teklif",
  "teklifKalemi",
  "yatirimDestegi",
  "egitim",
  "hizmet",
  // Faz 11 — özel alan tanımları ve değerleri. Tanım (ozelAlan) değerden
  // önce gelir: OzelAlanDeger.alanId ona bağlıdır. Değer satırlarının
  // firma/kisi/firsat FK'leri de yukarıdaki sıralar sayesinde hazırdır.
  "ozelAlan",
  "ozelAlanDeger",
] as const;

type YedekModeli = (typeof MODELLER)[number];

/** JSON'a çevrilen tarih alanları — geri yüklemede Date'e döndürülür. */
const TARIH_ALANLARI: Record<YedekModeli, string[]> = {
  firma: ["createdAt", "updatedAt"],
  asama: ["createdAt", "updatedAt"],
  kisi: ["createdAt", "updatedAt"],
  firsat: ["kapanisTarihi", "createdAt", "updatedAt"],
  aktivite: ["sonTarih", "tamamlandi", "createdAt", "updatedAt"],
  lead: ["donusumTarihi", "createdAt", "updatedAt"],
  teklif: ["gecerlilikTarihi", "gonderimTarihi", "createdAt", "updatedAt"],
  teklifKalemi: [],
  yatirimDestegi: ["tarih", "createdAt"],
  egitim: ["tarih", "createdAt"],
  hizmet: ["tarih", "createdAt"],
  ozelAlan: ["createdAt", "updatedAt"],
  ozelAlanDeger: ["updatedAt"],
};

export type YedekIcerigi = {
  bicim: number;
  surum: string;
  tarih: string;
  veriler: Record<string, Record<string, unknown>[]>;
};

export type YedekOzeti = {
  id: string;
  kayitSayisi: number;
  boyut: number;
};

/** Kiracının bütün iş verisini okuyup Yedek satırı olarak saklar. */
export async function yedekOlustur(
  db: YedekIstemcisi,
  tenantId: string,
  tur: "elle" | "otomatik" | "yukleme",
  olusturanEmail?: string,
  hazirIcerik?: YedekIcerigi
): Promise<YedekOzeti> {
  const icerik: YedekIcerigi =
    hazirIcerik ?? {
      bicim: YEDEK_BICIM_SURUMU,
      surum: process.env.APP_VERSION ?? "0.0.0",
      tarih: new Date().toISOString(),
      veriler: {},
    };

  if (!hazirIcerik) {
    for (const model of MODELLER) {
      const satirlar = await db[model].findMany({});

      // `tenantId` dosyaya YAZILMAZ: geri yüklemede kiracı katmanı oturumun
      // kiracısını damgalar. Böylece dosya, indirilip başka bir kuruluşa
      // taşınsa bile eski kiracı kimliğini sızdırmaz.
      icerik.veriler[model] = satirlar.map(({ tenantId: _t, ...kalan }) => kalan);
    }
  }

  const kayitSayisi = Object.values(icerik.veriler).reduce(
    (s, v) => s + v.length,
    0
  );
  const sikistirilmis = gzipSync(Buffer.from(JSON.stringify(icerik), "utf8"));

  const kayit = await db.yedek.create({
    data: {
      tenantId,
      tur,
      kayitSayisi,
      boyut: sikistirilmis.length,
      surum: icerik.surum,
      icerik: sikistirilmis,
      olusturanEmail: olusturanEmail ?? null,
    },
  });

  return { id: kayit.id, kayitSayisi, boyut: sikistirilmis.length };
}

/** Saklanan yedeği açar. Bozuk/uyumsuz içerikte `null` döner. */
export function yedekAc(sikistirilmis: Buffer | Uint8Array): YedekIcerigi | null {
  try {
    const metin = gunzipSync(Buffer.from(sikistirilmis)).toString("utf8");
    const icerik = JSON.parse(metin) as YedekIcerigi;
    if (icerik.bicim !== YEDEK_BICIM_SURUMU || typeof icerik.veriler !== "object") {
      return null;
    }
    return icerik;
  } catch {
    return null;
  }
}

/** İndirilen dosyadan (düz JSON ya da gzip) içerik çıkarır. */
export function dosyadanIcerik(tampon: Buffer): YedekIcerigi | null {
  // gzip imzası: 1f 8b
  if (tampon.length > 2 && tampon[0] === 0x1f && tampon[1] === 0x8b) {
    return yedekAc(tampon);
  }
  try {
    const icerik = JSON.parse(tampon.toString("utf8")) as YedekIcerigi;
    return icerik.bicim === YEDEK_BICIM_SURUMU && typeof icerik.veriler === "object"
      ? icerik
      : null;
  } catch {
    return null;
  }
}

export type GeriYuklemeSonucu = {
  eklenen: Record<string, number>;
  atlanan: Record<string, number>;
  toplamEklenen: number;
};

/**
 * Yedeği geri yükler — yalnızca var olmayan kayıtları ekler.
 *
 * `createMany({ skipDuplicates: true })` sayesinde id çakışan satırlar
 * sessizce atlanır; işlem idempotenttir. Kiracı katmanı her satıra oturumun
 * `tenantId`'sini damgalar — dosyanın içinden gelen hiçbir kiracı kimliğine
 * güvenilmez.
 */
export async function geriYukle(
  db: YedekIstemcisi,
  tenantId: string,
  icerik: YedekIcerigi
): Promise<GeriYuklemeSonucu> {
  const sonuc: GeriYuklemeSonucu = { eklenen: {}, atlanan: {}, toplamEklenen: 0 };

  // Faz 13 / H1 — firma numarası kiracı içinde TEKİLDİR. Kendi yedeğini geri
  // yükleyen bir kuruluşta numaralar zaten boştadır (kayıt silinmişti) ve
  // olduğu gibi korunur. Dosya BAŞKA bir kuruluşa yüklendiğindeyse numara
  // çakışabilir; çakışan satırın numarası boşaltılır ve geri yükleme sonunda
  // sıradaki numara verilir. Numarayı olduğu gibi bırakmak, `skipDuplicates`
  // yüzünden firmanın SESSİZCE hiç eklenmemesine yol açardı.
  const doluNumaralar = new Set(
    (await db.firma.findMany({ where: { tenantId }, select: { firmaNo: true } }))
      .map((f) => f.firmaNo)
      .filter((n): n is string => typeof n === "string")
  );

  for (const model of MODELLER) {
    const ham = icerik.veriler[model];
    if (!Array.isArray(ham) || ham.length === 0) continue;

    const tarihAlanlari = TARIH_ALANLARI[model];
    let satirlar = ham.map((satir) => {
      // Dosyadan gelen kiracı kimliğine güvenilmez: oturumunki damgalanır.
      const kopya: Record<string, unknown> = { ...satir, tenantId };
      for (const alan of tarihAlanlari) {
        if (typeof kopya[alan] === "string") kopya[alan] = new Date(kopya[alan] as string);
      }
      return kopya;
    });

    if (model === "firma") {
      satirlar = satirlar.map((s) =>
        typeof s.firmaNo === "string" && doluNumaralar.has(s.firmaNo)
          ? { ...s, firmaNo: null }
          : s
      );
    }

    // Teklif revizyon zinciri kendi tablosuna FK verir: üst teklif, revizyondan
    // ÖNCE eklenmelidir. revizyonNo'ya göre sıralamak bunu garanti eder.
    if (model === "teklif") {
      satirlar = [...satirlar].sort(
        (a, b) => ((a.revizyonNo as number) ?? 1) - ((b.revizyonNo as number) ?? 1)
      );
    }

    const yazim = await db[model].createMany({ data: satirlar, skipDuplicates: true });

    sonuc.eklenen[model] = yazim.count;
    sonuc.atlanan[model] = satirlar.length - yazim.count;
    sonuc.toplamEklenen += yazim.count;
  }

  await firmaNolariniTamamla(db, tenantId);
  return sonuc;
}

/**
 * Numarasız kalan firmalara sıradaki numarayı verir ve sayacı gerçek duruma
 * çeker (Faz 13 / H1).
 *
 * Geri yüklemeden sonra ÇAĞRILMASI ZORUNLUDUR: yedekten gelen numaralar
 * sayacı ilerletmez, dolayısıyla resenkron edilmezse arayüzden açılan ilk
 * firma zaten kullanılmış bir numarayı isterdi.
 */
async function firmaNolariniTamamla(
  db: YedekIstemcisi,
  tenantId: string
): Promise<void> {
  const firmalar = (await db.firma.findMany({
    where: { tenantId },
    select: { id: true, firmaNo: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as { id: string; firmaNo: string | null }[];

  const dolu = new Set(
    firmalar.map((f) => f.firmaNo).filter((n): n is string => typeof n === "string")
  );

  // Kullanılmış en büyük sıradan devam edilir; aradaki boşluklar bilinçli
  // olarak DOLDURULMAZ — silinen firmanın numarası başkasına verilemez.
  let sira = 0;
  for (const no of dolu) sira = Math.max(sira, firmaNoSira(no) ?? 0);

  for (const f of firmalar) {
    if (f.firmaNo) continue;
    const no = firmaNoUret(++sira);
    if (!no) break; // kapasite doldu — kalanlar numarasız kalır, veri kaybolmaz
    await db.firma.updateMany({ where: { id: f.id, tenantId }, data: { firmaNo: no } });
  }

  await db.firmaNoSayac.upsert({
    where: { tenantId },
    create: { tenantId, sonSira: sira },
    update: { sonSira: sira },
  });
}

/** Saklanacak otomatik yedek sayısı — eskisi budanır. */
const OTOMATIK_SAKLAMA = 7;

/**
 * Zamanlanmış otomatik yedek (çalıştırıcıdan çağrılır).
 *
 * Son otomatik yedek 23 saatten yeniyse hiçbir şey yapmaz — çalıştırıcı
 * 10 dakikada bir koşsa da yedek günde bir alınır.
 */
export async function otomatikYedekAl(
  db: YedekIstemcisi,
  tenantId: string
): Promise<{ alindi: boolean }> {
  const esik = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const son = await db.yedek.findFirst({
    where: { tur: "otomatik", createdAt: { gte: esik } },
    select: { id: true },
  });
  if (son) return { alindi: false };

  await yedekOlustur(db, tenantId, "otomatik");

  // Budama: en yeni OTOMATIK_SAKLAMA otomatik yedek kalır.
  const eskiler = await db.yedek.findMany({
    where: { tur: "otomatik" },
    orderBy: { createdAt: "desc" },
    skip: OTOMATIK_SAKLAMA,
    select: { id: true },
  });
  if (eskiler.length > 0) {
    await db.yedek.deleteMany({
      where: { id: { in: eskiler.map((e) => e.id as string) } },
    });
  }

  return { alindi: true };
}
