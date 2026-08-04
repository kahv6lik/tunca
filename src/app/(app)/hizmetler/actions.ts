"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

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
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.hizmet.create({ data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateHizmet(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.hizmet.update({ where: { id }, data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteHizmet(id: string, firmaId: string): Promise<void> {
  await requireSession();
  await prisma.hizmet.delete({ where: { id } });
  revalidate(firmaId);
}
