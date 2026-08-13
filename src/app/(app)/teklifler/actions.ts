"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  getTenantContext,
  firmaSahipligiDogrula,
  sahiplikDogrula,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { TEKLIF_DURUM } from "@/lib/constants";
import {
  satirFiyatiHesapla,
  paketGrubuHesapla,
  paketDamgasiGecerliMi,
} from "@/lib/fiyat-saf";
import { kampanyaIstemcisi, gecerliKampanyalar } from "@/lib/kampanya";
import { paketIstemcisi, paketKatalogu } from "@/lib/paket";
import { bildirimGonder } from "@/lib/bildirim";

/**
 * Teklif işlemleri — Faz 7 / C7.
 *
 * REVİZYON TASARIMI: bir teklif değiştirilmez, revize edilir. "Revize et"
 * mevcut kaydı `revizyon` durumuna alır ve kalemleriyle birlikte YENİ bir
 * satır kopyalar (`ustTeklifId` ile eskisine bağlı, `revizyonNo` bir artmış).
 * Gönderilmiş bir teklifin üzerine yazmak "hangi rakamı görüştük?" sorusunu
 * yanıtsız bırakırdı.
 *
 * TUTAR HESABI sunucuda yapılır ve saklanır. İstemciden gelen toplama
 * güvenilmez; ayrıca sonradan KDV oranı değişse bile eski teklifin rakamları
 * olduğu gibi kalmalıdır.
 */

const kalemSchema = z.object({
  aciklama: z.string().trim().min(1),
  miktar: z.coerce.number().min(0),
  birim: z.string().trim().default("adet"),
  birimFiyat: z.coerce.number().min(0),
  // Katalog bağı OPSİYONELDİR: danışmanlık, montaj gibi katalogda olmayan
  // satırlar serbest metin olarak yazılmaya devam eder.
  urunId: z.string().trim().nullable().default(null),
  // Paket damgası (v1.25.0): satır bir paketten açıldıysa hangi paketten
  // geldiği. Sunucuda doğrulanır; uydurma damga sessizce düşer.
  paketId: z.string().trim().nullable().default(null),
  // Kaç PAKET (v1.27.0) — paket bir bütündür, kampanya ona uygulanır.
  paketAdedi: z.coerce.number().nullable().default(null),
  kampanyaId: z.string().trim().nullable().default(null),
});

const schema = z.object({
  firmaId: z.string().min(1, "Firma zorunludur."),
  firsatId: z.string().trim().optional(),
  kisiId: z.string().trim().optional(),
  no: z.string().trim().min(1, "Teklif numarası zorunludur."),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  durum: z.enum(TEKLIF_DURUM).default("taslak"),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  indirimOrani: z.coerce.number().min(0).max(100).default(0),
  kdvOrani: z.coerce.number().min(0).max(100).default(20),
  gecerlilikTarihi: z.string().trim().optional(),
  notlar: z.string().trim().optional(),
  sartlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(id?: string, firmaId?: string | null) {
  revalidatePath("/teklifler");
  if (id) revalidatePath(`/teklifler/${id}`);
  if (firmaId) revalidatePath(`/firmalar/${firmaId}`);
}

/** Formdaki kalem satırlarını okur (kalem-0-aciklama, kalem-0-miktar, …). */
function kalemleriOku(formData: FormData) {
  const kalemler: z.infer<typeof kalemSchema>[] = [];
  for (let i = 0; formData.has(`kalem-${i}-aciklama`); i++) {
    const aciklama = String(formData.get(`kalem-${i}-aciklama`) ?? "").trim();
    if (!aciklama) continue; // boş satır: kullanıcı eklemiş ama doldurmamış
    const parsed = kalemSchema.safeParse({
      aciklama,
      miktar: formData.get(`kalem-${i}-miktar`) ?? 0,
      birim: String(formData.get(`kalem-${i}-birim`) ?? "adet"),
      birimFiyat: formData.get(`kalem-${i}-birimFiyat`) ?? 0,
      urunId: String(formData.get(`kalem-${i}-urunId`) ?? "").trim() || null,
      paketId: String(formData.get(`kalem-${i}-paketId`) ?? "").trim() || null,
      paketAdedi: Number(formData.get(`kalem-${i}-paketAdedi`) ?? 0) || null,
      kampanyaId: String(formData.get(`kalem-${i}-kampanyaId`) ?? "").trim() || null,
    });
    if (parsed.success) kalemler.push(parsed.data);
  }
  return kalemler;
}

/**
 * Tutarları hesaplar. Tek kaynak burasıdır; arayüz yalnızca gösterir.
 *
 * SIRA: kalem kampanyası → belge iskontosu → KDV.
 *
 * Kampanya önce gelir çünkü kampanya ürüne/firmaya tanımlı bir HAKTIR;
 * belgenin üzerine elle yazılan iskonto ise onun üstüne yapılan ayrı bir
 * jesttir. Aynı sıra sipariş tarafında da geçerlidir (`fiyat-saf.ts`), yani
 * kabul edilen teklif siparişe döndüğünde rakam değişmez.
 *
 * KDV indirimli tutar üzerinden hesaplanır (Faz 14 kuralı).
 */
async function tutarlariHesapla(
  db: TenantClient,
  firmaId: string,
  kalemler: z.infer<typeof kalemSchema>[],
  indirimOrani: number,
  kdvOrani: number
) {
  const satirlar: {
    kampanyaId: string | null;
    paketId: string | null;
    indirimTutari: number;
    tutar: number;
  }[] = [];

  let araToplam = 0;
  let kampanyaIndirimi = 0;

  /*
    Paket damgası da SUNUCUDA doğrulanır (v1.25.0) — kampanyadaki kuralın
    aynısı. İstemciden gelen bir `paketId`'ye güvenip belgeye basmak, başka
    bir firmaya özel bir anlaşmanın adını bu müşterinin teklifinde
    gösterebilmek demekti. Katalog döngünün DIŞINDA bir kez okunur.
  */
  const paketKatalog = kalemler.some((k) => k.paketId)
    ? await paketKatalogu(paketIstemcisi(db))
    : [];

  /** Satırın paket damgası geçerli mi? Değilse sıradan bir satır sayılır. */
  const damgaliMi = (k: (typeof kalemler)[number]) =>
    Boolean(
      k.paketId &&
        paketDamgasiGecerliMi(paketKatalog, k.paketId, {
          firmaId,
          urunId: k.urunId,
        })
    );

  /*
    ═══ PAKET BİR BÜTÜNDÜR (v1.27.0) ═══

    Siparişteki kuralın AYNISI: aynı `paketId`yi taşıyan satırlar tek
    gruptur, kampanya bir kez ve paketin TAMAMINA uygulanır, indirim
    satırlara pay edilir. Sıra teklifte de aynı kalır (kampanya → belge
    iskontosu → KDV), böylece kabul edilen teklif siparişe döndüğünde rakam
    değişmez.
  */
  const sonuclar = new Map<
    number,
    { kampanyaId: string | null; indirim: number }
  >();

  const paketGruplari = new Map<string, number[]>();
  kalemler.forEach((k, i) => {
    if (damgaliMi(k) && k.paketId) {
      paketGruplari.set(k.paketId, [...(paketGruplari.get(k.paketId) ?? []), i]);
    }
  });

  for (const [paketId, indeksler] of paketGruplari) {
    const ilk = kalemler[indeksler[0]];
    const paketAdedi = Math.max(
      1,
      ...indeksler.map((i) => Math.max(kalemler[i].paketAdedi ?? 0, 0))
    );

    let kampanya = null;
    if (ilk.kampanyaId) {
      const adaylar = await gecerliKampanyalar(kampanyaIstemcisi(db), {
        firmaId,
        urunId: ilk.urunId,
        paketId,
      });
      kampanya = adaylar.find((a) => a.kampanyaId === ilk.kampanyaId) ?? null;
    }

    const sonuc = paketGrubuHesapla(
      indeksler.map((i) => ({
        urunId: kalemler[i].urunId ?? "",
        birimMiktar:
          paketAdedi > 0 ? kalemler[i].miktar / paketAdedi : kalemler[i].miktar,
        birimFiyat: kalemler[i].birimFiyat,
        kdvOrani,
      })),
      paketAdedi,
      kampanya
    );

    indeksler.forEach((i, j) => {
      sonuclar.set(i, {
        kampanyaId: sonuc.kampanya?.kampanyaId ?? null,
        indirim: sonuc.satirlar[j].indirimTutari,
      });
    });
  }

  for (const [i, k] of kalemler.entries()) {
    const brut = k.miktar * k.birimFiyat;
    araToplam += brut;

    let indirim = 0;
    let uygulanan: string | null = null;

    const grup = sonuclar.get(i);
    if (grup) {
      indirim = grup.indirim;
      uygulanan = grup.kampanyaId;
    } else if (k.kampanyaId) {
      /*
        Kampanya GEÇERLİLİĞİ sunucuda doğrulanır: tarihi geçmiş, kotası
        dolmuş ya da başka bir firmaya/ürüne tanımlı bir kampanyanın id'si
        istemciden gelirse indirim uygulanmaz. İstemcideki süzgeç bir
        kolaylıktır.
      */
      const adaylar = await gecerliKampanyalar(kampanyaIstemcisi(db), {
        firmaId,
        urunId: k.urunId,
        paketId: null,
      });
      const sonuc = satirFiyatiHesapla(
        { urunId: k.urunId ?? "", listeFiyat: k.birimFiyat, kdvOrani },
        k.miktar,
        {
          kampanyalar: adaylar.filter((a) => a.kampanyaId === k.kampanyaId),
          secilenKampanyaId: k.kampanyaId,
        }
      );
      indirim = sonuc.indirimTutari;
      uygulanan = sonuc.kampanya?.kampanyaId ?? null;
    }

    kampanyaIndirimi += indirim;
    satirlar.push({
      kampanyaId: uygulanan,
      // Doğrulanmayan damga SESSİZCE düşer: satır geçerli kalır, yalnızca
      // "bu paketten geldi" iddiası kaydedilmez.
      paketId: damgaliMi(k) ? k.paketId : null,
      indirimTutari: indirim,
      tutar: brut - indirim,
    });
  }

  const yuvarla = (n: number) => Math.round(n * 100) / 100;

  // Belge iskontosu kampanyadan SONRA, kalan tutar üzerinden.
  const belgeIskontosu = ((araToplam - kampanyaIndirimi) * indirimOrani) / 100;
  const indirimTutari = yuvarla(kampanyaIndirimi + belgeIskontosu);
  const matrah = yuvarla(araToplam - indirimTutari);
  const kdvTutari = yuvarla((matrah * kdvOrani) / 100);

  return {
    satirlar,
    araToplam: yuvarla(araToplam),
    indirimTutari,
    kdvTutari,
    toplam: yuvarla(matrah + kdvTutari),
  };
}

async function bagliKayitlariDogrula(
  db: TenantClient,
  v: { firmaId: string; firsatId?: string; kisiId?: string }
) {
  await firmaSahipligiDogrula(db, v.firmaId);

  if (v.firsatId) {
    const firsat = await db.firsat.findFirst({
      where: { id: v.firsatId, firmaId: v.firmaId },
      select: { id: true },
    });
    if (!firsat) notFound();
  }
  if (v.kisiId) {
    const kisi = await db.kisi.findFirst({
      where: { id: v.kisiId, firmaId: v.firmaId },
      select: { id: true },
    });
    if (!kisi) notFound();
  }
}

/** Kalemleri yeniden yazar: eskiler silinir, yeniler eklenir. */
async function kalemleriYaz(
  db: TenantClient,
  teklifId: string,
  kalemler: z.infer<typeof kalemSchema>[],
  satirlar: {
    kampanyaId: string | null;
    paketId: string | null;
    indirimTutari: number;
    tutar: number;
  }[]
) {
  await db.teklifKalemi.deleteMany({ where: { teklifId } });
  for (const [i, k] of kalemler.entries()) {
    await tenantOlustur(db, "teklifKalemi", {
      teklifId,
      sira: i,
      urunId: k.urunId,
      paketId: satirlar[i]?.paketId ?? null,
      paketAdedi: k.paketAdedi,
      aciklama: k.aciklama,
      miktar: k.miktar,
      birim: k.birim,
      birimFiyat: k.birimFiyat,
      // Kampanya uygulanmadıysa satırda da işaretlenmez.
      kampanyaId: satirlar[i]?.kampanyaId ?? null,
      indirimTutari: satirlar[i]?.indirimTutari ?? 0,
      tutar: satirlar[i]?.tutar ?? k.miktar * k.birimFiyat,
    });
  }
}

export async function teklifOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.teklifOlustur))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const cakisma = await db.teklif.findFirst({ where: { no: parsed.data.no } });
  if (cakisma) return { error: "Bu teklif numarası zaten kullanılıyor." };

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) return { error: "En az bir kalem girin." };

  const tutarlar = await tutarlariHesapla(
    db,
    parsed.data.firmaId,
    kalemler,
    parsed.data.indirimOrani,
    parsed.data.kdvOrani
  );

  const teklif = await tenantOlustur(db, "teklif", {
    firmaId: parsed.data.firmaId,
    firsatId: parsed.data.firsatId || null,
    kisiId: parsed.data.kisiId || null,
    no: parsed.data.no,
    baslik: parsed.data.baslik,
    durum: parsed.data.durum,
    paraBirimi: parsed.data.paraBirimi,
    indirimOrani: parsed.data.indirimOrani,
    kdvOrani: parsed.data.kdvOrani,
    ...tutarlar,
    gecerlilikTarihi: parsed.data.gecerlilikTarihi
      ? new Date(parsed.data.gecerlilikTarihi)
      : null,
    gonderimTarihi: parsed.data.durum === "gonderildi" ? new Date() : null,
    notlar: parsed.data.notlar || null,
    sartlar: parsed.data.sartlar || null,
    olusturanEmail: session.email,
  });

  await kalemleriYaz(db, teklif.id, kalemler, tutarlar.satirlar);

  await denetimYaz({
    islem: "olustur",
    varlik: "Teklif",
    varlikId: teklif.id,
    ozet: `${parsed.data.no} — ${parsed.data.baslik}`,
    yeni: { ...parsed.data, ...tutarlar, kalemSayisi: kalemler.length },
  });

  revalidate(teklif.id, parsed.data.firmaId);
  redirect(`/teklifler/${teklif.id}`);
}

export async function teklifGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.teklifDuzenle))) return { error: YETKISIZ };

  const { db } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const oncesi = await kayitOku(db, "teklif", id);
  if (!oncesi) notFound();

  // Revize edilmiş bir sürüm dondurulmuştur: değişiklik yeni revizyona gider.
  if (oncesi.durum === "revizyon") {
    return {
      error: "Bu sürüm revize edilmiş; değişiklikleri en son revizyon üzerinde yapın.",
    };
  }

  const cakisma = await db.teklif.findFirst({
    where: { no: parsed.data.no, NOT: { id } },
  });
  if (cakisma) return { error: "Bu teklif numarası başka bir teklifte kullanılıyor." };

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) return { error: "En az bir kalem girin." };

  const tutarlar = await tutarlariHesapla(
    db,
    parsed.data.firmaId,
    kalemler,
    parsed.data.indirimOrani,
    parsed.data.kdvOrani
  );

  await tenantGuncelle(db, "teklif", id, {
    firmaId: parsed.data.firmaId,
    firsatId: parsed.data.firsatId || null,
    kisiId: parsed.data.kisiId || null,
    no: parsed.data.no,
    baslik: parsed.data.baslik,
    durum: parsed.data.durum,
    paraBirimi: parsed.data.paraBirimi,
    indirimOrani: parsed.data.indirimOrani,
    kdvOrani: parsed.data.kdvOrani,
    ...tutarlar,
    gecerlilikTarihi: parsed.data.gecerlilikTarihi
      ? new Date(parsed.data.gecerlilikTarihi)
      : null,
    // Gönderim tarihi ilk gönderimde yazılır, sonraki kayıtlarda korunur.
    gonderimTarihi:
      parsed.data.durum === "gonderildi" && !oncesi.gonderimTarihi
        ? new Date()
        : (oncesi.gonderimTarihi as Date | null),
    notlar: parsed.data.notlar || null,
    sartlar: parsed.data.sartlar || null,
  });

  await kalemleriYaz(db, id, kalemler, tutarlar.satirlar);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Teklif",
    varlikId: id,
    ozet: `${parsed.data.no} — ${parsed.data.baslik}`,
    eski: oncesi,
    yeni: { ...parsed.data, ...tutarlar },
  });

  revalidate(id, parsed.data.firmaId);
  return { ok: true };
}

/** Yalnızca durum değiştirir (gönderildi / kabul / red). */
export async function teklifDurumDegistir(id: string, durum: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.teklifDuzenle))) throw new Error(YETKISIZ);
  if (!TEKLIF_DURUM.includes(durum as never)) throw new Error("Geçersiz durum.");

  const { db, session } = await getTenantContext();
  const oncesi = await kayitOku(db, "teklif", id);
  if (!oncesi) notFound();

  await tenantGuncelle(db, "teklif", id, {
    durum,
    gonderimTarihi:
      durum === "gonderildi" && !oncesi.gonderimTarihi
        ? new Date()
        : (oncesi.gonderimTarihi as Date | null),
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Teklif",
    varlikId: id,
    ozet: `${oncesi.no as string} → ${durum}`,
    eski: { durum: oncesi.durum },
    yeni: { durum },
  });

  // Teklifi hazırlayan kişi sonucu öğrenmeli (Faz 8 / D1).
  const olusturan = oncesi.olusturanEmail as string | null;
  if (olusturan && olusturan !== session.email) {
    const kullanici = await db.user.findFirst({
      where: { email: olusturan },
      select: { id: true },
    });
    if (kullanici) {
      await bildirimGonder(db, {
        kullaniciId: kullanici.id,
        tur: "teklif.durum",
        baslik: `${oncesi.no as string} teklifinin durumu değişti`,
        mesaj: `Yeni durum: ${durum}`,
        link: `/teklifler/${id}`,
      });
    }
  }

  revalidate(id, oncesi.firmaId as string);
}

/**
 * Revizyon oluşturur (C7).
 *
 * Mevcut sürüm `revizyon` durumuna alınır ve DEĞİŞTİRİLMEDEN kalır; kalemleri
 * kopyalanarak yeni bir taslak açılır. Böylece teklif geçmişi bir zincir
 * hâlinde okunabilir.
 */
export async function teklifRevizeEt(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.teklifOlustur))) throw new Error(YETKISIZ);

  const { db, session } = await getTenantContext();
  await sahiplikDogrula(db, "teklif", id);

  const kaynak = await db.teklif.findFirst({
    where: { id },
    include: { kalemler: { orderBy: { sira: "asc" } } },
  });
  if (!kaynak) notFound();

  const yeniRevizyon = kaynak.revizyonNo + 1;

  const yeni = await tenantOlustur(db, "teklif", {
    firmaId: kaynak.firmaId,
    firsatId: kaynak.firsatId,
    kisiId: kaynak.kisiId,
    no: `${kaynak.no}-R${yeniRevizyon}`,
    baslik: kaynak.baslik,
    durum: "taslak",
    paraBirimi: kaynak.paraBirimi,
    indirimOrani: kaynak.indirimOrani,
    kdvOrani: kaynak.kdvOrani,
    araToplam: kaynak.araToplam,
    indirimTutari: kaynak.indirimTutari,
    kdvTutari: kaynak.kdvTutari,
    toplam: kaynak.toplam,
    gecerlilikTarihi: kaynak.gecerlilikTarihi,
    notlar: kaynak.notlar,
    sartlar: kaynak.sartlar,
    revizyonNo: yeniRevizyon,
    ustTeklifId: kaynak.id,
    olusturanEmail: session.email,
  });

  for (const k of kaynak.kalemler) {
    await tenantOlustur(db, "teklifKalemi", {
      teklifId: yeni.id,
      sira: k.sira,
      // Katalog bağları REVİZYONA DA TAŞINIR: taşınmasaydı revize edilen
      // teklif ürününü, paketini ve kampanyasını kaybeder, siparişe
      // dönerken de zincir kopardı (v1.23.0/v1.25.0 gerekçesi).
      urunId: k.urunId,
      paketId: k.paketId,
      paketAdedi: k.paketAdedi,
      kampanyaId: k.kampanyaId,
      indirimTutari: k.indirimTutari,
      aciklama: k.aciklama,
      miktar: k.miktar,
      birim: k.birim,
      birimFiyat: k.birimFiyat,
      tutar: k.tutar,
    });
  }

  // Eski sürüm dondurulur — üzerine yazılamaz.
  await tenantGuncelle(db, "teklif", id, { durum: "revizyon" });

  await denetimYaz({
    islem: "olustur",
    varlik: "Teklif",
    varlikId: yeni.id,
    ozet: `${kaynak.no} → revizyon ${yeniRevizyon}`,
    yeni: { no: `${kaynak.no}-R${yeniRevizyon}`, ustTeklif: kaynak.no },
  });

  revalidate(id, kaynak.firmaId);
  redirect(`/teklifler/${yeni.id}`);
}

export async function teklifSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.teklifSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "teklif", id);
  await tenantSil(db, "teklif", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Teklif",
    varlikId: id,
    ozet: (oncesi?.no as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(undefined, oncesi?.firmaId as string);
  redirect("/teklifler");
}
