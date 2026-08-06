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
  konu: z.string().trim().optional(),
  egitmen: z.string().trim().optional(),
  tarih: z.coerce.date(),
  sureSaat: z.coerce.number().min(0).default(0),
  katilimci: z.coerce.number().int().min(0).default(0),
  durum: z.enum(["planlandi", "tamamlandi", "iptal"]).default("planlandi"),
  notlar: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

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
  if (!(await yetkiVarMi(IZIN.egitimOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  // Kaydın bağlanacağı firma bu kiracıya ait olmalı (A3).
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  const kayit = await tenantOlustur(db, "egitim", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Egitim",
    varlikId: kayit.id,
    ozet: parsed.data.baslik,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateEgitim(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.egitimDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const oncesi = await kayitOku(db, "egitim", id);
  await tenantGuncelle(db, "egitim", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Egitim",
    varlikId: id,
    ozet: parsed.data.baslik,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteEgitim(id: string, firmaId: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.egitimSil))) {
    throw new Error(YETKISIZ);
  }

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "egitim", id);
  await tenantSil(db, "egitim", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Egitim",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(firmaId);
}
