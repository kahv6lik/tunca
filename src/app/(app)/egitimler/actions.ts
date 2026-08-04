"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const schema = z.object({
  firmaId: z.string().min(1),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  konu: z.string().trim().optional(),
  egitmen: z.string().trim().optional(),
  tarih: z.coerce.date(),
  sureSaat: z.coerce.number().min(0).default(0),
  katilimci: z.coerce.number().int().min(0).default(0),
  durum: z.enum(["planlandi", "tamamlandi", "iptal"]).default("planlandi"),
  notlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

function revalidate(firmaId: string) {
  revalidatePath("/egitimler");
  revalidatePath("/raporlar");
  revalidatePath("/");
  revalidatePath(`/firmalar/${firmaId}`);
}

export async function createEgitim(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.egitim.create({ data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateEgitim(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.egitim.update({ where: { id }, data: parsed.data });
  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteEgitim(id: string, firmaId: string): Promise<void> {
  await requireSession();
  await prisma.egitim.delete({ where: { id } });
  revalidate(firmaId);
}
