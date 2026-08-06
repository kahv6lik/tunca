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
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

const schema = z.object({
  firmaId: z.string().min(1),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  tur: z.string().trim().optional(),
  tarih: z.coerce.date(),
  durum: z.enum(["devam", "tamamlandi", "iptal"]).default("devam"),
  aciklama: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(firmaId: string) {
  revalidatePath("/hizmetler");
  revalidatePath("/raporlar");
  revalidatePath("/");
  revalidatePath(`/firmalar/${firmaId}`);
}

export async function createHizmet(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.hizmetOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  // Kaydın bağlanacağı firma bu kiracıya ait olmalı (A3).
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  const kayit = await tenantOlustur(db, "hizmet", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Hizmet",
    varlikId: kayit.id,
    ozet: parsed.data.baslik,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateHizmet(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.hizmetDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const oncesi = await kayitOku(db, "hizmet", id);
  await tenantGuncelle(db, "hizmet", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Hizmet",
    varlikId: id,
    ozet: parsed.data.baslik,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteHizmet(id: string, firmaId: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.hizmetSil))) {
    throw new Error(YETKISIZ);
  }

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "hizmet", id);
  await tenantSil(db, "hizmet", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Hizmet",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(firmaId);
}
