"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const firmaSchema = z.object({
  ad: z.string().trim().min(1, "Firma adı zorunludur."),
  vergiNo: z.string().trim().optional(),
  sektor: z.string().trim().optional(),
  il: z.string().trim().optional(),
  ilce: z.string().trim().optional(),
  yetkiliAd: z.string().trim().optional(),
  telefon: z.string().trim().optional(),
  email: z.string().trim().optional(),
  adres: z.string().trim().optional(),
  durum: z.enum(["aktif", "pasif"]).default("aktif"),
  notlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return firmaSchema.safeParse(raw);
}

export async function createFirma(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  const firma = await prisma.firma.create({ data: parsed.data });
  revalidatePath("/firmalar");
  redirect(`/firmalar/${firma.id}`);
}

export async function updateFirma(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await prisma.firma.update({ where: { id }, data: parsed.data });
  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${id}`);
  redirect(`/firmalar/${id}`);
}

export async function deleteFirma(id: string): Promise<void> {
  await requireSession();
  await prisma.firma.delete({ where: { id } });
  revalidatePath("/firmalar");
  redirect("/firmalar");
}
