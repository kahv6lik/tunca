"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-db";
import { panoKartiBul } from "@/lib/pano-tanimlar";

/**
 * Genel Bakış tercihi — Faz 10 / E3.
 *
 * Tercih KİŞİSELDİR: ayrı bir izin yoktur, herkes kendi panosunu düzenler.
 * `kullaniciId` her zaman oturumdan alınır; istemciden gelen bir kimlikle
 * çalışılmaz.
 */
export async function panoKaydet(kartlar: string[]): Promise<void> {
  const { db, session } = await getTenantContext();

  // İstemciden gelen listeye güvenilmez: bilinmeyen anahtarlar ayıklanır,
  // liste makul bir uzunlukla sınırlanır. (İzin süzgeci okuma tarafında da
  // uygulanır; burada temizlik yeterli.)
  const temiz = [...new Set(kartlar)]
    .filter((anahtar) => panoKartiBul(anahtar) !== undefined)
    .slice(0, 50);

  const mevcut = await db.panoTercihi.findFirst({
    where: { kullaniciId: session.userId },
  });

  if (mevcut) {
    await db.panoTercihi.updateMany({
      where: { kullaniciId: session.userId },
      data: { kartlar: temiz },
    });
  } else {
    await db.panoTercihi.create({
      data: {
        tenantId: session.tenantId,
        kullaniciId: session.userId,
        kartlar: temiz,
      },
    });
  }

  revalidatePath("/");
}

/** Tercihi siler → varsayılan düzene dönülür. */
export async function panoVarsayilanaDon(): Promise<void> {
  const { db, session } = await getTenantContext();
  await db.panoTercihi.deleteMany({ where: { kullaniciId: session.userId } });
  revalidatePath("/");
}
