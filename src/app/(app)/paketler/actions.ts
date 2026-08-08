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
  firmaSahipligiDogrula,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { URUN_DURUM } from "@/lib/constants";
import { kodNormalize } from "@/lib/urun-tanimlar";

/**
 * Ürün paketi — Faz 14 / T2.
 *
 * Paket, "bu müşteriye bu kalemleri şu fiyata veriyoruz" anlaşmasıdır.
 * `firmaId` boşsa paket kiracı genelinde herkese açıktır; doluysa yalnızca o
 * firmaya sunulur. Ortağın istediği "müşteriye özel paket" ikinci hâldir ama
 * genel paketi de aynı ekranla yönetmek, iki ayrı ekran açmaktan iyidir.
 *
 * KALEMLER TOPLU YAZILIR: form her kaydedişte paketin tam hâlini gönderir,
 * sunucu eskileri silip yenileri yazar. Kalem kalem action yazmak, yarım
 * kaydedilmiş paketler üretirdi.
 */

const schema = z.object({
  kod: z.string().trim().min(1, "Paket kodu zorunludur.").max(40),
  ad: z.string().trim().min(1, "Paket adı zorunludur."),
  aciklama: z.string().trim().optional(),
  firmaId: z.string().trim().optional(),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  sabitFiyat: z.coerce.boolean().default(false),
  fiyat: z.coerce.number().min(0).default(0),
  iskontoOrani: z.coerce.number().min(0).max(100).default(0),
  durum: z.enum(URUN_DURUM).default("aktif"),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/paketler");
  revalidatePath("/urunler");
}

type Kalem = { urunId: string; miktar: number; sira: number };

/**
 * Kalemleri formdan okur.
 *
 * Biçim: `kalem-<i>-urunId` / `kalem-<i>-miktar`. Aynı ürün iki kez
 * eklenirse SON miktar geçerlidir — `@@unique([paketId, urunId])` kısıtı
 * çakışmayı reddederdi ve kullanıcı sebebini anlamayan bir hata görürdü.
 */
function kalemleriOku(formData: FormData): Kalem[] {
  const harita = new Map<string, Kalem>();
  let sira = 0;

  for (const [anahtar, deger] of formData.entries()) {
    const eslesme = /^kalem-(\d+)-urunId$/.exec(anahtar);
    if (!eslesme) continue;

    const urunId = String(deger).trim();
    if (!urunId) continue;

    const miktar = Number(formData.get(`kalem-${eslesme[1]}-miktar`) ?? 1) || 0;
    if (miktar <= 0) continue;

    harita.set(urunId, { urunId, miktar, sira: sira++ });
  }

  return [...harita.values()];
}

async function kalemleriYaz(db: TenantClient, paketId: string, kalemler: Kalem[]) {
  // Önce temizle, sonra yaz: paketin tam hâli formdan gelir.
  await db.paketKalemi.deleteMany({ where: { paketId } });
  for (const k of kalemler) {
    await tenantOlustur(db, "paketKalemi", { paketId, ...k });
  }
}

/** Ürünlerin bu kiracıya ait olduğunu doğrular (A3). */
async function urunleriDogrula(db: TenantClient, kalemler: Kalem[]) {
  for (const k of kalemler) {
    await sahiplikDogrula(db, "urun", k.urunId);
  }
}

export async function paketOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) return { error: YETKISIZ };

  const parsed = schema.safeParse({
    ...Object.fromEntries(formData.entries()),
    sabitFiyat: formData.get("sabitFiyat") === "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) {
    return { error: "Pakete en az bir ürün ekleyin." };
  }

  const db = await getTenantDb();
  const kod = kodNormalize(parsed.data.kod);

  const mevcut = await db.paket.findFirst({ where: { kod }, select: { id: true } });
  if (mevcut) return { error: `"${kod}" kodu zaten kullanılıyor.` };

  const firmaId = parsed.data.firmaId || null;
  if (firmaId) await firmaSahipligiDogrula(db, firmaId);
  await urunleriDogrula(db, kalemler);

  const { firmaId: _f, kod: _k, ...kalan } = parsed.data;
  const paket = await tenantOlustur(db, "paket", { ...kalan, kod, firmaId });
  await kalemleriYaz(db, paket.id, kalemler);

  await denetimYaz({
    islem: "olustur",
    varlik: "Paket",
    varlikId: paket.id,
    ozet: `${kod} — ${parsed.data.ad}`,
    yeni: { ...parsed.data, kod, firmaId, kalemSayisi: kalemler.length },
  });

  revalidate();
  return { ok: true };
}

export async function paketGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) return { error: YETKISIZ };

  const parsed = schema.safeParse({
    ...Object.fromEntries(formData.entries()),
    sabitFiyat: formData.get("sabitFiyat") === "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const kalemler = kalemleriOku(formData);
  if (kalemler.length === 0) {
    return { error: "Pakete en az bir ürün ekleyin." };
  }

  const db = await getTenantDb();
  const kod = kodNormalize(parsed.data.kod);

  const cakisan = await db.paket.findFirst({
    where: { kod, id: { not: id } },
    select: { id: true },
  });
  if (cakisan) return { error: `"${kod}" kodu zaten kullanılıyor.` };

  const firmaId = parsed.data.firmaId || null;
  if (firmaId) await firmaSahipligiDogrula(db, firmaId);
  await urunleriDogrula(db, kalemler);

  const oncesi = await kayitOku(db, "paket", id);
  const { firmaId: _f, kod: _k, ...kalan } = parsed.data;

  await tenantGuncelle(db, "paket", id, { ...kalan, kod, firmaId });
  await kalemleriYaz(db, id, kalemler);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Paket",
    varlikId: id,
    ozet: `${kod} — ${parsed.data.ad}`,
    eski: oncesi,
    yeni: { ...parsed.data, kod, firmaId, kalemSayisi: kalemler.length },
  });

  revalidate();
  return { ok: true };
}

export async function paketSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "paket", id);
  // Kalemler FK cascade ile gider; kampanya kapsamı da öyle.
  await tenantSil(db, "paket", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Paket",
    varlikId: id,
    ozet: `${oncesi?.kod ?? ""} — ${oncesi?.ad ?? ""}`,
    eski: oncesi,
  });

  revalidate();
}
