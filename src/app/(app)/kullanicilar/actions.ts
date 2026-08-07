"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getTenantContext, tenantGuncelle, tenantSil, kayitOku } from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { ROL } from "@/lib/yetki-tanimlar";
import { denetimYaz } from "@/lib/denetim";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { davetTokenUret } from "@/lib/davet";
import { sifreDogrula } from "@/lib/guvenlik-tanimlar";

/**
 * Kuruluş içi kullanıcı yönetimi — /kullanicilar (kullanici.yonet).
 *
 * Admin paneldeki (platform) muadilinden farkı: her şey KİRACI KAPSAMINDA
 * çalışır — kuruluş yöneticisi yalnızca kendi ekibini görür ve yönetir.
 * Platform rolü buradan VERİLEMEZ; kiracı içinden platform yöneticisi
 * yaratmak, kiracı sınırının kendisini deler.
 */

export type FormState = { error?: string; ok?: boolean; bilgi?: string };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

/** Kuruluş içinde atanabilir roller — platform_admin bilinçli olarak YOK. */
const KURULUS_ROLLERI = [ROL.tenantAdmin, ROL.uye, ROL.saltOkunur] as const;

export async function ekipRolDegistir(userId: string, rol: string): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) return { error: YETKISIZ };
  if (!(KURULUS_ROLLERI as readonly string[]).includes(rol)) {
    return { error: "Geçersiz rol." };
  }

  const { db, session } = await getTenantContext();
  if (userId === session.userId) {
    // Tek yöneticinin kendini üyeye düşürmesi kuruluşu yönetimsiz bırakır.
    return { error: "Kendi rolünüzü buradan değiştiremezsiniz." };
  }

  const oncesi = await kayitOku(db, "user", userId);
  if (!oncesi) return { error: "Kullanıcı bulunamadı." };
  if (oncesi.role === ROL.platformAdmin) {
    return { error: "Platform yöneticisi kuruluş içinden yönetilemez." };
  }

  await tenantGuncelle(db, "user", userId, { role: rol });
  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: userId,
    ozet: `Rol değişti: ${oncesi.role} → ${rol}`,
    eski: { role: oncesi.role },
    yeni: { role: rol },
  });

  revalidatePath("/kullanicilar");
  return { ok: true };
}

export async function ekipDurumDegistir(userId: string, durum: string): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) return { error: YETKISIZ };
  if (!["aktif", "pasif"].includes(durum)) return { error: "Geçersiz durum." };

  const { db, session } = await getTenantContext();
  if (userId === session.userId) {
    return { error: "Kendi hesabınızı pasifleştiremezsiniz." };
  }

  const oncesi = await kayitOku(db, "user", userId);
  if (!oncesi) return { error: "Kullanıcı bulunamadı." };
  if (oncesi.role === ROL.platformAdmin) {
    return { error: "Platform yöneticisi kuruluş içinden yönetilemez." };
  }

  await tenantGuncelle(db, "user", userId, { durum });
  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: userId,
    ozet: `Hesap ${durum === "aktif" ? "aktifleştirildi" : "pasifleştirildi"}: ${oncesi.email}`,
    eski: { durum: oncesi.durum },
    yeni: { durum },
  });

  revalidatePath("/kullanicilar");
  return { ok: true };
}

export async function ekipSifreSifirla(
  userId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) return { error: YETKISIZ };

  const sifre = String(formData.get("sifre") ?? "");

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "user", userId);
  if (!oncesi) return { error: "Kullanıcı bulunamadı." };

  if (oncesi.role === ROL.platformAdmin) {
    return { error: "Platform yöneticisi kuruluş içinden yönetilemez." };
  }

  const politika = sifreDogrula(sifre, oncesi.email as string);
  if (!politika.ok) return { error: politika.hata };

  await tenantGuncelle(db, "user", userId, {
    password: await bcrypt.hash(sifre, 10),
    sifreGuncellendi: new Date(),
  });
  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: userId,
    ozet: `Şifre sıfırlandı: ${oncesi.email}`,
  });

  revalidatePath("/kullanicilar");
  return { ok: true, bilgi: "Şifre güncellendi." };
}

// ── Davet ──────────────────────────────────────────────────────────────────

const davetSemasi = z.object({
  ad: z.string().trim().min(1, "Ad zorunludur."),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  rol: z.enum(KURULUS_ROLLERI),
});

export async function ekipDavetOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) return { error: YETKISIZ };

  const parsed = davetSemasi.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const { db, session } = await getTenantContext();

  const mevcut = await db.user.findFirst({ where: { email: parsed.data.email } });
  if (mevcut) return { error: "Bu e-posta kuruluşunuzda zaten kayıtlı." };

  // Paket kullanıcı limiti (B4) — davet de limitin arka kapısı değildir.
  const ayar = await kiraciAyari();
  if (ayar.kullaniciLimiti > 0) {
    const sayi = await db.user.count({});
    if (sayi >= ayar.kullaniciLimiti) {
      return {
        error: `Paket sınırına ulaşıldı (${ayar.kullaniciLimiti} kullanıcı). Paketi yükseltin.`,
      };
    }
  }

  const { token, ozet } = davetTokenUret();
  const sonKullanma = new Date();
  sonKullanma.setDate(sonKullanma.getDate() + 7);

  await db.davet.create({
    data: {
      tenantId: session.tenantId,
      email: parsed.data.email,
      ad: parsed.data.ad,
      rol: parsed.data.rol,
      tokenOzeti: ozet,
      sonKullanma,
      olusturanEmail: session.email,
    },
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "User",
    varlikId: parsed.data.email,
    ozet: `Davet oluşturuldu: ${parsed.data.email} (${parsed.data.rol})`,
    yeni: { email: parsed.data.email, rol: parsed.data.rol },
  });

  revalidatePath("/kullanicilar");
  // Bağlantı BİR KEZ gösterilir; token saklanmaz, yalnızca sha256 özeti durur.
  return { ok: true, bilgi: `/davet/${token}` };
}

export async function ekipDavetIptal(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "davet", id);
  await tenantSil(db, "davet", id);

  await denetimYaz({
    islem: "sil",
    varlik: "User",
    varlikId: id,
    ozet: `Davet iptal edildi: ${(oncesi?.email as string) ?? ""}`,
  });

  revalidatePath("/kullanicilar");
}

// ── Kuruluş güvenlik politikaları (Faz 12 / F2, F3, F7) ────────────────────

/**
 * Kuruluş çapındaki güvenlik ayarları — `kullanici.yonet` iznine bağlıdır.
 *
 * Bunlar kişisel değil KURULUŞSAL kararlardır: 2FA zorunluluğu bütün ekibi,
 * saklama süresi ise kuruluşun KVKK taahhüdünü etkiler.
 */
export async function guvenlikPolitikasiKaydet(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kullaniciYonet))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();

  const ikiFaktorZorunlu = String(formData.get("ikiFaktorZorunlu") ?? "") === "1";
  const oturumOmruGun = Math.min(365, Math.max(1, Number(formData.get("oturumOmruGun")) || 7));
  const veriSaklamaGun = Math.min(3650, Math.max(0, Number(formData.get("veriSaklamaGun")) || 0));

  const oncesi = await db.tenant.findFirst({ where: { id: session.tenantId } });

  await db.tenant.updateMany({
    where: { id: session.tenantId },
    data: { ikiFaktorZorunlu, oturumOmruGun, veriSaklamaGun },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User", // denetimde "kuruluş güvenlik politikası" olayı
    varlikId: session.tenantId,
    ozet: `Güvenlik politikası güncellendi (2FA zorunlu: ${ikiFaktorZorunlu ? "evet" : "hayır"})`,
    eski: {
      ikiFaktorZorunlu: oncesi?.ikiFaktorZorunlu,
      oturumOmruGun: oncesi?.oturumOmruGun,
      veriSaklamaGun: oncesi?.veriSaklamaGun,
    },
    yeni: { ikiFaktorZorunlu, oturumOmruGun, veriSaklamaGun },
  });

  revalidatePath("/kullanicilar");
  return { ok: true, bilgi: "Güvenlik politikası kaydedildi." };
}
