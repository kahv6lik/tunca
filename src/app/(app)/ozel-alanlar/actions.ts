"use server";

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
import {
  OZEL_ALAN_VARLIKLARI,
  OZEL_ALAN_TIPLERI,
  alanAdiDogrula,
  secenekleriAyristir,
  type OzelAlanVarligi,
} from "@/lib/ozel-alan-tanimlar";

/**
 * Özel alan tanımı işlemleri — Faz 11 / E6.
 *
 * Hepsi `ozelalan.yonet` iznine bağlıdır: alan tanımı formların biçimini
 * kuruluş çapında değiştirir. Değer YAZMAK ise bu dosyanın işi değildir —
 * değerler ilgili varlığın kendi action'larında, o varlığın izniyle yazılır.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";
const VARLIK_BASINA_LIMIT = 30;

function ayristir(formData: FormData) {
  const varlik = String(formData.get("varlik") ?? "");
  const ad = String(formData.get("ad") ?? "").trim();
  const tip = String(formData.get("tip") ?? "metin");
  const zorunlu = String(formData.get("zorunlu") ?? "") === "1";
  const secenekler =
    tip === "secim" ? secenekleriAyristir(String(formData.get("secenekler") ?? "")) : [];

  if (!(OZEL_ALAN_VARLIKLARI as readonly string[]).includes(varlik)) {
    return { error: "Geçersiz varlık." as const };
  }
  const adHatasi = alanAdiDogrula(ad);
  if (adHatasi) return { error: adHatasi };
  if (!(OZEL_ALAN_TIPLERI as readonly string[]).includes(tip)) {
    return { error: "Geçersiz alan tipi." as const };
  }
  if (tip === "secim" && secenekler.length === 0) {
    return { error: "Seçim listesi için en az bir seçenek girin." as const };
  }

  return { data: { varlik: varlik as OzelAlanVarligi, ad, tip, secenekler, zorunlu } };
}

export async function alanOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.ozelAlanYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  const mevcutSayi = await db.ozelAlan.count({ where: { varlik: parsed.data.varlik } });
  if (mevcutSayi >= VARLIK_BASINA_LIMIT) {
    return { error: `Bir varlıkta en fazla ${VARLIK_BASINA_LIMIT} özel alan tanımlanabilir.` };
  }

  const ayniAd = await db.ozelAlan.findFirst({
    where: { varlik: parsed.data.varlik, ad: parsed.data.ad },
  });
  if (ayniAd) return { error: "Bu adla bir alan zaten var." };

  const sonSira = await db.ozelAlan.findFirst({
    where: { varlik: parsed.data.varlik },
    orderBy: { sira: "desc" },
  });

  const alan = await tenantOlustur(db, "ozelAlan", {
    ...parsed.data,
    sira: (sonSira?.sira ?? 0) + 1,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "OzelAlan",
    varlikId: alan.id,
    ozet: `${parsed.data.varlik}: ${parsed.data.ad}`,
    yeni: parsed.data,
  });

  revalidatePath("/ozel-alanlar");
  return { ok: true };
}

export async function alanGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.ozelAlanYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "ozelAlan", id);

  const ayniAd = await db.ozelAlan.findFirst({
    where: { varlik: parsed.data.varlik, ad: parsed.data.ad, NOT: { id } },
  });
  if (ayniAd) return { error: "Bu adla bir alan zaten var." };

  // Varlık değiştirilemez: mevcut değerler o varlığın kayıtlarına bağlı.
  const { varlik: _yeniVarlik, ...guncelleme } = parsed.data;
  await tenantGuncelle(db, "ozelAlan", id, guncelleme);

  await denetimYaz({
    islem: "guncelle",
    varlik: "OzelAlan",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: guncelleme,
  });

  revalidatePath("/ozel-alanlar");
  return { ok: true };
}

export async function alanSil(id: string): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.ozelAlanYonet))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "ozelAlan", id);
  // Değerler veritabanı düzeyinde cascade ile silinir; arayüz sayıyı
  // göstererek onay ister.
  await tenantSil(db, "ozelAlan", id);

  await denetimYaz({
    islem: "sil",
    varlik: "OzelAlan",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidatePath("/ozel-alanlar");
  return { ok: true };
}

/** Alanı kendi varlığı içinde bir üst/alt sıraya taşır. */
export async function alanTasi(id: string, yon: "yukari" | "asagi"): Promise<void> {
  if (!(await yetkiVarMi(IZIN.ozelAlanYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const alan = await db.ozelAlan.findFirst({ where: { id } });
  if (!alan) return;

  const komsu = await db.ozelAlan.findFirst({
    where: {
      varlik: alan.varlik,
      sira: yon === "yukari" ? { lt: alan.sira } : { gt: alan.sira },
    },
    orderBy: { sira: yon === "yukari" ? "desc" : "asc" },
  });
  if (!komsu) return;

  await tenantGuncelle(db, "ozelAlan", alan.id, { sira: komsu.sira });
  await tenantGuncelle(db, "ozelAlan", komsu.id, { sira: alan.sira });

  revalidatePath("/ozel-alanlar");
}
