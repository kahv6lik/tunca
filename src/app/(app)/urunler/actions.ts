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
import { URUN_DURUM } from "@/lib/constants";
import { kodNormalize } from "@/lib/urun-tanimlar";

/**
 * Ürün / hizmet kataloğu — Faz 14 / T1.
 *
 * Katalog FİYAT POLİTİKASIDIR: bir ürünün liste fiyatını değiştirmek bütün
 * yeni tekliflerin rakamını değiştirir. Bu yüzden yazma işlemleri
 * `urun.yonet` iznine bağlıdır ve görüntüleme ayrı bir izindir — satış
 * temsilcisi fiyatı GÖRMELİ ama DEĞİŞTİRMEMELİDİR.
 */

const schema = z.object({
  kod: z.string().trim().min(1, "Ürün kodu zorunludur.").max(40),
  ad: z.string().trim().min(1, "Ürün adı zorunludur."),
  aciklama: z.string().trim().optional(),
  kategori: z.string().trim().optional(),
  birim: z.string().trim().default("adet"),
  listeFiyat: z.coerce.number().min(0, "Fiyat negatif olamaz.").default(0),
  paraBirimi: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  kdvOrani: z.coerce.number().min(0).max(100).default(20),
  durum: z.enum(URUN_DURUM).default("aktif"),
  stokTakibi: z.coerce.boolean().default(false),
  kritikStok: z.coerce.number().min(0).default(0),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/urunler");
  revalidatePath("/stok");
}

function ayristir(formData: FormData) {
  const ham = Object.fromEntries(formData.entries());
  // Onay kutusu işaretsizken form'a HİÇ gelmez; zod'un boolean'ı bunu
  // "eksik alan" sayacağı için açıkça false'a çevriliyor.
  const parsed = schema.safeParse({
    ...ham,
    stokTakibi: formData.get("stokTakibi") === "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  return { data: { ...parsed.data, kod: kodNormalize(parsed.data.kod) } };
}

export async function urunOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  // Kod kiracı içinde tekildir; tekil kısıt hatasını kullanıcıya ham
  // göstermek yerine anlaşılır bir mesaja çeviriyoruz.
  const mevcut = await db.urun.findFirst({
    where: { kod: parsed.data.kod },
    select: { id: true },
  });
  if (mevcut) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const kayit = await tenantOlustur(db, "urun", parsed.data);

  await denetimYaz({
    islem: "olustur",
    varlik: "Urun",
    varlikId: kayit.id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function urunGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getTenantDb();
  const cakisan = await db.urun.findFirst({
    where: { kod: parsed.data.kod, id: { not: id } },
    select: { id: true },
  });
  if (cakisan) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const oncesi = await kayitOku(db, "urun", id);

  /**
   * `stokMiktar` BİLİNÇLİ olarak formdan alınmaz. Bakiye, hareket
   * defterinin toplamıdır (T7); buradan elle yazılabilseydi defterle bakiye
   * ayrışır ve hangisinin doğru olduğu bilinemezdi. Düzeltme, "sayım"
   * hareketiyle yapılır.
   */
  await tenantGuncelle(db, "urun", id, parsed.data);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Urun",
    varlikId: id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function urunSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.urunYonet))) throw new Error(YETKISIZ);

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "urun", id);

  /**
   * Pakette kullanılan ürün SİLİNMEZ (`PaketKalemi.urun` → `onDelete: Restrict`).
   * Sessizce paketi bozmak yerine kullanıcıya sebebini söylüyoruz; ürünü
   * dolaşımdan çıkarmanın doğru yolu "pasif" duruma almaktır.
   */
  const paketKullanimi = await db.paketKalemi.count({ where: { urunId: id } });
  if (paketKullanimi > 0) {
    throw new Error(
      `Bu ürün ${paketKullanimi} pakette kullanılıyor. Önce paketlerden çıkarın ` +
        "ya da ürünü pasif duruma alın."
    );
  }

  await tenantSil(db, "urun", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Urun",
    varlikId: id,
    ozet: `${oncesi?.kod ?? ""} — ${oncesi?.ad ?? ""}`,
    eski: oncesi,
  });

  revalidate();
}
