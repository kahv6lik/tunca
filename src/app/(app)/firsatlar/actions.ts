"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  getTenantDb,
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
import { FIRSAT_DURUM } from "@/lib/constants";

/**
 * Fırsat / Anlaşma işlemleri — Faz 6 / C2, C3.
 *
 * Fırsat üç ayrı kayda bağlanır: firma (zorunlu), kişi (isteğe bağlı) ve
 * aşama (zorunlu). ÜÇÜ DE oturumdaki kiracıya ait olmalıdır — aksi halde
 * kullanıcı kendi kiracısında ama başka kiracının aşamasına/kişisine bağlı
 * bir kayıt üretebilirdi. Kontroller aşağıda `bagliKayitlariDogrula`
 * içindedir ve HER yazma işleminde çalışır.
 */

const schema = z.object({
  firmaId: z.string().min(1, "Firma zorunludur."),
  kisiId: z.string().trim().optional(),
  asamaId: z.string().min(1, "Aşama zorunludur."),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  tutar: z.coerce.number().min(0).default(0),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  olasilik: z.coerce.number().int().min(0).max(100).default(0),
  kapanisTarihi: z.string().trim().optional(),
  sorumluId: z.string().trim().optional(),
  durum: z.enum(FIRSAT_DURUM).default("acik"),
  kapanisSebebi: z.string().trim().optional(),
  aciklama: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(firmaId?: string) {
  revalidatePath("/firsatlar");
  revalidatePath("/raporlar");
  revalidatePath("/");
  if (firmaId) revalidatePath(`/firmalar/${firmaId}`);
}

/** Firma, aşama, kişi ve sorumlu kullanıcı bu kiracıya ait mi? */
async function bagliKayitlariDogrula(
  db: TenantClient,
  veri: { firmaId: string; asamaId: string; kisiId?: string; sorumluId?: string }
) {
  await firmaSahipligiDogrula(db, veri.firmaId);
  await sahiplikDogrula(db, "asama", veri.asamaId);

  if (veri.kisiId) {
    const kisi = await db.kisi.findFirst({
      where: { id: veri.kisiId, firmaId: veri.firmaId },
      select: { id: true },
    });
    // Kişi hem kiracıya hem de SEÇİLEN FİRMAYA ait olmalı; başka firmanın
    // muhatabı bu fırsata bağlanamaz.
    if (!kisi) notFound();
  }

  if (veri.sorumluId) {
    const kullanici = await db.user.findFirst({
      where: { id: veri.sorumluId },
      select: { id: true },
    });
    if (!kullanici) notFound();
  }
}

/** Form verisini Prisma'nın beklediği biçime çevirir. */
function veriHazirla(d: z.infer<typeof schema>) {
  return {
    firmaId: d.firmaId,
    kisiId: d.kisiId || null,
    asamaId: d.asamaId,
    baslik: d.baslik,
    tutar: d.tutar,
    paraBirimi: d.paraBirimi,
    olasilik: d.olasilik,
    kapanisTarihi: d.kapanisTarihi ? new Date(d.kapanisTarihi) : null,
    sorumluId: d.sorumluId || null,
    durum: d.durum,
    // Kapanış sebebi yalnızca kaybedilen fırsatta anlamlıdır; fırsat yeniden
    // açılırsa eski sebep ekranda asılı kalmasın diye temizlenir.
    kapanisSebebi: d.durum === "kaybedildi" ? d.kapanisSebebi || null : null,
    aciklama: d.aciklama || null,
  };
}

export async function createFirsat(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firsatOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const veri = veriHazirla(parsed.data);
  const kayit = await tenantOlustur(db, "firsat", veri);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firsat",
    varlikId: kayit.id,
    ozet: veri.baslik,
    yeni: veri,
  });

  revalidate(veri.firmaId);
  return { ok: true };
}

export async function updateFirsat(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firsatDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const veri = veriHazirla(parsed.data);
  const oncesi = await kayitOku(db, "firsat", id);
  await tenantGuncelle(db, "firsat", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firsat",
    varlikId: id,
    ozet: veri.baslik,
    eski: oncesi,
    yeni: veri,
  });

  revalidate(veri.firmaId);
  return { ok: true };
}

export async function deleteFirsat(id: string, firmaId?: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.firsatSil))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "firsat", id);
  await tenantSil(db, "firsat", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Firsat",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(firmaId ?? (oncesi?.firmaId as string | undefined));
}

/**
 * Kanban'da sürükle-bırak ile aşama değiştirme (C3).
 *
 * Ayrı bir action'dır çünkü tek alan değişir ve sık çağrılır. Yetki ve
 * sahiplik kontrolleri tam formdakiyle aynıdır — "küçük işlem" olması
 * korumayı gevşetmek için sebep değildir.
 */
export async function firsatAsamaDegistir(
  id: string,
  asamaId: string
): Promise<void> {
  if (!(await yetkiVarMi(IZIN.firsatDuzenle))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  await sahiplikDogrula(db, "asama", asamaId);

  const oncesi = await kayitOku(db, "firsat", id);
  if (!oncesi) notFound();
  if (oncesi.asamaId === asamaId) return;

  await tenantGuncelle(db, "firsat", id, { asamaId });

  const [eskiAsama, yeniAsama] = await Promise.all([
    db.asama.findFirst({ where: { id: oncesi.asamaId as string }, select: { ad: true } }),
    db.asama.findFirst({ where: { id: asamaId }, select: { ad: true } }),
  ]);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firsat",
    varlikId: id,
    ozet: `${oncesi.baslik as string}: ${eskiAsama?.ad ?? "?"} → ${yeniAsama?.ad ?? "?"}`,
    eski: { asama: eskiAsama?.ad },
    yeni: { asama: yeniAsama?.ad },
  });

  revalidate(oncesi.firmaId as string);
}

/** Fırsatı kazanıldı/kaybedildi olarak kapatma ya da yeniden açma. */
export async function firsatDurumDegistir(
  id: string,
  durum: string,
  sebep?: string
): Promise<void> {
  if (!(await yetkiVarMi(IZIN.firsatDuzenle))) throw new Error(YETKISIZ);
  if (!FIRSAT_DURUM.includes(durum as never)) throw new Error("Geçersiz durum.");

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "firsat", id);
  if (!oncesi) notFound();

  const veri = {
    durum,
    kapanisSebebi: durum === "kaybedildi" ? sebep?.trim() || null : null,
    // Kazanılan fırsatın olasılığı %100, kaybedilenin %0'dır — hattaki
    // beklenen ciro hesabı kapanmış işleri saymasın diye.
    olasilik: durum === "kazanildi" ? 100 : durum === "kaybedildi" ? 0 : oncesi.olasilik,
  };
  await tenantGuncelle(db, "firsat", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firsat",
    varlikId: id,
    ozet: `${oncesi.baslik as string} → ${durum}`,
    eski: { durum: oncesi.durum, olasilik: oncesi.olasilik },
    yeni: veri,
  });

  revalidate(oncesi.firmaId as string);
}
