"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  sahiplikDogrula,
  firmaSahipligiDogrula,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { bildirimGonder } from "@/lib/bildirim";
import { DESTEK_KANAL, DESTEK_ONCELIK, DESTEK_DURUM } from "@/lib/constants";
import { durumDamgalari, durumGecerliMi } from "@/lib/destek-tanimlar";
import { siparisIstemcisi, siradakiBelgeNo } from "@/lib/siparis";

/**
 * Destek / başvuru kaydı işlemleri — Faz 16 / P2.
 *
 * YAPILAN İŞLEMLER ayrı bir tablo değil, AKTİVİTE kayıtlarıdır
 * (`Aktivite.destekId`). Böylece bir destek işlemi firma zaman akışında da
 * görünür ve timeline tek sorguyla kurulmaya devam eder — karar v1.16.0.
 */

const KANALLAR = DESTEK_KANAL.map((k) => k.deger) as [string, ...string[]];
const ONCELIKLER = DESTEK_ONCELIK.map((o) => o.deger) as [string, ...string[]];

const schema = z.object({
  firmaId: z.string().min(1, "Firma zorunludur."),
  kisiId: z.string().trim().optional(),
  projeId: z.string().trim().optional(),
  baslik: z.string().trim().min(1, "Başlık zorunludur."),
  aciklama: z.string().trim().optional(),
  kanal: z.enum(KANALLAR),
  oncelik: z.enum(ONCELIKLER),
  durum: z.enum(DESTEK_DURUM).default("acik"),
  atananId: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate(id?: string) {
  revalidatePath("/destek");
  revalidatePath("/destek/rapor");
  if (id) revalidatePath(`/destek/${id}`);
}

export async function destekOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.destekOlustur))) return { error: YETKISIZ };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db, tenantId, session } = await getTenantContext();
  await firmaSahipligiDogrula(db, parsed.data.firmaId);
  if (parsed.data.kisiId) await sahiplikDogrula(db, "kisi", parsed.data.kisiId);
  if (parsed.data.projeId) await sahiplikDogrula(db, "proje", parsed.data.projeId);

  // Numara sipariş/sevkiyattaki aynı atomik sayaçtan gelir (DST-2026-0001).
  const no = await siradakiBelgeNo(siparisIstemcisi(db), tenantId, "destek");

  const veri = {
    no,
    firmaId: parsed.data.firmaId,
    kisiId: parsed.data.kisiId || null,
    projeId: parsed.data.projeId || null,
    baslik: parsed.data.baslik,
    aciklama: parsed.data.aciklama || null,
    kanal: parsed.data.kanal,
    oncelik: parsed.data.oncelik,
    durum: parsed.data.durum,
    atananId: parsed.data.atananId || null,
    acanId: session.userId,
  };

  const kayit = await tenantOlustur(db, "destekKaydi", veri);

  // Atanan kişiye bildirim — kendine atayan kişiye gönderilmez.
  if (veri.atananId && veri.atananId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: veri.atananId,
      tur: "destek.atandi",
      baslik: `Size bir destek kaydı atandı: ${no}`,
      mesaj: veri.baslik,
      link: `/destek/${kayit.id}`,
    });
  }

  await denetimYaz({
    islem: "olustur",
    varlik: "DestekKaydi",
    varlikId: kayit.id,
    ozet: `${no} — ${veri.baslik}`,
    yeni: veri,
  });

  revalidate();
  redirect(`/destek/${kayit.id}`);
}

export async function destekGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.destekDuzenle))) return { error: YETKISIZ };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db, session } = await getTenantContext();
  await firmaSahipligiDogrula(db, parsed.data.firmaId);

  const oncesi = (await kayitOku(db, "destekKaydi", id)) as {
    no: string;
    durum: string;
    atananId: string | null;
    cozumTarihi: Date | null;
    kapanisTarihi: Date | null;
  } | null;
  if (!oncesi) return { error: "Destek kaydı bulunamadı." };

  // Durum değiştiyse çözüm/kapanış damgaları KENDİLİĞİNDEN atılır.
  const damga = durumDamgalari(parsed.data.durum, oncesi);

  const veri = {
    firmaId: parsed.data.firmaId,
    kisiId: parsed.data.kisiId || null,
    projeId: parsed.data.projeId || null,
    baslik: parsed.data.baslik,
    aciklama: parsed.data.aciklama || null,
    kanal: parsed.data.kanal,
    oncelik: parsed.data.oncelik,
    durum: parsed.data.durum,
    atananId: parsed.data.atananId || null,
    ...damga,
  };

  await tenantGuncelle(db, "destekKaydi", id, veri);

  // Atama DEĞİŞTİYSE yeni kişiye haber verilir.
  if (veri.atananId && veri.atananId !== oncesi.atananId && veri.atananId !== session.userId) {
    await bildirimGonder(db, {
      kullaniciId: veri.atananId,
      tur: "destek.atandi",
      baslik: `Size bir destek kaydı atandı: ${oncesi.no}`,
      mesaj: parsed.data.baslik,
      link: `/destek/${id}`,
    });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "DestekKaydi",
    varlikId: id,
    ozet: `${oncesi.no} — ${parsed.data.baslik}`,
    eski: oncesi,
    yeni: veri,
  });

  revalidate(id);
  return { ok: true };
}

/** Durumu tek tıkla ilerletir (liste ve detay ekranından). */
export async function destekDurumDegistir(id: string, durum: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.destekDuzenle))) throw new Error(YETKISIZ);
  if (!durumGecerliMi(durum)) throw new Error("Geçersiz durum.");

  const { db } = await getTenantContext();
  const oncesi = (await kayitOku(db, "destekKaydi", id)) as {
    no: string;
    durum: string;
    cozumTarihi: Date | null;
    kapanisTarihi: Date | null;
  } | null;
  if (!oncesi) throw new Error("Destek kaydı bulunamadı.");

  await tenantGuncelle(db, "destekKaydi", id, {
    durum,
    ...durumDamgalari(durum, oncesi),
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "DestekKaydi",
    varlikId: id,
    ozet: `${oncesi.no}: ${oncesi.durum} → ${durum}`,
    eski: { durum: oncesi.durum },
    yeni: { durum },
  });

  revalidate(id);
}

/**
 * Destek kaydına işlem ekler (P2 — "yapılan işlemler").
 *
 * İşlem bir AKTİVİTE kaydıdır: hem destek kaydının geçmişinde hem firma
 * zaman akışında görünür. Ayrı bir tablo açmak, timeline'ı ikinci bir
 * sorguyla büyütürdü (karar: v1.16.0).
 */
export async function destekIslemEkle(
  destekId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.destekDuzenle))) return { error: YETKISIZ };

  const baslik = String(formData.get("baslik") ?? "").trim();
  if (!baslik) return { error: "İşlem açıklaması zorunludur." };

  const { db, session } = await getTenantContext();
  const destek = (await kayitOku(db, "destekKaydi", destekId)) as {
    no: string;
    firmaId: string;
    kisiId: string | null;
  } | null;
  if (!destek) return { error: "Destek kaydı bulunamadı." };

  const kayit = await tenantOlustur(db, "aktivite", {
    tur: String(formData.get("tur") ?? "not"),
    baslik,
    aciklama: String(formData.get("aciklama") ?? "").trim() || null,
    destekId,
    // Firma bağı da yazılır: zaman akışı firma üzerinden kurulur.
    firmaId: destek.firmaId,
    kisiId: destek.kisiId,
    olusturanId: session.userId,
    olusturanEmail: session.email,
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Aktivite",
    varlikId: kayit.id,
    ozet: `${destek.no} işlem: ${baslik}`,
    yeni: { destekId, baslik },
  });

  revalidate(destekId);
  return { ok: true };
}

export async function destekSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.destekSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "destekKaydi", id);
  // İşlem aktiviteleri cascade ile gider (FK: onDelete Cascade).
  await tenantSil(db, "destekKaydi", id);

  await denetimYaz({
    islem: "sil",
    varlik: "DestekKaydi",
    varlikId: id,
    ozet: (oncesi?.no as string) ?? undefined,
    eski: oncesi,
  });

  revalidate();
  redirect("/destek");
}
