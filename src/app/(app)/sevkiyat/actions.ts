"use server";

import { revalidatePath } from "next/cache";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  kayitOku,
  sahiplikDogrula,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { SEVKIYAT_DURUM } from "@/lib/constants";
import { siparisIstemcisi, siradakiBelgeNo, sevkiyatAcilabilirMi } from "@/lib/siparis";

/**
 * Sevkiyat işlemleri — Faz 15 / S4.
 *
 * AKIŞIN SÖZÜ BURADA UYGULANIR: sevkiyat yalnızca ONAYLANMIŞ siparişten
 * açılır. Kural izinle değil VERİYLE korunur — depo yetkisi olan bir
 * kullanıcı bile onaysız siparişe sevkiyat açamaz.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(siparisId?: string) {
  revalidatePath("/sevkiyat");
  revalidatePath("/siparisler");
  if (siparisId) revalidatePath(`/siparisler/${siparisId}`);
}

export async function sevkiyatOlustur(
  siparisId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.sevkiyatYonet))) return { error: YETKISIZ };

  const { db, tenantId } = await getTenantContext();
  await sahiplikDogrula(db, "siparis", siparisId);

  const siparis = (await kayitOku(db, "siparis", siparisId)) as {
    durum: string;
    no: string;
  } | null;
  if (!siparis) return { error: "Sipariş bulunamadı." };

  /**
   * TEK KAPI. Arayüzde düğmeyi gizlemek koruma değildir: kullanıcı bu
   * action'ı doğrudan çağırabilir, bu yüzden kontrol burada.
   */
  const kapi = sevkiyatAcilabilirMi(siparis.durum);
  if (!kapi.ok) return { error: kapi.hata };

  const no = await siradakiBelgeNo(siparisIstemcisi(db), tenantId, "sevkiyat");

  const sevkiyat = await tenantOlustur(db, "sevkiyat", {
    siparisId,
    no,
    durum: "hazirlaniyor",
    tasiyici: String(formData.get("tasiyici") ?? "").trim() || null,
    takipNo: String(formData.get("takipNo") ?? "").trim() || null,
    adres: String(formData.get("adres") ?? "").trim() || null,
    notlar: String(formData.get("notlar") ?? "").trim() || null,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Sevkiyat",
    varlikId: sevkiyat.id,
    ozet: `${no} — ${siparis.no}`,
    yeni: { siparisNo: siparis.no, no },
  });

  revalidate(siparisId);
  return { ok: true };
}

export async function sevkiyatDurumGuncelle(
  id: string,
  durum: string
): Promise<void> {
  if (!(await yetkiVarMi(IZIN.sevkiyatYonet))) throw new Error(YETKISIZ);
  if (!(SEVKIYAT_DURUM as readonly string[]).includes(durum)) {
    throw new Error("Geçersiz sevkiyat durumu.");
  }

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "sevkiyat", id)) as {
    no: string;
    durum: string;
    siparisId: string;
  } | null;
  if (!oncesi) throw new Error("Sevkiyat bulunamadı.");

  /**
   * Tarihler duruma göre KENDİLİĞİNDEN damgalanır: kullanıcıya "sevk
   * tarihini de yaz" dedirtmek, bir gün unutulacak bir adımdır ve rapordaki
   * bekleme süresi hesabını bozar.
   */
  const veri: Record<string, unknown> = { durum };
  if (durum === "sevkedildi" && !("sevkTarihi" in oncesi && oncesi.sevkTarihi)) {
    veri.sevkTarihi = new Date();
  }
  if (durum === "teslim") {
    veri.teslimTarihi = new Date();
  }

  await tenantGuncelle(db, "sevkiyat", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Sevkiyat",
    varlikId: id,
    ozet: `${oncesi.no}: ${oncesi.durum} → ${durum}`,
    eski: { durum: oncesi.durum },
    yeni: { durum },
  });

  revalidate(oncesi.siparisId);
}

export async function sevkiyatBilgiGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.sevkiyatYonet))) return { error: YETKISIZ };

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "sevkiyat", id)) as {
    no: string;
    siparisId: string;
  } | null;
  if (!oncesi) return { error: "Sevkiyat bulunamadı." };

  const veri = {
    tasiyici: String(formData.get("tasiyici") ?? "").trim() || null,
    takipNo: String(formData.get("takipNo") ?? "").trim() || null,
    adres: String(formData.get("adres") ?? "").trim() || null,
    notlar: String(formData.get("notlar") ?? "").trim() || null,
  };

  await tenantGuncelle(db, "sevkiyat", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Sevkiyat",
    varlikId: id,
    ozet: `${oncesi.no} bilgileri güncellendi`,
    eski: oncesi,
    yeni: veri,
  });

  revalidate(oncesi.siparisId);
  return { ok: true };
}
