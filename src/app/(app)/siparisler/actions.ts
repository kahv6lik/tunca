"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  sahiplikDogrula,
  firmaSahipligiDogrula,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { bildirimGonder } from "@/lib/bildirim";
import { SIPARIS_DURUM } from "@/lib/constants";
import {
  siparisIstemcisi,
  siparisiOnayla,
  siparisiIptalEt,
  siradakiBelgeNo,
} from "@/lib/siparis";
import {
  satirFiyatiHesapla,
  paketGrubuHesapla,
  paketDamgasiGecerliMi,
  type FiyatKampanyasi,
} from "@/lib/fiyat-saf";
import { kampanyaIstemcisi, gecerliKampanyalar } from "@/lib/kampanya";
import { paketIstemcisi, paketKatalogu } from "@/lib/paket";

/**
 * Sipariş işlemleri — Faz 15 / S1, S2, S3.
 *
 * ONAY, OLUŞTURMADAN AYRI BİR İZİNDİR (`siparis.onayla`): siparişi giren
 * satış personeli kendi siparişini onaylayamaz. Bu, ortağın "yönetici onayı"
 * isteğinin özüdür — onay yalnızca bir durum alanı değil, bir yetki
 * ayrımıdır.
 *
 * Tutarlar SUNUCUDA hesaplanır (`fiyat-saf.ts`); formdan gelen toplam
 * yalnızca önizlemedir ve hiçbir zaman kaydedilmez.
 */

const schema = z.object({
  firmaId: z.string().min(1, "Firma zorunludur."),
  kisiId: z.string().trim().optional(),
  teklifId: z.string().trim().optional(),
  // Faz 16 — proje bağı OPSİYONELDİR (karar: v1.16.0).
  projeId: z.string().trim().optional(),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  notlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(id?: string) {
  revalidatePath("/siparisler");
  revalidatePath("/sevkiyat");
  revalidatePath("/stok");
  if (id) revalidatePath(`/siparisler/${id}`);
}

type Kalem = {
  urunId: string | null;
  /** Satır bir paketten açıldıysa hangi paketten geldiği (v1.25.0). */
  paketId: string | null;
  /** Kaç PAKET (v1.27.0) — kota paket sayar, ürün adedi değil. */
  paketAdedi: number | null;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  iskontoOrani: number;
  kdvOrani: number;
  kampanyaId: string | null;
};

/** Form kalemlerini okur: `kalem-<i>-<alan>`. */
function kalemleriOku(formData: FormData): Kalem[] {
  const kalemler: Kalem[] = [];

  for (const [anahtar] of formData.entries()) {
    const eslesme = /^kalem-(\d+)-aciklama$/.exec(anahtar);
    if (!eslesme) continue;
    const i = eslesme[1];

    const aciklama = String(formData.get(`kalem-${i}-aciklama`) ?? "").trim();
    const miktar = Number(formData.get(`kalem-${i}-miktar`) ?? 0) || 0;
    if (!aciklama || miktar <= 0) continue;

    kalemler.push({
      urunId: String(formData.get(`kalem-${i}-urunId`) ?? "").trim() || null,
      paketId: String(formData.get(`kalem-${i}-paketId`) ?? "").trim() || null,
      paketAdedi: Number(formData.get(`kalem-${i}-paketAdedi`) ?? 0) || null,
      aciklama,
      miktar,
      birim: String(formData.get(`kalem-${i}-birim`) ?? "adet"),
      birimFiyat: Number(formData.get(`kalem-${i}-birimFiyat`) ?? 0) || 0,
      iskontoOrani: Number(formData.get(`kalem-${i}-iskonto`) ?? 0) || 0,
      kdvOrani: Number(formData.get(`kalem-${i}-kdv`) ?? 20) || 0,
      kampanyaId: String(formData.get(`kalem-${i}-kampanyaId`) ?? "").trim() || null,
    });
  }

  return kalemler;
}

/**
 * Kalem tutarlarını ve sipariş toplamlarını SUNUCUDA hesaplar.
 *
 * Kampanya indirimi de burada hesaplanır ama kota BU AŞAMADA DÜŞMEZ —
 * kota yalnızca onayda düşer (`siparisiOnayla`). Sipariş girildiği anda
 * kota düşseydi, reddedilen her sipariş kotayı boşuna tüketirdi.
 */
async function tutarlariHesapla(
  db: TenantClient,
  kalemler: Kalem[],
  // Kampanya kapsamı firmaya bağlıdır; doğrulama için gerekir.
  firmaId: string
): Promise<{
  satirlar: (Kalem & { tutar: number; indirimTutari: number; kdvTutari: number })[];
  araToplam: number;
  indirimTutari: number;
  kdvTutari: number;
  toplam: number;
}> {
  const satirlar: (Kalem & {
    tutar: number;
    indirimTutari: number;
    kdvTutari: number;
  })[] = [];
  let araToplam = 0;
  let indirimToplam = 0;
  let kdvToplam = 0;

  /*
    Paket damgası SUNUCUDA doğrulanır (v1.25.0) — kampanyadaki kuralın
    aynısı. İstemciden gelen bir `paketId`'ye güvenip satıra basmak,
    "bu fiyat şu anlaşmadan geliyor" iddiasını herkesin uydurabilmesi
    demekti; başka bir firmaya özel paketin adı bu firmanın belgesinde
    görünürdü. Katalog döngünün DIŞINDA bir kez okunur.
  */
  const paketKatalog = kalemler.some((k) => k.paketId)
    ? await paketKatalogu(paketIstemcisi(db))
    : [];

  /** Satırın paket damgası geçerli mi? Değilse sıradan bir satır sayılır. */
  const damgaliMi = (k: Kalem) =>
    Boolean(
      k.paketId &&
        paketDamgasiGecerliMi(paketKatalog, k.paketId, {
          firmaId,
          urunId: k.urunId,
        })
    );

  /** Seçilen kampanyayı TAM kapsamla doğrular; geçersizse null döner. */
  async function kampanyaDogrula(
    kampanyaId: string | null,
    urunId: string | null,
    paketId: string | null
  ): Promise<FiyatKampanyasi | null> {
    if (!kampanyaId) return null;
    /*
      Yalnızca "durum = aktif" bakmak yetmez. Tarihi geçmiş, kotası dolmuş,
      başka bir firmaya/ürüne/pakete tanımlı bir kampanyanın id'si
      istemciden gelirse indirim UYGULANMAMALIDIR — aksi hâlde indirim
      yetkisi fiilen herkese açılır (Faz 14 kuralı).
    */
    const adaylar = await gecerliKampanyalar(kampanyaIstemcisi(db), {
      firmaId,
      urunId,
      paketId,
    });
    return adaylar.find((a) => a.kampanyaId === kampanyaId) ?? null;
  }

  /*
    ═══ PAKET BİR BÜTÜNDÜR (v1.27.0) ═══

    Ortağın bulgusu: "kampanyada paket fiyatı 1000 TL atandı ama ürün
    bazında hesaplandığı için 2000 TL oluyor." Aynı `paketId`yi taşıyan
    satırlar TEK GRUPTUR: kampanya bir kez ve paketin TAMAMINA uygulanır,
    indirim satırlara brüt paylarıyla dağıtılır.

    Satırlar yine ayrı ayrı kaydedilir — stok düşümü, kısmi sevkiyat ve ürün
    raporu satırın ürününe bakar (v1.25.0 kararı).
  */
  const paketGruplari = new Map<string, Kalem[]>();
  const tekil: Kalem[] = [];
  for (const k of kalemler) {
    if (damgaliMi(k) && k.paketId) {
      const grup = paketGruplari.get(k.paketId) ?? [];
      grup.push(k);
      paketGruplari.set(k.paketId, grup);
    } else {
      // Damgası düşen satır sıradanlaşır; iddia kaydedilmez.
      tekil.push({ ...k, paketId: null, paketAdedi: null });
    }
  }

  for (const [paketId, grup] of paketGruplari) {
    /*
      Paket adedi grubun TAMAMI için tektir; istemciden farklı gelen
      değerler olursa en büyüğü alınır (satırlar birlikte güncellenir,
      ayrışması bir hatadır). En az 1 paket satılır.
    */
    const paketAdedi = Math.max(
      1,
      ...grup.map((k) => Math.max(k.paketAdedi ?? 0, 0))
    );

    const kampanya = await kampanyaDogrula(
      grup[0].kampanyaId,
      grup[0].urunId,
      paketId
    );

    const sonuc = paketGrubuHesapla(
      grup.map((k) => ({
        urunId: k.urunId ?? "",
        // Bir pakette kaç adet: satırın miktarı ÷ paket adedi.
        birimMiktar: paketAdedi > 0 ? k.miktar / paketAdedi : k.miktar,
        birimFiyat: k.birimFiyat,
        kdvOrani: k.kdvOrani,
      })),
      paketAdedi,
      kampanya
    );

    grup.forEach((k, j) => {
      const c = sonuc.satirlar[j];
      satirlar.push({
        ...k,
        paketId,
        paketAdedi,
        miktar: c.miktar,
        // Kampanya uygulanmadıysa satırda da işaretlenmez.
        kampanyaId: sonuc.kampanya?.kampanyaId ?? null,
        tutar: c.tutar,
        indirimTutari: c.indirimTutari,
        kdvTutari: c.kdvTutari,
      });
      araToplam += k.birimFiyat * c.miktar;
      indirimToplam += c.indirimTutari;
      kdvToplam += c.kdvTutari;
    });
  }

  for (const k of tekil) {
    const kampanya = await kampanyaDogrula(k.kampanyaId, k.urunId, null);

    const sonuc = satirFiyatiHesapla(
      { urunId: k.urunId ?? "", listeFiyat: k.birimFiyat, kdvOrani: k.kdvOrani },
      k.miktar,
      {
        kampanyalar: kampanya ? [kampanya] : [],
        secilenKampanyaId: k.kampanyaId,
        elIskontoOrani: k.iskontoOrani,
      }
    );

    satirlar.push({
      ...k,
      kampanyaId: sonuc.kampanya?.kampanyaId ?? null,
      tutar: sonuc.netTutar,
      indirimTutari: sonuc.indirimTutari,
      kdvTutari: sonuc.kdvTutari,
    });

    araToplam += k.birimFiyat * k.miktar;
    indirimToplam += sonuc.indirimTutari;
    kdvToplam += sonuc.kdvTutari;
  }

  const yuvarla = (n: number) => Math.round(n * 100) / 100;
  const net = yuvarla(araToplam - indirimToplam);

  return {
    satirlar,
    araToplam: yuvarla(araToplam),
    indirimTutari: yuvarla(indirimToplam),
    kdvTutari: yuvarla(kdvToplam),
    toplam: yuvarla(net + kdvToplam),
  };
}

async function kalemleriYaz(
  db: TenantClient,
  siparisId: string,
  satirlar: Awaited<ReturnType<typeof tutarlariHesapla>>["satirlar"]
) {
  await db.siparisKalemi.deleteMany({ where: { siparisId } });

  for (const [i, s] of satirlar.entries()) {
    await tenantOlustur(db, "siparisKalemi", {
      siparisId,
      sira: i,
      urunId: s.urunId,
      paketId: s.paketId,
      paketAdedi: s.paketAdedi,
      aciklama: s.aciklama,
      miktar: s.miktar,
      birim: s.birim,
      birimFiyat: s.birimFiyat,
      iskontoOrani: s.iskontoOrani,
      kdvOrani: s.kdvOrani,
      kampanyaId: s.kampanyaId,
      indirimTutari: s.indirimTutari,
      tutar: s.tutar,
    });
  }
}

/** Onay yetkisi olan kullanıcılara bildirim gönderir (S6). */
async function onayculariBilgilendir(
  db: TenantClient,
  siparisNo: string,
  firmaAd: string,
  siparisId: string
) {
  // Onay yetkisi rolden gelir; kuruluş yöneticileri onaycıdır.
  const yoneticiler = await db.user.findMany({
    where: { durum: "aktif", role: { in: ["tenant_admin", "admin"] } },
    select: { id: true },
  });

  for (const y of yoneticiler) {
    await bildirimGonder(db, {
      kullaniciId: y.id,
      tur: "siparis.onaybekliyor",
      baslik: `Onay bekleyen sipariş: ${siparisNo}`,
      mesaj: firmaAd,
      link: `/siparisler/${siparisId}`,
    });
  }
}

export async function siparisOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.siparisOlustur))) return { error: YETKISIZ };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) return { error: "Siparişe en az bir kalem ekleyin." };

  const { db, tenantId, session } = await getTenantContext();
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  if (parsed.data.kisiId) await sahiplikDogrula(db, "kisi", parsed.data.kisiId);
  if (parsed.data.teklifId) await sahiplikDogrula(db, "teklif", parsed.data.teklifId);
  if (parsed.data.projeId) await sahiplikDogrula(db, "proje", parsed.data.projeId);

  const hesap = await tutarlariHesapla(db, kalemler, parsed.data.firmaId);
  const no = await siradakiBelgeNo(siparisIstemcisi(db), tenantId, "siparis");

  /**
   * Durum "onay bekliyor" olarak açılır — taslak DEĞİL. Ortağın kuralı
   * budur: satış personelinin girdiği her sipariş yöneticinin önüne düşer.
   */
  const siparis = await tenantOlustur(db, "siparis", {
    no,
    firmaId: parsed.data.firmaId,
    kisiId: parsed.data.kisiId || null,
    teklifId: parsed.data.teklifId || null,
    projeId: parsed.data.projeId || null,
    durum: "onaybekliyor",
    paraBirimi: parsed.data.paraBirimi,
    notlar: parsed.data.notlar || null,
    olusturanId: session.userId,
    araToplam: hesap.araToplam,
    indirimTutari: hesap.indirimTutari,
    kdvTutari: hesap.kdvTutari,
    toplam: hesap.toplam,
  });

  await kalemleriYaz(db, siparis.id, hesap.satirlar);

  const firma = await db.firma.findFirst({
    where: { id: parsed.data.firmaId },
    select: { ad: true },
  });
  await onayculariBilgilendir(db, no, firma?.ad ?? "", siparis.id);

  await denetimYaz({
    islem: "olustur",
    varlik: "Siparis",
    varlikId: siparis.id,
    ozet: `${no} — ${firma?.ad ?? ""} (${hesap.toplam})`,
    yeni: { ...parsed.data, no, ...hesap, satirlar: undefined },
  });

  revalidate();
  redirect(`/siparisler/${siparis.id}`);
}

export async function siparisGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.siparisDuzenle))) return { error: YETKISIZ };

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "siparis", id)) as { durum: string; no: string } | null;
  if (!oncesi) return { error: "Sipariş bulunamadı." };

  /**
   * ONAYLANMIŞ SİPARİŞ DÜZENLENEMEZ. Onaylanan rakam, yöneticinin gördüğü
   * ve stok/kota düşümünün dayandığı rakamdır; sonradan değişebilseydi onay
   * hiçbir şey ifade etmezdi. Değişiklik gerekiyorsa sipariş iptal edilip
   * yenisi açılır (teklif revizyonundaki gerekçe).
   */
  if (oncesi.durum === "onaylandi") {
    return {
      error: "Onaylanmış sipariş düzenlenemez. İptal edip yeni sipariş oluşturun.",
    };
  }
  if (oncesi.durum === "iptal") return { error: "İptal edilmiş sipariş düzenlenemez." };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) return { error: "Siparişe en az bir kalem ekleyin." };

  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  const hesap = await tutarlariHesapla(db, kalemler, parsed.data.firmaId);

  await tenantGuncelle(db, "siparis", id, {
    firmaId: parsed.data.firmaId,
    kisiId: parsed.data.kisiId || null,
    projeId: parsed.data.projeId || null,
    paraBirimi: parsed.data.paraBirimi,
    notlar: parsed.data.notlar || null,
    araToplam: hesap.araToplam,
    indirimTutari: hesap.indirimTutari,
    kdvTutari: hesap.kdvTutari,
    toplam: hesap.toplam,
    // Reddedilmiş sipariş düzenlenince yeniden onaya düşer.
    durum: "onaybekliyor",
    redSebebi: null,
  });
  await kalemleriYaz(db, id, hesap.satirlar);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Siparis",
    varlikId: id,
    ozet: `${oncesi.no} güncellendi (${hesap.toplam})`,
    eski: oncesi,
    yeni: { ...parsed.data, ...hesap, satirlar: undefined },
  });

  revalidate(id);
  return { ok: true };
}

/** Yönetici onayı (S3). */
export async function siparisOnayla(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.siparisOnayla))) throw new Error(YETKISIZ);

  const { db, tenantId, session } = await getTenantContext();
  await sahiplikDogrula(db, "siparis", id);

  const sonuc = await siparisiOnayla(siparisIstemcisi(db), tenantId, id, session.userId);
  if (!sonuc.ok) throw new Error(sonuc.hata);

  const siparis = (await kayitOku(db, "siparis", id)) as {
    no: string;
    olusturanId: string | null;
  } | null;

  // Satış personeline karar bildirimi.
  if (siparis?.olusturanId && siparis.olusturanId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: siparis.olusturanId,
      tur: "siparis.karar",
      baslik: `Siparişiniz onaylandı: ${siparis.no}`,
      link: `/siparisler/${id}`,
    });
  }

  /**
   * DEPO BİLDİRİMİ — yalnızca BURADA gönderilir, yani yalnızca onaydan
   * sonra. Akışın sözü budur: onaysız siparişten sevkiyat ekibine haber
   * gitmez. Bildirimi sipariş oluşturmaya taşımak, kuralı sessizce
   * bozardı.
   */
  const depocular = await db.user.findMany({
    where: { durum: "aktif" },
    select: { id: true },
  });
  for (const d of depocular) {
    if (d.id === session.userId) continue;
    await bildirimGonder(db, {
      kullaniciId: d.id,
      tur: "siparis.sevkiyat",
      baslik: `Sevkiyata hazır sipariş: ${siparis?.no ?? ""}`,
      link: `/sevkiyat`,
    });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Siparis",
    varlikId: id,
    ozet: `${siparis?.no ?? ""} onaylandı (${sonuc.dusulenSatir} kalem stoktan düştü)`,
    eski: { durum: "onaybekliyor" },
    yeni: { durum: "onaylandi" },
  });

  revalidate(id);
}

/** Yönetici reddi — gerekçe zorunludur (S3). */
export async function siparisReddet(id: string, formData: FormData): Promise<void> {
  if (!(await yetkiVarMi(IZIN.siparisOnayla))) throw new Error(YETKISIZ);

  const sebep = String(formData.get("redSebebi") ?? "").trim();
  if (!sebep) throw new Error("Ret gerekçesi zorunludur.");

  const { db, session } = await getTenantContext();
  const siparis = (await kayitOku(db, "siparis", id)) as {
    no: string;
    durum: string;
    olusturanId: string | null;
  } | null;
  if (!siparis) throw new Error("Sipariş bulunamadı.");
  if (siparis.durum === "onaylandi") {
    throw new Error("Onaylanmış sipariş reddedilemez; iptal edin.");
  }

  await tenantGuncelle(db, "siparis", id, {
    durum: "reddedildi",
    redSebebi: sebep,
    onaylayanId: session.userId,
    onayTarihi: new Date(),
  });

  if (siparis.olusturanId) {
    await bildirimGonder(db, {
      kullaniciId: siparis.olusturanId,
      tur: "siparis.karar",
      baslik: `Siparişiniz reddedildi: ${siparis.no}`,
      mesaj: sebep,
      link: `/siparisler/${id}`,
    });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Siparis",
    varlikId: id,
    ozet: `${siparis.no} reddedildi — ${sebep}`,
    eski: { durum: siparis.durum },
    yeni: { durum: "reddedildi", redSebebi: sebep },
  });

  revalidate(id);
}

/** İptal — onaylanmışsa stok ve kota iade edilir. */
export async function siparisIptal(id: string): Promise<void> {
  // İptal, onay kadar ağır bir işlemdir (stok iadesi doğurur): aynı izne
  // bağlıdır.
  if (!(await yetkiVarMi(IZIN.siparisOnayla))) throw new Error(YETKISIZ);

  const { db, tenantId, session } = await getTenantContext();
  await sahiplikDogrula(db, "siparis", id);

  const sonuc = await siparisiIptalEt(siparisIstemcisi(db), tenantId, id, session.userId);
  if (!sonuc.ok) throw new Error(sonuc.hata ?? "Sipariş iptal edilemedi.");

  const siparis = (await kayitOku(db, "siparis", id)) as { no: string } | null;

  await denetimYaz({
    islem: "guncelle",
    varlik: "Siparis",
    varlikId: id,
    ozet: `${siparis?.no ?? ""} iptal edildi`,
    yeni: { durum: "iptal" },
  });

  revalidate(id);
}

export async function siparisSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.siparisSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "siparis", id)) as { durum: string; no: string } | null;

  /**
   * Onaylanmış sipariş SİLİNMEZ. Stok ve kota hareketleri ona referans
   * verir; silmek defterdeki "neden düştü" izini koparırdı. Doğru yol
   * iptal etmektir (stok iade edilir, kayıt durur).
   */
  if (oncesi?.durum === "onaylandi") {
    throw new Error("Onaylanmış sipariş silinemez. İptal edin.");
  }

  await tenantSil(db, "siparis", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Siparis",
    varlikId: id,
    ozet: oncesi?.no ?? undefined,
    eski: oncesi,
  });

  revalidate();
  redirect("/siparisler");
}
