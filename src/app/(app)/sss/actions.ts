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
import { etiketleriAyristir } from "@/lib/sss-tanimlar";

/**
 * SSS (bilgi bankası) işlemleri — Faz 16 / P4.
 *
 * GÖRÜNTÜLEME ile YÖNETİM ayrı izinlerdir (`sss.goruntule` / `sss.yonet`):
 * destek ekibinin tamamı yanıtları okumalı, ama kurumsal cevabı yalnızca
 * yetkili kişi değiştirmelidir — yanlış bir yanıt hepsine yayılır.
 */

const schema = z.object({
  soru: z.string().trim().min(1, "Soru zorunludur."),
  yanit: z.string().trim().min(1, "Yanıt zorunludur."),
  kategori: z.string().trim().optional(),
  etiketler: z.string().trim().optional(),
  durum: z.enum(["aktif", "pasif"]).default("aktif"),
  sira: z.coerce.number().int().min(0).default(0),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/sss");
}

function ayristir(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  return {
    data: {
      soru: parsed.data.soru,
      yanit: parsed.data.yanit,
      kategori: parsed.data.kategori || null,
      etiketler: etiketleriAyristir(parsed.data.etiketler),
      durum: parsed.data.durum,
      sira: parsed.data.sira,
    },
  };
}

export async function sssOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.sssYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  const kayit = await tenantOlustur(db, "sss", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Sss",
    varlikId: kayit.id,
    ozet: parsed.data.soru,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function sssGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.sssYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "sss", id);
  if (!oncesi) return { error: "Kayıt bulunamadı." };

  await tenantGuncelle(db, "sss", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Sss",
    varlikId: id,
    ozet: parsed.data.soru,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function sssSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.sssYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "sss", id);
  await tenantSil(db, "sss", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Sss",
    varlikId: id,
    ozet: (oncesi?.soru as string) ?? undefined,
    eski: oncesi,
  });

  revalidate();
}

/**
 * Görüntülenme sayacı.
 *
 * ATOMİKTİR (`increment`): iki kişi aynı anda açtığında "oku → +1 → yaz"
 * sayımlardan birini kaybederdi. Sayaç hangi yanıtın gerçekten işe
 * yaradığını gösterir; yanlış sayım raporu değil, içerik kararını bozar.
 *
 * Denetim günlüğüne YAZILMAZ: bir yanıtı okumak bir değişiklik değildir ve
 * günlük okuma trafiğiyle dolarsa gerçek değişiklikler görünmez olur.
 */
export async function sssOkundu(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.sssGoruntule))) return;

  const db = await getTenantDb();
  await tenantGuncelle(db, "sss", id, { goruntulenme: { increment: 1 } });

  // Bilinçli olarak `revalidatePath` ÇAĞRILMAZ: her soru açılışında sayfayı
  // yeniden çekmek, yalnızca bir sayacı tazelemek için ağır bir bedeldir.
  // Sayı bir sonraki ziyarette görünür.
}
