"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-db";
import { yetkiGerektir, IZIN } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

/**
 * AI ayarı — Faz 21.
 *
 * Açma/kapama DENETİM GÜNLÜĞÜNE düşer. Kiracı verisinin bir dil modeline
 * gönderilmesine izin vermek, sonradan "bunu kim ne zaman açtı" diye
 * sorulacak bir karardır; izsiz bırakılamaz.
 */
export async function aiAyarKaydet(acik: boolean): Promise<void> {
  await yetkiGerektir(IZIN.aiYonet);
  const { db, session } = await getTenantContext();

  // Kiracı KENDİ satırını günceller; RLS başka kiracıya dokunmayı zaten
  // engeller, `where`teki id ikinci katmandır.
  await db.tenant.update({
    where: { id: session.tenantId },
    data: { aiAcik: acik },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "AiAyar",
    varlikId: session.tenantId,
    ozet: acik ? "AI özellikleri açıldı" : "AI özellikleri kapatıldı",
    yeni: { aiAcik: acik },
  });

  revalidatePath("/ai");
}
