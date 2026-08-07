"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-db";
import { denetimYaz } from "@/lib/denetim";
import { KVKK_SURUM } from "@/lib/kvkk-tanimlar";

export type RizaState = { ok?: boolean; error?: string };

/**
 * Açık rıza kaydı — Faz 12 / F7.
 *
 * Kullanıcı yalnızca KENDİ satırını yazar (kişisel tercih deseni), ama olay
 * denetim günlüğüne düşer: rızanın ne zaman ve hangi metin sürümüne verildiği
 * sonradan kanıtlanabilir olmalıdır.
 */
export async function rizaVer(
  _prev: RizaState,
  formData: FormData
): Promise<RizaState> {
  if (String(formData.get("onay") ?? "") !== "1") {
    return { error: "Devam etmek için onay kutusunu işaretleyin." };
  }

  const { db, session } = await getTenantContext();
  const simdi = new Date();

  await db.user.updateMany({
    where: { id: session.userId },
    data: { kvkkOnayTarihi: simdi, kvkkSurum: KVKK_SURUM },
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: `KVKK aydınlatma metni onaylandı (sürüm ${KVKK_SURUM})`,
    yeni: { kvkkSurum: KVKK_SURUM, tarih: simdi.toISOString() },
  });

  revalidatePath("/kvkk");
  return { ok: true };
}
