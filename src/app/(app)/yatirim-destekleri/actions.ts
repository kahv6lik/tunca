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
  tutar: z.coerce.number().min(0).default(0),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  tarih: z.coerce.date(),
  durum: z
    .enum(["basvuruldu", "onaylandi", "reddedildi", "tamamlandi"])
    .default("basvuruldu"),
  aciklama: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

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
  if (!(await yetkiVarMi(IZIN.yatirimOlustur))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  // Kaydın bağlanacağı firma bu kiracıya ait olmalı (A3).
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  const kayit = await tenantOlustur(db, "yatirimDestegi", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "YatirimDestegi",
    varlikId: kayit.id,
    ozet: parsed.data.baslik,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function updateYatirim(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.yatirimDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const oncesi = await kayitOku(db, "yatirimDestegi", id);
  await tenantGuncelle(db, "yatirimDestegi", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "YatirimDestegi",
    varlikId: id,
    ozet: parsed.data.baslik,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate(parsed.data.firmaId);
  return { ok: true };
}

export async function deleteYatirim(id: string, firmaId: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.yatirimSil))) {
    throw new Error(YETKISIZ);
  }

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "yatirimDestegi", id);
  await tenantSil(db, "yatirimDestegi", id);

  await denetimYaz({
    islem: "sil",
    varlik: "YatirimDestegi",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(firmaId);
}
