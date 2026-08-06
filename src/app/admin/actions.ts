"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformDb, platformOturumu, impersonatorOku } from "@/lib/platform-db";
import { createSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { ROL } from "@/lib/yetki-tanimlar";
import { davetTokenUret } from "@/lib/davet";

export type FormState = { error?: string; ok?: boolean; bilgi?: string };

/**
 * Admin panel işlemleri (Faz 5).
 *
 * Hepsi `getPlatformDb()` üzerinden geçer; o da her çağrıda oturumun
 * `platform_admin` olduğunu doğrular. Yani bu dosyadaki hiçbir action
 * yetkisiz bir kullanıcı tarafından çalıştırılamaz.
 */

const slugSemasi = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Kiracı kodu en az 2 karakter olmalı.")
  .regex(/^[a-z0-9-]+$/, "Kiracı kodu yalnızca küçük harf, rakam ve tire içerebilir.");

const kiraciSemasi = z.object({
  ad: z.string().trim().min(1, "Kuruluş adı zorunludur."),
  slug: slugSemasi,
  durum: z.enum(["aktif", "askida", "pasif"]).default("aktif"),
  iletisimAd: z.string().trim().optional(),
  iletisimEmail: z.string().trim().optional(),
  iletisimTel: z.string().trim().optional(),
  notlar: z.string().trim().optional(),
  planId: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  anaRenk: z.string().trim().optional(),
  altAlan: z.string().trim().optional(),
});

// ── B1: Kiracı yönetimi ────────────────────────────────────────────────────

export async function kiraciOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const db = await getPlatformDb();
  const parsed = kiraciSemasi.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const mevcut = await db.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (mevcut) return { error: "Bu kiracı kodu zaten kullanılıyor." };

  const { planId, altAlan, ...kalan } = parsed.data;
  const kiraci = await db.tenant.create({
    data: {
      ...kalan,
      planId: planId || null,
      altAlan: altAlan || null,
    },
  });

  revalidatePath("/admin/kiracilar");
  redirect(`/admin/kiracilar/${kiraci.id}`);
}

export async function kiraciGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const db = await getPlatformDb();
  const parsed = kiraciSemasi.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const cakisma = await db.tenant.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (cakisma) return { error: "Bu kiracı kodu başka bir kuruluşta kullanılıyor." };

  const { planId, altAlan, ...kalan } = parsed.data;
  await db.tenant.update({
    where: { id },
    data: { ...kalan, planId: planId || null, altAlan: altAlan || null },
  });

  revalidatePath("/admin/kiracilar");
  revalidatePath(`/admin/kiracilar/${id}`);
  return { ok: true, bilgi: "Kaydedildi." };
}

/** Askıya alma / yeniden açma. Veriye dokunmaz, yalnızca erişimi keser. */
export async function kiraciDurumDegistir(id: string, durum: string): Promise<void> {
  const db = await getPlatformDb();
  await db.tenant.update({ where: { id }, data: { durum } });
  revalidatePath("/admin/kiracilar");
  revalidatePath(`/admin/kiracilar/${id}`);
}

/**
 * Kiracıyı ve TÜM verisini siler (cascade).
 *
 * Geri dönüşü yoktur; arayüzde kuruluş adının yazılması istenir.
 */
export async function kiraciSil(id: string, onayAdi: string): Promise<void> {
  const db = await getPlatformDb();
  const kiraci = await db.tenant.findUnique({ where: { id } });
  if (!kiraci) throw new Error("Kuruluş bulunamadı.");
  if (onayAdi.trim() !== kiraci.ad) {
    throw new Error("Onay için kuruluş adını birebir yazmalısınız.");
  }
  await db.tenant.delete({ where: { id } });
  revalidatePath("/admin/kiracilar");
  redirect("/admin/kiracilar");
}

// ── B4: Paket yönetimi ─────────────────────────────────────────────────────

const planSemasi = z.object({
  ad: z.string().trim().min(1, "Paket adı zorunludur."),
  aciklama: z.string().trim().optional(),
  kullaniciLimiti: z.coerce.number().int().min(0).default(0),
  firmaLimiti: z.coerce.number().int().min(0).default(0),
});

export async function planKaydet(
  id: string | null,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const db = await getPlatformDb();
  const parsed = planSemasi.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const moduller = formData.getAll("moduller").map(String);

  if (id) {
    await db.plan.update({ where: { id }, data: { ...parsed.data, moduller } });
  } else {
    const mevcut = await db.plan.findUnique({ where: { ad: parsed.data.ad } });
    if (mevcut) return { error: "Bu adda bir paket zaten var." };
    await db.plan.create({ data: { ...parsed.data, moduller } });
  }

  revalidatePath("/admin/paketler");
  return { ok: true };
}

export async function planSil(id: string): Promise<void> {
  const db = await getPlatformDb();
  // Kiracıların planId'si SetNull ile boşalır; kimse erişimsiz kalmaz.
  await db.plan.delete({ where: { id } });
  revalidatePath("/admin/paketler");
}

// ── B2: Kullanıcı yönetimi ─────────────────────────────────────────────────

const kullaniciSemasi = z.object({
  ad: z.string().trim().min(1, "Ad zorunludur."),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  rol: z.enum([ROL.platformAdmin, ROL.tenantAdmin, ROL.uye, ROL.saltOkunur]),
});

export async function kullaniciRolDegistir(
  userId: string,
  rol: string
): Promise<void> {
  const db = await getPlatformDb();
  await db.user.update({ where: { id: userId }, data: { role: rol } });
  revalidatePath("/admin/kiracilar");
}

export async function kullaniciDurumDegistir(
  userId: string,
  durum: string
): Promise<void> {
  const db = await getPlatformDb();
  const kullanici = await db.user.update({ where: { id: userId }, data: { durum } });
  revalidatePath(`/admin/kiracilar/${kullanici.tenantId}`);
}

export async function kullaniciSifreSifirla(
  userId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const db = await getPlatformDb();
  const sifre = String(formData.get("sifre") ?? "");
  if (sifre.length < 8) return { error: "Şifre en az 8 karakter olmalı." };

  const hash = await bcrypt.hash(sifre, 10);
  const kullanici = await db.user.update({
    where: { id: userId },
    data: { password: hash },
  });

  revalidatePath(`/admin/kiracilar/${kullanici.tenantId}`);
  return { ok: true, bilgi: "Şifre güncellendi." };
}

// ── B3: Davet akışı ────────────────────────────────────────────────────────

export async function davetOlustur(
  tenantId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await platformOturumu();
  const db = await getPlatformDb();

  const parsed = kullaniciSemasi.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const mevcut = await db.user.findFirst({
    where: { tenantId, email: parsed.data.email },
  });
  if (mevcut) return { error: "Bu e-posta bu kuruluşta zaten kayıtlı." };

  // Paket limiti kontrolü
  const kiraci = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true, _count: { select: { kullanicilar: true } } },
  });
  const limit = kiraci?.plan?.kullaniciLimiti ?? 0;
  if (limit > 0 && (kiraci?._count.kullanicilar ?? 0) >= limit) {
    return {
      error: `Paket sınırına ulaşıldı (${limit} kullanıcı). Paketi yükseltin.`,
    };
  }

  const { token, ozet } = davetTokenUret();
  const sonKullanma = new Date();
  sonKullanma.setDate(sonKullanma.getDate() + 7);

  await db.davet.create({
    data: {
      tenantId,
      email: parsed.data.email,
      ad: parsed.data.ad,
      rol: parsed.data.rol,
      tokenOzeti: ozet,
      sonKullanma,
      olusturanEmail: session.email,
    },
  });

  revalidatePath(`/admin/kiracilar/${tenantId}`);

  // E-posta gönderimi Faz 8'de (D1). Şimdilik bağlantı ekranda gösterilir.
  return { ok: true, bilgi: `/davet/${token}` };
}

export async function davetIptal(id: string, tenantId: string): Promise<void> {
  const db = await getPlatformDb();
  await db.davet.delete({ where: { id } });
  revalidatePath(`/admin/kiracilar/${tenantId}`);
}

// ── B5: Impersonation ──────────────────────────────────────────────────────

/**
 * "Kiracı olarak görüntüle".
 *
 * Platform yöneticisinin oturumu, hedef kiracının bağlamıyla değiştirilir.
 * Gerçek kimlik `impersonator*` alanlarında saklanır; arayüzde kalıcı uyarı
 * bandı çıkar ve yapılan her işlem denetim günlüğüne gerçek kimlikle yazılır.
 *
 * Rol bilinçli olarak `tenant_admin`'e düşürülür: destek için kuruluşun
 * gördüğünü görmek yeterlidir, platform yetkilerini taşımaya gerek yoktur.
 */
export async function kiraciOlarakGoruntule(tenantId: string): Promise<void> {
  const session = await platformOturumu();
  const db = await getPlatformDb();

  const kiraci = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!kiraci) throw new Error("Kuruluş bulunamadı.");

  await db.denetimKaydi.create({
    data: {
      tenantId: kiraci.id,
      kullaniciId: session.userId,
      kullaniciEmail: session.email,
      islem: "guncelle",
      varlik: "User",
      varlikId: session.userId,
      ozet: `Platform yöneticisi "${kiraci.ad}" kuruluşunu görüntülemeye başladı`,
    },
  });

  await createSession({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: ROL.tenantAdmin,
    tenantId: kiraci.id,
    tenantSlug: kiraci.slug,
    tenantAd: kiraci.ad,
    impersonatorId: session.userId,
    impersonatorEmail: session.email,
  });

  redirect("/");
}

/** Impersonation'dan çıkış — platform yöneticisi kendi bağlamına döner. */
export async function impersonationBitir(): Promise<void> {
  const session = await requireSession();
  if (!session.impersonatorId) redirect("/");

  // Gerçek yönetici okuması `platform-db.ts` içindedir; oradaki yorumda
  // bu istisnanın neden güvenli olduğu açıklanır.
  const kullanici = await impersonatorOku(session.impersonatorId);
  if (!kullanici) redirect("/login");

  await createSession({
    userId: kullanici.id,
    email: kullanici.email,
    name: kullanici.name,
    role: kullanici.role,
    tenantId: kullanici.tenantId,
    tenantSlug: kullanici.tenant.slug,
    tenantAd: kullanici.tenant.ad,
  });

  redirect("/admin/kiracilar");
}
