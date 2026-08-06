"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantDb,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

/**
 * Satış hattı aşamaları — Faz 6 / C2.
 *
 * Aşamalar KİRACIYA ÖZELDİR: her kuruluş kendi satış sürecini kurar. Hattın
 * biçimi kuruluş çapında bir karar olduğu için yalnızca `firsat.asama` izni
 * olan (varsayılan: kuruluş yöneticisi) değiştirebilir.
 */

const schema = z.object({
  ad: z.string().trim().min(1, "Aşama adı zorunludur."),
  olasilik: z.coerce.number().int().min(0).max(100).default(0),
  renk: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/firsatlar");
  revalidatePath("/firsatlar/asamalar");
}

export async function asamaOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.asamaYonet))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const mevcut = await db.asama.findFirst({ where: { ad: parsed.data.ad } });
  if (mevcut) return { error: "Bu adda bir aşama zaten var." };

  // Yeni aşama hattın sonuna eklenir.
  const son = await db.asama.findFirst({ orderBy: { sira: "desc" }, select: { sira: true } });

  const kayit = await tenantOlustur(db, "asama", {
    ...parsed.data,
    renk: parsed.data.renk || null,
    sira: (son?.sira ?? -1) + 1,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Asama",
    varlikId: kayit.id,
    ozet: parsed.data.ad,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function asamaGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.asamaYonet))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const cakisma = await db.asama.findFirst({
    where: { ad: parsed.data.ad, NOT: { id } },
  });
  if (cakisma) return { error: "Bu adda başka bir aşama var." };

  const oncesi = await kayitOku(db, "asama", id);
  await tenantGuncelle(db, "asama", id, {
    ...parsed.data,
    renk: parsed.data.renk || null,
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Asama",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

/**
 * Aşamayı siler.
 *
 * İçinde fırsat varken silinemez — şemada `onDelete: Restrict` var, yani
 * veritabanı da buna izin vermez. Kullanıcıya anlamlı bir mesaj dönebilmek
 * için burada önceden sayıyoruz; asıl güvence veritabanındaki kısıttır.
 */
export async function asamaSil(id: string): Promise<{ error?: string }> {
  if (!(await yetkiVarMi(IZIN.asamaYonet))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const sayi = await db.firsat.count({ where: { asamaId: id } });
  if (sayi > 0) {
    return {
      error: `Bu aşamada ${sayi} fırsat var. Önce onları başka bir aşamaya taşıyın.`,
    };
  }

  const toplam = await db.asama.count({});
  if (toplam <= 1) {
    return { error: "Satış hattında en az bir aşama kalmalı." };
  }

  const oncesi = await kayitOku(db, "asama", id);
  await tenantSil(db, "asama", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Asama",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidate();
  return {};
}

/** Aşamayı hatta bir sıra sola ya da sağa taşır. */
export async function asamaTasi(id: string, yon: "sol" | "sag"): Promise<void> {
  if (!(await yetkiVarMi(IZIN.asamaYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const asamalar = await db.asama.findMany({ orderBy: { sira: "asc" } });
  const i = asamalar.findIndex((a) => a.id === id);
  if (i === -1) return;

  const j = yon === "sol" ? i - 1 : i + 1;
  if (j < 0 || j >= asamalar.length) return;

  // Sıra numaraları elle verilmiş olabilir (eşit ya da boşluklu); takas
  // yerine listeyi baştan numaralandırmak tutarlı sonuç verir.
  const yeniSira = [...asamalar];
  [yeniSira[i], yeniSira[j]] = [yeniSira[j], yeniSira[i]];

  for (let k = 0; k < yeniSira.length; k++) {
    await tenantGuncelle(db, "asama", yeniSira[k].id, { sira: k });
  }

  revalidate();
}
