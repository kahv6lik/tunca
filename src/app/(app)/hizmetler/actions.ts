"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantDb,
  firmaSahipligiDogrula,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
} from "@/lib/tenant-db";

const schema = z.object({
  firmaId: z.string().min(1),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  tur: z.string().trim().optional(),
  tarih: z.coerce.date(),
  durum: z.enum(["devam", "tamamlandi", "iptal"]).default("devam"),
  aciklama: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

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
  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  // Kaydın bağlanacağı firma bu kiracıya ait olmalı (A3).
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  await tenantOlustur(db, "hizmet", parsed.data);
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateHizmet(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  await tenantGuncelle(db, "hizmet", id, parsed.data);
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteHizmet(id: string, firmaId: string): Promise<void> {
  const db = await getTenantDb();
  await tenantSil(db, "hizmet", id);
  revalidate(firmaId);
}
