"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-db";

/**
 * Bildirim işlemleri — Faz 8 / D5.
 *
 * Bildirimler KİŞİSELDİR: ayrı bir izin anahtarı yoktur, çünkü herkes
 * yalnızca kendi bildirimini görür ve yönetir. Bunun yerine her sorguda
 * `kullaniciId` oturumdan alınır — istemciden gelen bir kimlikle asla
 * çalışılmaz, aksi halde bir kullanıcı diğerinin bildirimini okuyabilirdi.
 */

export async function bildirimOkundu(id: string): Promise<void> {
  const { db, session } = await getTenantContext();

  await db.bildirim.updateMany({
    where: { id, kullaniciId: session.userId },
    data: { okundu: new Date() },
  });

  revalidatePath("/bildirimler");
  revalidatePath("/");
}

export async function tumunuOkunduIsaretle(): Promise<void> {
  const { db, session } = await getTenantContext();

  await db.bildirim.updateMany({
    where: { kullaniciId: session.userId, okundu: null },
    data: { okundu: new Date() },
  });

  revalidatePath("/bildirimler");
  revalidatePath("/");
}

export async function bildirimSil(id: string): Promise<void> {
  const { db, session } = await getTenantContext();

  await db.bildirim.deleteMany({
    where: { id, kullaniciId: session.userId },
  });

  revalidatePath("/bildirimler");
}

/** Okunmuş bildirimleri temizler — liste zamanla şişmesin. */
export async function okunanlariTemizle(): Promise<void> {
  const { db, session } = await getTenantContext();

  await db.bildirim.deleteMany({
    where: { kullaniciId: session.userId, okundu: { not: null } },
  });

  revalidatePath("/bildirimler");
}

export type TercihState = { ok?: boolean; error?: string };

/**
 * Bildirim tercihlerini kaydeder (D1).
 *
 * Tercih tablosu yalnızca VARSAYILANDAN SAPMAYI tutar; formdaki her tür için
 * satır yazılır çünkü kullanıcı bilinçli bir seçim yapmıştır ve bu seçimin
 * varsayılan değişse bile korunması gerekir.
 */
export async function tercihleriKaydet(
  _prev: TercihState,
  formData: FormData
): Promise<TercihState> {
  const { db, session } = await getTenantContext();

  const turler = formData.getAll("tur").map(String);

  for (const tur of turler) {
    const uygulama = formData.get(`uygulama-${tur}`) === "1";
    const eposta = formData.get(`eposta-${tur}`) === "1";

    // upsert kiracı katmanında engellidir (bileşik anahtarla çalışır);
    // önce var mı diye bakıp güncelliyor ya da oluşturuyoruz.
    const mevcut = await db.bildirimTercihi.findFirst({
      where: { kullaniciId: session.userId, tur },
    });

    if (mevcut) {
      await db.bildirimTercihi.updateMany({
        where: { kullaniciId: session.userId, tur },
        data: { uygulama, eposta },
      });
    } else {
      await db.bildirimTercihi.create({
        data: { tenantId: session.tenantId, kullaniciId: session.userId, tur, uygulama, eposta },
      });
    }
  }

  revalidatePath("/bildirimler/tercihler");
  return { ok: true };
}
