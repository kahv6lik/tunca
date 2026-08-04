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
  tutar: z.coerce.number().min(0).default(0),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  tarih: z.coerce.date(),
  durum: z
    .enum(["basvuruldu", "onaylandi", "reddedildi", "tamamlandi"])
    .default("basvuruldu"),
  aciklama: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

function revalidate(firmaId: string) {
  revalidatePath("/yatirim-destekleri");
  revalidatePath("/raporlar");
  revalidatePath("/");
  revalidatePath(`/firmalar/${firmaId}`);
}

export async function createYatirim(
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
  await tenantOlustur(db, "yatirimDestegi", parsed.data);
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateYatirim(
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
  await tenantGuncelle(db, "yatirimDestegi", id, parsed.data);
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteYatirim(id: string, firmaId: string): Promise<void> {
  const db = await getTenantDb();
  await tenantSil(db, "yatirimDestegi", id);
  revalidate(firmaId);
}
