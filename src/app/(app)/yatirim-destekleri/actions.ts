"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

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
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.yatirimDestegi.create({ data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateYatirim(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.yatirimDestegi.update({ where: { id }, data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteYatirim(id: string, firmaId: string): Promise<void> {
  await requireSession();
  await prisma.yatirimDestegi.delete({ where: { id } });
  revalidate(firmaId);
}
