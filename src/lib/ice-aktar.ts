import "server-only";
import { DEPARTMANLAR } from "./constants";
import ExcelJS from "exceljs";
import {
  getTenantDb,
  tenantOlustur,
  type TenantClient,
} from "./tenant-db";
import { veriKumesiBul } from "./disa-aktar-tanimlar";
import {
  AZAMI_SATIR,
  csvOku,
  sayiya,
  tariheCevir,
  type OkunanDosya,
  type SatirSonucu,
} from "./ice-aktar-saf";

// Saf katman buradan yeniden dışa aktarılır ki çağıranlar tek yerden
// ithal edebilsin.
export * from "./ice-aktar-saf";
import { firmaLimitiAsildiMi } from "./kiraci-ayar";

/**
 * İçe aktarım — Faz 9 / E2.
 *
 * Müşteri devreye alma (onboarding) için kritik: yeni bir kuruluşun elindeki
 * Excel dosyası CRM'e girmeden sistem kullanılmaya başlanamaz.
 *
 * AKIŞ ÜÇ ADIMDIR ve ikisi kaydetmeden önce gelir:
 *   1. Dosya okunur, başlık satırı çıkarılır.
 *   2. Sütunlar eşleştirilir (otomatik öneri + elle düzeltme).
 *   3. ÖN İZLEME: her satır doğrulanır, hatalar gösterilir, kullanıcı onaylar.
 *
 * Doğrulama olmadan doğrudan yazan bir içe aktarım, bir kuruluşun verisini
 * tek hamlede çöpe çevirebilir. Bu yüzden yazma yalnızca son adımdadır ve
 * HATALI SATIRLAR ATLANIR — bir satır yüzünden 500 satırlık aktarım
 * düşmemelidir.
 */

/**
 * Yüklenen dosyayı okur (.xlsx veya .csv).
 *
 * Dosya türü uzantıdan DEĞİL içerikten anlaşılır: ZIP imzası (PK) varsa
 * Excel, yoksa metin. Kullanıcının uzantıyı yanlış vermesi sık görülür.
 */
export async function dosyaOku(dosya: File): Promise<OkunanDosya> {
  const tampon = Buffer.from(await dosya.arrayBuffer());
  const excelMi = tampon.length > 1 && tampon[0] === 0x50 && tampon[1] === 0x4b;

  const satirlar = excelMi ? await excelOku(tampon) : csvOku(tampon);

  if (satirlar.length === 0) {
    return { basliklar: [], satirlar: [], toplamSatir: 0 };
  }

  const [basliklar, ...govde] = satirlar as string[][];
  const dolu = govde.filter((s) => s.some((h) => h.trim() !== ""));

  return {
    basliklar: basliklar.map((b) => b.trim()),
    satirlar: dolu.slice(0, AZAMI_SATIR),
    toplamSatir: dolu.length,
  };
}

async function excelOku(tampon: Buffer): Promise<string[][]> {
  const kitap = new ExcelJS.Workbook();
  await kitap.xlsx.load(tampon as unknown as ArrayBuffer);

  const sayfa = kitap.worksheets[0];
  if (!sayfa) return [];

  const satirlar: string[][] = [];
  sayfa.eachRow((satir) => {
    const hucreler: string[] = [];
    // `values` 1 tabanlıdır; 0. eleman boştur.
    const degerler = satir.values as unknown[];
    for (let i = 1; i < degerler.length; i++) {
      hucreler.push(hucreMetni(degerler[i]));
    }
    satirlar.push(hucreler);
  });
  return satirlar;
}

function hucreMetni(deger: unknown): string {
  if (deger == null) return "";
  if (deger instanceof Date) return deger.toISOString().slice(0, 10);
  if (typeof deger === "object") {
    // Formül hücresi ya da zengin metin: görünen değeri al.
    const o = deger as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return String(o.text);
    if (o.result != null) return String(o.result);
    return "";
  }
  return String(deger).trim();
}

// ── Yazma ────────────────────────────────────────────────────────────────

export type YazmaSonucu = {
  eklenen: number;
  atlanan: number;
  hatalar: { satirNo: number; hata: string }[];
};

/**
 * Doğrulanmış satırları yazar.
 *
 * Firma adına göre eşleşme yapılır: aynı adlı firma varsa YENİDEN
 * OLUŞTURULMAZ, mevcut kayda bağlanır. Aksi halde alt kayıt içe aktarımı
 * her seferinde firma kopyaları üretirdi.
 */
export async function satirlariYaz(
  kumeAdi: string,
  satirlar: SatirSonucu[]
): Promise<YazmaSonucu> {
  const kume = veriKumesiBul(kumeAdi);
  if (!kume?.iceAktarilir) {
    return { eklenen: 0, atlanan: satirlar.length, hatalar: [] };
  }

  const db = await getTenantDb();
  const gecerliler = satirlar.filter((s) => s.durum === "gecerli");

  const sonuc: YazmaSonucu = { eklenen: 0, atlanan: 0, hatalar: [] };

  // Firma adı → id önbelleği: her satırda yeniden sorgu atmamak için.
  const firmaOnbellek = new Map<string, string>();

  async function firmaBulYaOlustur(ad: string): Promise<string | null> {
    const anahtar = ad.toLocaleLowerCase("tr");
    const onbellekte = firmaOnbellek.get(anahtar);
    if (onbellekte) return onbellekte;

    const mevcut = await db.firma.findFirst({
      where: { ad: { equals: ad, mode: "insensitive" } },
      select: { id: true },
    });
    if (mevcut) {
      firmaOnbellek.set(anahtar, mevcut.id);
      return mevcut.id;
    }

    // Yeni firma açmak paket limitine tabidir.
    const limit = await firmaLimitiAsildiMi();
    if (limit) return null;

    const yeni = await tenantOlustur(db, "firma", { ad, durum: "aktif" });
    firmaOnbellek.set(anahtar, yeni.id);
    return yeni.id;
  }

  for (const satir of gecerliler) {
    try {
      await satirYaz(db, kume.deger, satir.veri, firmaBulYaOlustur);
      sonuc.eklenen++;
    } catch (e) {
      sonuc.atlanan++;
      sonuc.hatalar.push({
        satirNo: satir.satirNo,
        hata: e instanceof Error ? e.message : "Bilinmeyen hata",
      });
    }
  }

  sonuc.atlanan += satirlar.length - gecerliler.length;
  return sonuc;
}

async function satirYaz(
  db: TenantClient,
  kume: string,
  v: Record<string, string>,
  firmaBulYaOlustur: (ad: string) => Promise<string | null>
): Promise<void> {
  if (kume === "firmalar") {
    const mevcut = await db.firma.findFirst({
      where: { ad: { equals: v.ad, mode: "insensitive" } },
      select: { id: true },
    });
    // Aynı adlı firma varsa ikinci kez açılmaz — içe aktarım tekrarlansa
    // bile kopya oluşmaz.
    if (mevcut) throw new Error(`"${v.ad}" zaten kayıtlı`);

    const limit = await firmaLimitiAsildiMi();
    if (limit) throw new Error(limit);

    await tenantOlustur(db, "firma", {
      ad: v.ad,
      vergiNo: v.vergiNo || null,
      sektor: v.sektor || null,
      il: v.il || null,
      ilce: v.ilce || null,
      telefon: v.telefon || null,
      email: v.email || null,
      adres: v.adres || null,
      durum: v.durum?.toLocaleLowerCase("tr").startsWith("pas") ? "pasif" : "aktif",
      notlar: v.notlar || null,
    });
    return;
  }

  if (kume === "adaylar") {
    await tenantOlustur(db, "lead", {
      ad: v.ad,
      firmaAd: v.firmaAd || null,
      unvan: v.unvan || null,
      email: v.email || null,
      telefon: v.telefon || null,
      il: v.il || null,
      sektor: v.sektor || null,
      kaynak: v.kaynak || null,
      durum: "yeni",
      notlar: v.notlar || null,
    });
    return;
  }

  // Kalan kümelerin hepsi bir firmaya bağlıdır.
  const firmaId = await firmaBulYaOlustur(v.firmaAd);
  if (!firmaId) throw new Error("Firma açılamadı (paket limiti olabilir)");

  if (kume === "kisiler") {
    await tenantOlustur(db, "kisi", {
      firmaId,
      ad: v.ad,
      unvan: v.unvan || null,
      // Departman sabit listeden gelmelidir; dosyadaki serbest metin listede
      // yoksa alan BOŞ bırakılır (satırın tamamı düşmez). Amaç, içe aktarımın
      // raporlanabilir alanı serbest metne çevirmesini engellemektir.
      departman: (DEPARTMANLAR as readonly string[]).includes((v.departman ?? "").trim())
        ? v.departman!.trim()
        : null,
      telefon: v.telefon || null,
      email: v.email || null,
      birincil: /^(evet|true|1|x)$/i.test(v.birincil ?? ""),
      notlar: v.notlar || null,
    });
    return;
  }

  if (kume === "yatirimlar") {
    await tenantOlustur(db, "yatirimDestegi", {
      firmaId,
      baslik: v.baslik,
      tur: v.tur || null,
      tutar: sayiya(v.tutar),
      paraBirimi: v.paraBirimi || "TRY",
      tarih: tariheCevir(v.tarih) ?? new Date(),
      durum: v.durum || "basvuruldu",
      aciklama: v.aciklama || null,
    });
    return;
  }

  if (kume === "egitimler") {
    await tenantOlustur(db, "egitim", {
      firmaId,
      baslik: v.baslik,
      konu: v.konu || null,
      egitmen: v.egitmen || null,
      tarih: tariheCevir(v.tarih) ?? new Date(),
      sureSaat: sayiya(v.sureSaat),
      katilimci: Math.round(sayiya(v.katilimci)),
      durum: v.durum || "planlandi",
      notlar: v.notlar || null,
    });
    return;
  }

  if (kume === "hizmetler") {
    await tenantOlustur(db, "hizmet", {
      firmaId,
      baslik: v.baslik,
      tur: v.tur || null,
      tarih: tariheCevir(v.tarih) ?? new Date(),
      durum: v.durum || "devam",
      aciklama: v.aciklama || null,
    });
    return;
  }

  throw new Error(`"${kume}" içe aktarıma kapalı`);
}
