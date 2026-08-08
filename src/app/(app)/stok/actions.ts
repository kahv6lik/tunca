"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext, sahiplikDogrula } from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { STOK_HAREKET_TUR, type StokHareketTuru } from "@/lib/constants";
import { stokIstemcisi, stokHareketiIsle, sayimIsle } from "@/lib/stok";

/**
 * Stok hareketleri — Faz 14 / T7.
 *
 * Hareket girmek `stok.hareket` iznine bağlıdır; katalog yönetiminden
 * AYRIDIR: depoda çalışan kişi mal kabul eder ama fiyat değiştirmez.
 *
 * Hareket kaydı DEĞİŞTİRİLEMEZ ve SİLİNEMEZ — bu yüzden bu dosyada güncelle
 * ya da sil action'ı yoktur. Yanlış hareket, ters yönlü bir düzeltmeyle
 * kapatılır; defterin bütünlüğü ancak böyle korunur.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";
const TURLER = STOK_HAREKET_TUR.map((t) => t.deger) as string[];

function revalidate() {
  revalidatePath("/stok");
  revalidatePath("/urunler");
}

export async function hareketEkle(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.stokHareket))) return { error: YETKISIZ };

  const urunId = String(formData.get("urunId") ?? "").trim();
  const tur = String(formData.get("tur") ?? "").trim();
  const miktar = Number(formData.get("miktar") ?? 0);
  const aciklama = String(formData.get("aciklama") ?? "").trim() || null;
  const referans = String(formData.get("referans") ?? "").trim() || null;

  if (!urunId) return { error: "Ürün seçin." };
  if (!TURLER.includes(tur)) return { error: "Geçersiz hareket türü." };
  if (!Number.isFinite(miktar) || miktar === 0) {
    return { error: "Miktar sıfırdan farklı bir sayı olmalıdır." };
  }

  const { db, tenantId, session } = await getTenantContext();
  // Ürün bu kiracıya ait mi? (A3)
  await sahiplikDogrula(db, "urun", urunId);

  const sonuc = await stokHareketiIsle(stokIstemcisi(db), tenantId, {
    urunId,
    tur: tur as StokHareketTuru,
    miktar,
    aciklama,
    referans,
    kullaniciId: session.userId,
  });

  if (!sonuc.ok) return { error: sonuc.hata };

  await denetimYaz({
    islem: "olustur",
    varlik: "StokHareketi",
    varlikId: sonuc.hareketId,
    ozet: `${tur} · ${miktar} → yeni bakiye ${sonuc.yeniBakiye}`,
    yeni: { urunId, tur, miktar, referans, yeniBakiye: sonuc.yeniBakiye },
  });

  revalidate();
  return { ok: true };
}

export async function sayimKaydet(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.stokHareket))) return { error: YETKISIZ };

  const urunId = String(formData.get("urunId") ?? "").trim();
  const sayilan = Number(formData.get("sayilanMiktar") ?? NaN);

  if (!urunId) return { error: "Ürün seçin." };
  if (!Number.isFinite(sayilan) || sayilan < 0) {
    return { error: "Sayılan miktar negatif olamaz." };
  }

  const { db, tenantId, session } = await getTenantContext();
  await sahiplikDogrula(db, "urun", urunId);

  const sonuc = await sayimIsle(
    stokIstemcisi(db),
    tenantId,
    urunId,
    sayilan,
    session.userId
  );

  if (!sonuc.ok) return { error: sonuc.hata };

  await denetimYaz({
    islem: "olustur",
    varlik: "StokHareketi",
    varlikId: sonuc.hareketId,
    ozet: `Sayım · yeni bakiye ${sonuc.yeniBakiye}`,
    yeni: { urunId, sayilan, yeniBakiye: sonuc.yeniBakiye },
  });

  revalidate();
  return { ok: true };
}
