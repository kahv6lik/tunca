"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  sahiplikDogrula,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { LEAD_DURUM } from "@/lib/constants";
import { firmaLimitiAsildiMi } from "@/lib/kiraci-ayar";
import { bildirimGonder } from "@/lib/bildirim";
import { sayacIstemcisi, siradakiFirmaNo } from "@/lib/firma-no-saf";

/**
 * Aday (Lead) işlemleri — Faz 7 / C5.
 *
 * Lead, henüz firma OLMAYAN bir ilgidir. Niteliği doğrulanınca tek işlemle
 * firma + kişi (+ isteğe bağlı fırsat) hâline gelir. Dönüşen lead SİLİNMEZ;
 * nereye dönüştüğü kaydında saklanır, çünkü "hangi kanal ne kadar iş
 * getirdi" sorusu bu bağa dayanır.
 */

const schema = z.object({
  ad: z.string().trim().min(1, "Ad zorunludur."),
  firmaAd: z.string().trim().optional(),
  unvan: z.string().trim().optional(),
  email: z.string().trim().optional(),
  telefon: z.string().trim().optional(),
  il: z.string().trim().optional(),
  sektor: z.string().trim().optional(),
  kaynak: z.string().trim().optional(),
  durum: z.enum(LEAD_DURUM).default("yeni"),
  notlar: z.string().trim().optional(),
  atananId: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/adaylar");
  revalidatePath("/");
}

function veriHazirla(d: z.infer<typeof schema>) {
  return {
    ad: d.ad,
    firmaAd: d.firmaAd || null,
    unvan: d.unvan || null,
    email: d.email || null,
    telefon: d.telefon || null,
    il: d.il || null,
    sektor: d.sektor || null,
    kaynak: d.kaynak || null,
    durum: d.durum,
    notlar: d.notlar || null,
    atananId: d.atananId || null,
  };
}

export async function leadOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.leadOlustur))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const veri = veriHazirla(parsed.data);
  const kayit = await tenantOlustur(db, "lead", veri);

  if (veri.atananId && veri.atananId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: veri.atananId,
      tur: "lead.atandi",
      baslik: `Size bir aday atandı: ${veri.ad}`,
      mesaj: veri.firmaAd ?? undefined,
      link: "/adaylar",
    });
  }

  await denetimYaz({
    islem: "olustur",
    varlik: "Lead",
    varlikId: kayit.id,
    ozet: veri.ad,
    yeni: veri,
  });

  revalidate();
  return { ok: true };
}

export async function leadGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.leadDuzenle))) return { error: YETKISIZ };

  const { db } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const veri = veriHazirla(parsed.data);
  const oncesi = await kayitOku(db, "lead", id);

  // Dönüşmüş bir adayın durumu elle geri alınamaz: dönüşüm izleri (firma,
  // kişi, fırsat) yerinde dururken durumu "yeni"ye çevirmek kaydı yalan
  // söyler hâle getirirdi.
  if (oncesi?.donusenFirmaId && veri.durum !== "donusturuldu") {
    return { error: "Dönüştürülmüş bir aday başka bir duruma alınamaz." };
  }

  await tenantGuncelle(db, "lead", id, veri);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Lead",
    varlikId: id,
    ozet: veri.ad,
    eski: oncesi,
    yeni: veri,
  });

  revalidate();
  return { ok: true };
}

export async function leadSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.leadSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "lead", id);
  await tenantSil(db, "lead", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Lead",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidate();
}

/**
 * Adayı firmaya dönüştürür (C5).
 *
 * Tek işlemde üç kayıt açılabilir: firma, kişi ve (istenirse) fırsat. Üçü de
 * kiracı katmanından geçer, yani `tenantId` kendiliğinden damgalanır.
 *
 * Paket firma limiti burada da uygulanır — dönüştürme, limitin arka kapısı
 * olmamalıdır.
 */
export async function leadDonustur(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.leadDonustur))) return { error: YETKISIZ };

  const { db, tenantId } = await getTenantContext();
  const lead = await kayitOku(db, "lead", id);
  if (!lead) notFound();
  if (lead.donusenFirmaId) {
    return { error: "Bu aday zaten dönüştürülmüş." };
  }

  const firmaAd = String(formData.get("firmaAd") ?? "").trim();
  if (!firmaAd) return { error: "Firma adı zorunludur." };

  const limitHatasi = await firmaLimitiAsildiMi();
  if (limitHatasi) return { error: limitHatasi };

  const firsatAc = String(formData.get("firsatAc") ?? "") === "1";
  const asamaId = String(formData.get("asamaId") ?? "").trim();
  const firsatBaslik = String(formData.get("firsatBaslik") ?? "").trim();
  const tutar = Number(formData.get("tutar") ?? 0) || 0;

  if (firsatAc) {
    if (!asamaId) return { error: "Fırsat için aşama seçin." };
    await sahiplikDogrula(db, "asama", asamaId);
    if (!firsatBaslik) return { error: "Fırsat başlığı zorunludur." };
  }

  // 1) Firma — dönüşen aday da sıradaki firma numarasını alır (Faz 13 / H1).
  const firma = await tenantOlustur(db, "firma", {
    ad: firmaAd,
    firmaNo: await siradakiFirmaNo(sayacIstemcisi(db), tenantId),
    il: lead.il ?? null,
    sektor: lead.sektor ?? null,
    telefon: lead.telefon ?? null,
    email: lead.email ?? null,
    durum: "aktif",
    notlar: lead.notlar ? `Aday kaydından geldi:\n${lead.notlar}` : null,
  });

  // 2) Kişi — adayın kendisi firmanın birincil muhatabı olur.
  const kisi = await tenantOlustur(db, "kisi", {
    firmaId: firma.id,
    ad: lead.ad as string,
    unvan: (lead.unvan as string) ?? null,
    telefon: (lead.telefon as string) ?? null,
    email: (lead.email as string) ?? null,
    birincil: true,
  });

  // 3) Fırsat (isteğe bağlı)
  let firsatId: string | null = null;
  if (firsatAc) {
    const asama = await db.asama.findFirst({ where: { id: asamaId } });
    const firsat = await tenantOlustur(db, "firsat", {
      firmaId: firma.id,
      kisiId: kisi.id,
      asamaId,
      baslik: firsatBaslik,
      tutar,
      paraBirimi: "TRY",
      olasilik: asama?.olasilik ?? 0,
      durum: "acik",
    });
    firsatId = firsat.id;
  }

  await tenantGuncelle(db, "lead", id, {
    durum: "donusturuldu",
    donusenFirmaId: firma.id,
    donusenKisiId: kisi.id,
    donusenFirsatId: firsatId,
    donusumTarihi: new Date(),
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Lead",
    varlikId: id,
    ozet: `${lead.ad as string} → firma "${firmaAd}" olarak dönüştürüldü`,
    eski: { durum: lead.durum },
    yeni: { durum: "donusturuldu", firmaId: firma.id, kisiId: kisi.id, firsatId },
  });

  // Dönüşen kayıtlar da denetim günlüğünde görünmeli — aksi halde firma
  // "kendiliğinden" belirmiş gibi durur.
  await denetimYaz({
    islem: "olustur",
    varlik: "Firma",
    varlikId: firma.id,
    ozet: `${firmaAd} (aday dönüşümü)`,
    yeni: { ad: firmaAd, kaynak: lead.kaynak },
  });

  revalidate();
  revalidatePath("/firmalar");
  redirect(`/firmalar/${firma.id}`);
}
