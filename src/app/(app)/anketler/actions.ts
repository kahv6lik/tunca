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
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { ANKET_DURUM, SORU_TIPLERI, soruTipi } from "@/lib/anket-tanimlar";
import { anketTokenUret } from "@/lib/anket-db";

/**
 * Anket işlemleri — Faz 19 / N1, N2.
 *
 * TANIMLAMAK (`anket.yonet`) ile GÖNDERMEK (`anket.gonder`) ayrı izinlerdir:
 * anket kuruluşun müşteriye sorduğu sorudur ve yanlış zamanda gönderilen bir
 * e-posta geri alınamaz.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

const TIPLER = SORU_TIPLERI.map((t) => t.deger) as [string, ...string[]];

const anketSchema = z.object({
  baslik: z.string().trim().min(1, "Anket başlığı zorunludur.").max(200),
  aciklama: z.string().trim().optional(),
  durum: z.enum(ANKET_DURUM).default("taslak"),
  anonim: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  bitisTarihi: z.string().trim().optional(),
});

const soruSchema = z.object({
  metin: z.string().trim().min(1, "Soru metni zorunludur.").max(500),
  tip: z.enum(TIPLER),
  secenekler: z.string().trim().optional(),
  zorunlu: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
});

function revalidate(id?: string) {
  revalidatePath("/anketler");
  if (id) revalidatePath(`/anketler/${id}`);
}

export async function anketOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.anketYonet))) return { error: YETKISIZ };

  const parsed = anketSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db, session } = await getTenantContext();
  const veri = {
    baslik: parsed.data.baslik,
    aciklama: parsed.data.aciklama || null,
    durum: parsed.data.durum,
    anonim: parsed.data.anonim,
    bitisTarihi: parsed.data.bitisTarihi ? new Date(parsed.data.bitisTarihi) : null,
    olusturanId: session.userId,
  };

  const anket = await tenantOlustur(db, "anket", veri);

  await denetimYaz({
    islem: "olustur",
    varlik: "Anket",
    varlikId: anket.id,
    ozet: veri.baslik,
    yeni: veri,
  });

  revalidate();
  redirect(`/anketler/${anket.id}`);
}

export async function anketGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.anketYonet))) return { error: YETKISIZ };

  const parsed = anketSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "anket", id)) as
    | { baslik: string; anonim: boolean; durum: string }
    | null;
  if (!oncesi) return { error: "Anket bulunamadı." };

  /**
   * ANONİMLİK YAYINDAN SONRA DEĞİŞTİRİLEMEZ.
   *
   * Anonim toplanmış yanıtların kimlik bağı zaten YAZILMADI; bayrağı sonradan
   * kapatmak eski yanıtları kimliklendiremez, yalnızca raporu tutarsız yapar.
   * Tersi daha kötüdür: kimlikli toplanmış yanıtları "anonim" ilan etmek,
   * katılımcıya verilmemiş bir sözü verilmiş gibi göstermek olurdu.
   */
  if (oncesi.durum !== "taslak" && parsed.data.anonim !== oncesi.anonim) {
    return {
      error:
        "Anket yayınlandıktan sonra anonimlik değiştirilemez — toplanmış yanıtlar bu karara göre yazıldı.",
    };
  }

  const veri = {
    baslik: parsed.data.baslik,
    aciklama: parsed.data.aciklama || null,
    durum: parsed.data.durum,
    anonim: parsed.data.anonim,
    bitisTarihi: parsed.data.bitisTarihi ? new Date(parsed.data.bitisTarihi) : null,
  };

  await tenantGuncelle(db, "anket", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Anket",
    varlikId: id,
    ozet: veri.baslik,
    eski: oncesi,
    yeni: veri,
  });

  revalidate(id);
  return { ok: true };
}

export async function anketSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.anketYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "anket", id);
  // Sorular, gönderimler ve yanıtlar cascade ile gider.
  await tenantSil(db, "anket", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Anket",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate();
  redirect("/anketler");
}

/**
 * Soru ekler.
 *
 * YANITLANMIŞ ANKETE SORU EKLENMEZ: mevcut yanıtlayanlar o soruyu hiç
 * görmedi; sonradan eklenen soru raporda "yanıtsız" yığını üretir ve
 * yanıtlama oranını anlamsızlaştırır.
 */
export async function soruEkle(
  anketId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.anketYonet))) return { error: YETKISIZ };

  const parsed = soruSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db } = await getTenantContext();
  await sahiplikDogrula(db, "anket", anketId);

  const yanitVar = await db.anketYanit.count({ where: { anketId } });
  if (yanitVar > 0) {
    return { error: "Yanıt toplanmış ankete yeni soru eklenemez." };
  }

  const tip = soruTipi(parsed.data.tip)!;
  const secenekler = tip.secenekli
    ? (parsed.data.secenekler ?? "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  if (tip.secenekli && secenekler.length < 2) {
    return { error: "Çoktan seçmeli soru için en az iki seçenek girin." };
  }

  const sonSira = await db.anketSorusu.aggregate({
    where: { anketId },
    _max: { sira: true },
  });

  const soru = await tenantOlustur(db, "anketSorusu", {
    anketId,
    sira: (sonSira._max.sira ?? -1) + 1,
    tip: parsed.data.tip,
    metin: parsed.data.metin,
    secenekler,
    zorunlu: parsed.data.zorunlu,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Anket",
    varlikId: anketId,
    ozet: `Soru eklendi: ${parsed.data.metin}`,
    yeni: { soruId: soru.id, tip: parsed.data.tip },
  });

  revalidate(anketId);
  return { ok: true };
}

export async function soruSil(anketId: string, soruId: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.anketYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  await sahiplikDogrula(db, "anketSorusu", soruId);

  const yanitVar = await db.anketYanit.count({ where: { soruId } });
  if (yanitVar > 0) {
    throw new Error("Yanıtlanmış soru silinemez — toplanan yanıtlar kaybolurdu.");
  }

  await tenantSil(db, "anketSorusu", soruId);

  await denetimYaz({
    islem: "sil",
    varlik: "Anket",
    varlikId: anketId,
    ozet: "Soru silindi",
    eski: { soruId },
  });

  revalidate(anketId);
}

/**
 * Anketi seçilen kontaklara gönderir (N2).
 *
 * Her alıcıya AYRI bir token üretilir; token saklanmaz, yalnızca sha256
 * özeti tutulur (davet akışının deseni). E-posta doğrudan gönderilmez,
 * KUYRUĞA yazılır (Faz 8 kararı): yüz alıcılı bir gönderim, isteği
 * dakikalarca bekletmemelidir.
 *
 * AYNI KİŞİYE İKİNCİ KEZ GÖNDERİLMEZ: mevcut gönderimi olan kontak atlanır,
 * yoksa aynı kişi iki bağlantı alır ve yanıtlama oranı bozulur.
 */
export async function anketGonder(
  anketId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.anketGonder))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  await sahiplikDogrula(db, "anket", anketId);

  const anket = (await kayitOku(db, "anket", anketId)) as
    | { baslik: string; durum: string; aciklama: string | null }
    | null;
  if (!anket) return { error: "Anket bulunamadı." };
  if (anket.durum !== "yayinda") {
    return { error: "Yalnızca yayındaki anketler gönderilebilir." };
  }

  const soruSayisi = await db.anketSorusu.count({ where: { anketId } });
  if (soruSayisi === 0) {
    return { error: "Sorusuz anket gönderilemez." };
  }

  const kisiIdler = formData.getAll("kisiId").map(String).filter(Boolean);
  if (kisiIdler.length === 0) return { error: "En az bir kontak seçin." };

  const kisiler = await db.kisi.findMany({
    where: { id: { in: kisiIdler }, email: { not: null } },
    select: { id: true, ad: true, email: true, firmaId: true },
  });
  if (kisiler.length === 0) {
    return { error: "Seçilen kontakların e-posta adresi yok." };
  }

  const mevcut = await db.anketGonderim.findMany({
    where: { anketId, kisiId: { in: kisiler.map((k) => k.id) } },
    select: { kisiId: true },
  });
  const gonderilmis = new Set(mevcut.map((m) => m.kisiId));

  const ayar = await kiraciAyari();
  const adres = process.env.UYGULAMA_ADRESI ?? "http://localhost:3000";
  let sayi = 0;

  for (const kisi of kisiler) {
    if (gonderilmis.has(kisi.id)) continue;

    const { token, ozet } = anketTokenUret();
    await tenantOlustur(db, "anketGonderim", {
      anketId,
      firmaId: kisi.firmaId,
      kisiId: kisi.id,
      ad: kisi.ad,
      email: kisi.email!,
      tokenOzeti: ozet,
      gonderimTarihi: new Date(),
    });

    // E-posta doğrudan gönderilmez, KUYRUĞA yazılır (Faz 8 kararı): yüz
    // alıcılı bir gönderim isteği dakikalarca bekletmemelidir.
    await tenantOlustur(db, "epostaKuyrugu", {
      alici: kisi.email!,
      konu: `${ayar.ad} · ${anket.baslik}`,
      tur: "anket",
      govde:
        `Sayın ${kisi.ad},\n\n` +
        `${anket.aciklama ?? "Görüşünüzü almak istiyoruz."}\n\n` +
        `Anketi yanıtlamak için: ${adres}/anket/${token}\n\n` +
        `Bu bağlantı size özeldir ve bir kez kullanılabilir.\n\n` +
        `${ayar.ad}`,
    });
    sayi++;
  }

  await denetimYaz({
    islem: "olustur",
    varlik: "AnketGonderim",
    varlikId: anketId,
    ozet: `${anket.baslik}: ${sayi} kişiye gönderildi`,
    yeni: { anketId, alici: sayi, gonderen: session.email },
  });

  revalidate(anketId);
  return sayi === 0
    ? { error: "Seçilen kontakların hepsine daha önce gönderilmiş." }
    : { ok: true };
}
