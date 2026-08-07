"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-db";
import { destroySession } from "@/lib/session";
import { denetimYaz } from "@/lib/denetim";
import { sifrele, coz } from "@/lib/sifreleme";
import { verifyPassword } from "@/lib/auth";
import { sifreDogrula } from "@/lib/guvenlik-tanimlar";
import { totpSirUret, totpDogrula, totpUri } from "@/lib/guvenlik-totp";
import { yedekKodSetiUret } from "@/lib/iki-faktor";

/**
 * Kişisel güvenlik ayarları — Faz 12 / F1-F3.
 *
 * KENDİ hesabının ayarlarıdır: kullanıcı yalnızca kendi satırını okur ve
 * yazar (sahiplik `session.userId` ile kurulur), ek bir izin aranmaz.
 * Bu, pano/görünüm tercihleriyle aynı gerekçedir ve regresyon testinde
 * belgeli kişisel-tercih istisnası olarak listelidir. Güvenlik olayları
 * yine de denetim günlüğüne düşer.
 */

export type GuvenlikState = {
  ok?: boolean;
  error?: string;
  bilgi?: string;
  /** 2FA kurulumunda bir kez gösterilen yedek kodlar. */
  yedekKodlar?: string[];
};

// ── F1: Kendi şifresini değiştirme ─────────────────────────────────────────

export async function sifreDegistir(
  _prev: GuvenlikState,
  formData: FormData
): Promise<GuvenlikState> {
  const { db, session } = await getTenantContext();

  const mevcut = String(formData.get("mevcut") ?? "");
  const yeni = String(formData.get("yeni") ?? "");
  const tekrar = String(formData.get("tekrar") ?? "");

  const kullanici = await db.user.findFirst({ where: { id: session.userId } });
  if (!kullanici) return { error: "Hesap bulunamadı." };

  // Mevcut şifre sorulur: oturumu ele geçiren biri şifreyi değiştirip
  // hesabı tamamen devralmamalıdır.
  if (!(await verifyPassword(mevcut, kullanici.password))) {
    return { error: "Mevcut şifreniz hatalı." };
  }
  if (yeni !== tekrar) return { error: "Yeni şifreler birbiriyle uyuşmuyor." };

  const politika = sifreDogrula(yeni, kullanici.email);
  if (!politika.ok) return { error: politika.hata };

  await db.user.updateMany({
    where: { id: session.userId },
    data: { password: await bcrypt.hash(yeni, 10), sifreGuncellendi: new Date() },
  });

  // Bu oturum dışındaki oturumlar kapatılır: şifre değişikliğinin amacı
  // çoğu zaman "başkası girmiş olabilir" şüphesidir.
  await db.oturum.deleteMany({
    where: { userId: session.userId, ...(session.jti ? { NOT: { jti: session.jti } } : {}) },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: "Şifre değiştirildi (diğer oturumlar kapatıldı)",
  });

  revalidatePath("/guvenlik");
  return { ok: true, bilgi: "Şifreniz güncellendi. Diğer oturumlarınız kapatıldı." };
}

// ── F2: İki faktörlü doğrulama ─────────────────────────────────────────────

/**
 * Kurulum başlatır: sır üretilir, ŞİFRELİ olarak saklanır ama 2FA henüz
 * AÇILMAZ. Açma, kullanıcının ilk kodu doğru girmesine bağlıdır — aksi halde
 * uygulamayı kuramamış bir kullanıcı kendi hesabından kilitlenirdi.
 */
export async function ikiFaktorBaslat(): Promise<{ sir: string; uri: string } | null> {
  const { db, session } = await getTenantContext();

  const sir = totpSirUret();
  await db.user.updateMany({
    where: { id: session.userId },
    data: { ikiFaktorSir: sifrele(sir), ikiFaktorAktif: false },
  });

  return { sir, uri: totpUri(sir, session.email, session.tenantAd) };
}

export async function ikiFaktorDogrulaVeAc(
  _prev: GuvenlikState,
  formData: FormData
): Promise<GuvenlikState> {
  const { db, session } = await getTenantContext();
  const kod = String(formData.get("kod") ?? "").trim();

  const kullanici = await db.user.findFirst({ where: { id: session.userId } });
  const sir = coz(kullanici?.ikiFaktorSir);
  if (!sir) return { error: "Kurulum bulunamadı. Yeniden başlatın." };

  if (!totpDogrula(sir, kod)) {
    return { error: "Kod doğrulanamadı. Telefonunuzdaki saatin doğru olduğundan emin olun." };
  }

  const { kodlar, ozetler } = await yedekKodSetiUret();
  await db.user.updateMany({
    where: { id: session.userId },
    data: { ikiFaktorAktif: true, yedekKodlar: ozetler },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: "İki faktörlü doğrulama açıldı",
  });

  revalidatePath("/guvenlik");
  return {
    ok: true,
    yedekKodlar: kodlar,
    bilgi: "İki faktörlü doğrulama açıldı. Yedek kodlarınızı güvenli bir yere kaydedin.",
  };
}

/** Kapatmak için ŞİFRE istenir: ele geçirilen bir oturum 2FA'yı söküp atamaz. */
export async function ikiFaktorKapat(
  _prev: GuvenlikState,
  formData: FormData
): Promise<GuvenlikState> {
  const { db, session } = await getTenantContext();

  const kullanici = await db.user.findFirst({ where: { id: session.userId } });
  if (!kullanici) return { error: "Hesap bulunamadı." };

  if (!(await verifyPassword(String(formData.get("sifre") ?? ""), kullanici.password))) {
    return { error: "Şifreniz hatalı." };
  }

  const kiraci = await db.tenant.findFirst({ where: { id: session.tenantId } });
  if (kiraci?.ikiFaktorZorunlu) {
    return { error: "Kuruluşunuz iki faktörlü doğrulamayı zorunlu kılmış; kapatılamaz." };
  }

  await db.user.updateMany({
    where: { id: session.userId },
    data: { ikiFaktorAktif: false, ikiFaktorSir: null, yedekKodlar: [] },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: "İki faktörlü doğrulama kapatıldı",
  });

  revalidatePath("/guvenlik");
  return { ok: true, bilgi: "İki faktörlü doğrulama kapatıldı." };
}

export async function yedekKodlariYenile(
  _prev: GuvenlikState,
  formData: FormData
): Promise<GuvenlikState> {
  const { db, session } = await getTenantContext();

  const kullanici = await db.user.findFirst({ where: { id: session.userId } });
  if (!kullanici?.ikiFaktorAktif) return { error: "İki faktörlü doğrulama açık değil." };

  if (!(await verifyPassword(String(formData.get("sifre") ?? ""), kullanici.password))) {
    return { error: "Şifreniz hatalı." };
  }

  const { kodlar, ozetler } = await yedekKodSetiUret();
  await db.user.updateMany({
    where: { id: session.userId },
    data: { yedekKodlar: ozetler },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: "Yedek kodlar yenilendi",
  });

  revalidatePath("/guvenlik");
  return { ok: true, yedekKodlar: kodlar, bilgi: "Eski yedek kodlarınız geçersiz oldu." };
}

// ── F3: Oturum yönetimi ────────────────────────────────────────────────────

/** Tek bir oturumu sonlandırır. Kullanıcı yalnızca KENDİ oturumlarını görür. */
export async function oturumSonlandir(oturumId: string): Promise<void> {
  const { db, session } = await getTenantContext();

  const kayit = await db.oturum.findFirst({
    where: { id: oturumId, userId: session.userId },
  });
  if (!kayit) return;

  await db.oturum.deleteMany({ where: { id: oturumId, userId: session.userId } });

  await denetimYaz({
    islem: "sil",
    varlik: "User",
    varlikId: session.userId,
    ozet: `Oturum sonlandırıldı: ${kayit.cihaz ?? "bilinmeyen cihaz"}`,
  });

  // Kendi oturumunu sonlandırdıysa çerez de düşer.
  if (session.jti && kayit.jti === session.jti) {
    await destroySession();
    redirect("/login");
  }

  revalidatePath("/guvenlik");
}

/** Bu oturum hariç hepsini kapatır — "her yerden çıkış yap". */
export async function digerOturumlariKapat(): Promise<void> {
  const { db, session } = await getTenantContext();

  await db.oturum.deleteMany({
    where: { userId: session.userId, ...(session.jti ? { NOT: { jti: session.jti } } : {}) },
  });

  await denetimYaz({
    islem: "sil",
    varlik: "User",
    varlikId: session.userId,
    ozet: "Diğer tüm oturumlar kapatıldı",
  });

  revalidatePath("/guvenlik");
}
