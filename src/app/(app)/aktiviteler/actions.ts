"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  getTenantContext,
  firmaSahipligiDogrula,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { AKTIVITE_TUR_DEGERLERI } from "@/lib/constants";
import { bildirimGonder } from "@/lib/bildirim";

/**
 * Aktivite ve görev işlemleri — Faz 7 / C4.
 *
 * Tek model, iki kullanım: `sonTarih` boşsa "olan biteni kaydeden" bir not
 * (arama, toplantı, e-posta), doluysa "yapılacak iş". Bu ayrımı ayrı tablo
 * yerine tek alanla yapmak, firma timeline'ının (C6) tek sorguyla
 * kurulmasını sağlar.
 */

const schema = z.object({
  tur: z.enum(AKTIVITE_TUR_DEGERLERI as [string, ...string[]]).default("not"),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  aciklama: z.string().trim().optional(),
  firmaId: z.string().trim().optional(),
  kisiId: z.string().trim().optional(),
  firsatId: z.string().trim().optional(),
  atananId: z.string().trim().optional(),
  sonTarih: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(firmaId?: string | null) {
  revalidatePath("/aktiviteler");
  revalidatePath("/");
  if (firmaId) revalidatePath(`/firmalar/${firmaId}`);
}

/**
 * Bağlam kayıtlarının hepsi bu kiracıya ait mi?
 *
 * Kişi ve fırsat ayrıca SEÇİLEN FİRMAYA bağlı olmalıdır; aksi halde bir
 * aktivite, A firmasının altında B firmasının fırsatını gösterebilirdi.
 */
async function bagliKayitlariDogrula(
  db: TenantClient,
  v: { firmaId?: string; kisiId?: string; firsatId?: string; atananId?: string }
) {
  if (v.firmaId) await firmaSahipligiDogrula(db, v.firmaId);

  if (v.kisiId) {
    const kisi = await db.kisi.findFirst({
      where: { id: v.kisiId, ...(v.firmaId ? { firmaId: v.firmaId } : {}) },
      select: { id: true },
    });
    if (!kisi) notFound();
  }

  if (v.firsatId) {
    const firsat = await db.firsat.findFirst({
      where: { id: v.firsatId, ...(v.firmaId ? { firmaId: v.firmaId } : {}) },
      select: { id: true },
    });
    if (!firsat) notFound();
  }

  if (v.atananId) {
    const kullanici = await db.user.findFirst({
      where: { id: v.atananId },
      select: { id: true },
    });
    if (!kullanici) notFound();
  }
}

function veriHazirla(d: z.infer<typeof schema>) {
  return {
    tur: d.tur,
    baslik: d.baslik,
    aciklama: d.aciklama || null,
    firmaId: d.firmaId || null,
    kisiId: d.kisiId || null,
    firsatId: d.firsatId || null,
    atananId: d.atananId || null,
    sonTarih: d.sonTarih ? new Date(d.sonTarih) : null,
  };
}

export async function aktiviteOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.aktiviteOlustur))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const veri = veriHazirla(parsed.data);
  const kayit = await tenantOlustur(db, "aktivite", {
    ...veri,
    // Kimin girdiği e-posta olarak da saklanır; kullanıcı silinse bile
    // aktivitenin sahibi belirsizleşmesin.
    olusturanId: session.userId,
    olusturanEmail: session.email,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Aktivite",
    varlikId: kayit.id,
    ozet: veri.baslik,
    yeni: veri,
  });

  // Görev BAŞKASINA atandıysa haber ver (Faz 8 / D1). Kendine atadığın işi
  // sana bildirmek gürültüden başka bir şey olmaz.
  if (veri.atananId && veri.atananId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: veri.atananId,
      tur: "gorev.atandi",
      baslik: `Size bir görev atandı: ${veri.baslik}`,
      mesaj: veri.sonTarih
        ? `Son tarih: ${veri.sonTarih.toLocaleDateString("tr-TR")}`
        : undefined,
      link: "/aktiviteler",
    });
  }

  revalidate(veri.firmaId);
  return { ok: true };
}

export async function aktiviteGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.aktiviteDuzenle))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  await bagliKayitlariDogrula(db, parsed.data);

  const veri = veriHazirla(parsed.data);
  const oncesi = await kayitOku(db, "aktivite", id);
  await tenantGuncelle(db, "aktivite", id, veri);

  // Atama DEĞİŞTİYSE yeni sorumluya haber ver.
  if (veri.atananId && veri.atananId !== oncesi?.atananId && veri.atananId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: veri.atananId,
      tur: "gorev.atandi",
      baslik: `Size bir görev atandı: ${veri.baslik}`,
      link: "/aktiviteler",
    });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Aktivite",
    varlikId: id,
    ozet: veri.baslik,
    eski: oncesi,
    yeni: veri,
  });

  revalidate(veri.firmaId);
  return { ok: true };
}

/** Görevi tamamlandı / tamamlanmadı olarak işaretler. */
export async function aktiviteTamamla(id: string, tamam: boolean): Promise<void> {
  if (!(await yetkiVarMi(IZIN.aktiviteDuzenle))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "aktivite", id);
  if (!oncesi) notFound();

  const tamamlandi = tamam ? new Date() : null;
  await tenantGuncelle(db, "aktivite", id, { tamamlandi });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Aktivite",
    varlikId: id,
    ozet: `${oncesi.baslik as string} → ${tamam ? "tamamlandı" : "yeniden açıldı"}`,
    eski: { tamamlandi: oncesi.tamamlandi },
    yeni: { tamamlandi },
  });

  revalidate(oncesi.firmaId as string | null);
}

export async function aktiviteSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.aktiviteSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "aktivite", id);
  await tenantSil(db, "aktivite", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Aktivite",
    varlikId: id,
    ozet: (oncesi?.baslik as string) ?? undefined,
    eski: oncesi,
  });

  revalidate(oncesi?.firmaId as string | null);
}
