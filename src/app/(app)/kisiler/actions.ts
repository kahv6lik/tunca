"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantDb,
  firmaSahipligiDogrula,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { alanlariGetir, formdanDegerler, degerleriKaydet } from "@/lib/ozel-alan";

/**
 * Kişi (Contact) işlemleri — Faz 6 / C1.
 *
 * Kişi her zaman bir firmaya bağlıdır. Firmanın oturumdaki kiracıya ait
 * olduğu `firmaSahipligiDogrula` ile doğrulanır; bu olmadan kullanıcı kendi
 * kiracısında ama BAŞKA kiracının firmasına bağlı bir kişi oluşturabilirdi.
 */

const schema = z.object({
  firmaId: z.string().min(1),
  ad: z.string().trim().min(1, "Ad zorunludur."),
  unvan: z.string().trim().optional(),
  telefon: z.string().trim().optional(),
  email: z.string().trim().optional(),
  // Form'dan "1"/"0" gelir. `z.coerce.boolean()` KULLANILMAZ: o, "0" ve
  // "false" dizgelerini de true'ya çevirir (boş olmayan her dizge true'dur).
  birincil: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  notlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(firmaId: string) {
  revalidatePath("/kisiler");
  revalidatePath("/firsatlar");
  revalidatePath(`/firmalar/${firmaId}`);
}

/**
 * Birincil kişi kuralı: bir firmada en fazla bir birincil kişi olur.
 *
 * Yeni birincil işaretlenince diğerlerinin işareti kaldırılır — kullanıcıya
 * "önce eskisini kaldırın" dedirtmek yerine niyeti uygularız. `updateMany`
 * kullanılır; kiracı katmanı `tenantId` filtresini kendisi ekler.
 */
async function digerBirincilleriKaldir(
  db: TenantClient,
  firmaId: string,
  haricId?: string
) {
  await db.kisi.updateMany({
    where: { firmaId, birincil: true, ...(haricId ? { NOT: { id: haricId } } : {}) },
    data: { birincil: false },
  });
}

export async function createKisi(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kisiOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const alanlar = await alanlariGetir("kisi");
  const ozel = formdanDegerler(alanlar, formData);
  if (!ozel.ok) return { error: ozel.hata };

  if (parsed.data.birincil) {
    await digerBirincilleriKaldir(db, parsed.data.firmaId);
  }

  const kayit = await tenantOlustur(db, "kisi", parsed.data);
  await degerleriKaydet(db, "kisi", kayit.id, ozel.degerler);

  await denetimYaz({
    islem: "olustur",
    varlik: "Kisi",
    varlikId: kayit.id,
    ozet: parsed.data.ad,
    yeni: { ...parsed.data, ozelAlanlar: Object.fromEntries(ozel.degerler) },
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateKisi(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kisiDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const alanlar = await alanlariGetir("kisi");
  const ozel = formdanDegerler(alanlar, formData);
  if (!ozel.ok) return { error: ozel.hata };

  if (parsed.data.birincil) {
    await digerBirincilleriKaldir(db, parsed.data.firmaId, id);
  }

  const oncesi = await kayitOku(db, "kisi", id);
  await tenantGuncelle(db, "kisi", id, parsed.data);
  await degerleriKaydet(db, "kisi", id, ozel.degerler);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Kisi",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: { ...parsed.data, ozelAlanlar: Object.fromEntries(ozel.degerler) },
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteKisi(id: string, firmaId: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.kisiSil))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "kisi", id);
  // Kişiye bağlı fırsatlar SİLİNMEZ; yalnızca kişi bağlantısı boşalır
  // (şema: onDelete SetNull). Bir muhatabın ayrılması işi ortadan kaldırmaz.
  await tenantSil(db, "kisi", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Kisi",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(firmaId);
}
