"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantDb,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  sahiplikDogrula,
} from "@/lib/tenant-db";
import { IZIN, TUM_IZINLER, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

const grupSchema = z.object({
  ad: z.string().trim().min(1, "Grup adı zorunludur."),
  aciklama: z.string().trim().optional(),
});

/** Yalnızca tanımlı izinler kabul edilir — uydurma izin anahtarı yazılamaz. */
function izinleriAyikla(formData: FormData): string[] {
  const gecerli = new Set<string>(TUM_IZINLER);
  return formData
    .getAll("izinler")
    .map(String)
    .filter((i) => gecerli.has(i));
}

export async function grupOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.grupYonet))) return { error: YETKISIZ };

  const parsed = grupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const db = await getTenantDb();
  const izinler = izinleriAyikla(formData);

  const mevcut = await db.grup.findFirst({ where: { ad: parsed.data.ad } });
  if (mevcut) return { error: "Bu adda bir grup zaten var." };

  const grup = await tenantOlustur(db, "grup", { ...parsed.data, izinler });

  await denetimYaz({
    islem: "olustur",
    varlik: "Grup",
    varlikId: grup.id,
    ozet: parsed.data.ad,
    yeni: { ...parsed.data, izinler },
  });

  revalidatePath("/gruplar");
  return { ok: true };
}

export async function grupGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.grupYonet))) return { error: YETKISIZ };

  const parsed = grupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const db = await getTenantDb();
  const izinler = izinleriAyikla(formData);
  const oncesi = await kayitOku(db, "grup", id);

  await tenantGuncelle(db, "grup", id, { ...parsed.data, izinler });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Grup",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: { ...parsed.data, izinler },
  });

  revalidatePath("/gruplar");
  return { ok: true };
}

export async function grupSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.grupYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "grup", id);
  await tenantSil(db, "grup", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Grup",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidatePath("/gruplar");
}

/** Kullanıcıyı gruba ekler veya çıkarır. */
export async function uyelikDegistir(
  grupId: string,
  userId: string,
  ekle: boolean
): Promise<void> {
  if (!(await yetkiVarMi(IZIN.grupYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();

  // Hem grup hem kullanıcı bu kiracıya ait olmalı.
  await sahiplikDogrula(db, "grup", grupId);
  const kullanici = await db.user.findFirst({ where: { id: userId }, select: { id: true, email: true } });
  if (!kullanici) throw new Error("Kullanıcı bulunamadı.");

  if (ekle) {
    const varMi = await db.kullaniciGrup.findFirst({ where: { grupId, userId } });
    if (!varMi) {
      await db.kullaniciGrup.create({ data: { grupId, userId } as never });
    }
  } else {
    await db.kullaniciGrup.deleteMany({ where: { grupId, userId } });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Grup",
    varlikId: grupId,
    ozet: `${kullanici.email} ${ekle ? "gruba eklendi" : "gruptan çıkarıldı"}`,
    yeni: { userId, uye: ekle },
  });

  revalidatePath("/gruplar");
}
