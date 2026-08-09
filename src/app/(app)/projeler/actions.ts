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
  firmaSahipligiDogrula,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { PROJE_DURUM } from "@/lib/constants";
import { kodNormalize } from "@/lib/urun-tanimlar";

/**
 * Proje işlemleri — Faz 16 / P1.
 *
 * Teklif ve sipariş projeye OPSİYONEL olarak bağlanır (karar: v1.16.0):
 * tek seferlik küçük satışlar için proje açmak zorunda kalmak, kullanıcıyı
 * boş proje üretmeye iterdi.
 */

const schema = z.object({
  kod: z.string().trim().min(1, "Proje kodu zorunludur.").max(40),
  ad: z.string().trim().min(1, "Proje adı zorunludur."),
  aciklama: z.string().trim().optional(),
  firmaId: z.string().min(1, "Firma zorunludur."),
  sorumluId: z.string().trim().optional(),
  durum: z.enum(PROJE_DURUM).default("planlandi"),
  baslangic: z.string().trim().optional(),
  bitis: z.string().trim().optional(),
  butce: z.coerce.number().min(0).default(0),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(id?: string) {
  revalidatePath("/projeler");
  if (id) revalidatePath(`/projeler/${id}`);
}

function ayristir(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const baslangic = parsed.data.baslangic ? new Date(parsed.data.baslangic) : null;
  const bitis = parsed.data.bitis ? new Date(parsed.data.bitis) : null;

  // Ters tarih aralığı sessizce kabul edilmez: proje süresi raporlarda
  // negatif çıkardı (Faz 13 / H9'daki aynı özen).
  if (baslangic && bitis && baslangic > bitis) {
    return { error: "Başlangıç tarihi bitişten sonra olamaz." };
  }

  return {
    data: {
      ...parsed.data,
      kod: kodNormalize(parsed.data.kod),
      aciklama: parsed.data.aciklama || null,
      sorumluId: parsed.data.sorumluId || null,
      baslangic,
      bitis,
    },
  };
}

export async function projeOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.projeOlustur))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const mevcut = await db.proje.findFirst({
    where: { kod: parsed.data.kod },
    select: { id: true },
  });
  if (mevcut) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const proje = await tenantOlustur(db, "proje", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Proje",
    varlikId: proje.id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    yeni: parsed.data,
  });

  revalidate();
  redirect(`/projeler/${proje.id}`);
}

export async function projeGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.projeDuzenle))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const cakisan = await db.proje.findFirst({
    where: { kod: parsed.data.kod, id: { not: id } },
    select: { id: true },
  });
  if (cakisan) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const oncesi = await kayitOku(db, "proje", id);
  await tenantGuncelle(db, "proje", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Proje",
    varlikId: id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate(id);
  return { ok: true };
}

export async function projeSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.projeSil))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "proje", id);

  /**
   * Projeye bağlı teklif/sipariş/destek kayıtları SİLİNMEZ: FK'ler
   * `SetNull` olduğu için bağ kopar, kayıtlar yerinde kalır. Satış ve destek
   * geçmişi, projenin kapatılmasıyla yok olmamalıdır.
   */
  await tenantSil(db, "proje", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Proje",
    varlikId: id,
    ozet: `${oncesi?.kod ?? ""} — ${oncesi?.ad ?? ""}`,
    eski: oncesi,
  });

  revalidate();
  redirect("/projeler");
}
