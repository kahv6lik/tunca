"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getTenantDb,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

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

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return firmaSchema.safeParse(raw);
}

export async function createFirma(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firmaOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  // tenantId, kiracı katmanı tarafından otomatik eklenir.
  const firma = await tenantOlustur(db, "firma", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firma",
    varlikId: firma.id,
    ozet: parsed.data.ad,
    yeni: parsed.data,
  });

  revalidatePath("/firmalar");
  redirect(`/firmalar/${firma.id}`);
}

export async function updateFirma(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firmaDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const oncesi = await kayitOku(db, "firma", id);
  // Kayıt bu kiracıya ait değilse 404 üretir (A3).
  await tenantGuncelle(db, "firma", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firma",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${id}`);
  redirect(`/firmalar/${id}`);
}

export async function deleteFirma(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.firmaSil))) {
    throw new Error(YETKISIZ);
  }

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "firma", id);
  await tenantSil(db, "firma", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Firma",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidatePath("/firmalar");
  revalidatePath("/");
  revalidatePath("/raporlar");
  redirect("/firmalar");
}
