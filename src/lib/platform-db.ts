import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { requireSession } from "./auth";
import { yonetimIstemcisi } from "./rls";
import { rolNormalize, ROL } from "./yetki-tanimlar";

/**
 * Platform (admin panel) veri erişimi — Faz 5.
 *
 * Kiracı katmanının tam tersi: burası kiracılar ÖTESİ çalışır. Platform
 * sahibinin bütün müşterileri görebilmesi gerekir; RLS ise varsayılan olarak
 * buna izin vermez. Bu yüzden yönetim bağlamı (`app.yonetim`) kullanılır.
 *
 * TEK KAPI: yönetim bağlamına uygulama içinden erişilen tek yer burasıdır ve
 * her çağrıda oturumun `platform_admin` olduğu doğrulanır. Bu dosyayı
 * genişletirken bu kuralı bozmayın — kiracı izolasyonunun tek bilinçli
 * istisnası buradan geçer.
 */

export async function platformOturumu() {
  const session = await requireSession();

  if (rolNormalize(session.role) !== ROL.platformAdmin) {
    redirect("/yetkisiz?izin=kiraci.yonet");
  }

  return session;
}

/** Kiracılar ötesi veri erişimi. Yalnızca platform yöneticisi için. */
export async function getPlatformDb() {
  await platformOturumu();
  return yonetimIstemcisi(prisma);
}

/** Platform yöneticisi mi? (yönlendirme yapmadan) */
export async function platformYoneticisiMi(): Promise<boolean> {
  const session = await requireSession();
  return rolNormalize(session.role) === ROL.platformAdmin;
}

/**
 * Impersonation'dan çıkarken gerçek yöneticiyi okur (Faz 5 / B5).
 *
 * Bu okuma `getPlatformDb()` üzerinden YAPILAMAZ: impersonation sırasında
 * oturumun rolü bilinçli olarak `tenant_admin`'e düşürülmüştür, yani kendi
 * kapısına takılırdı. Kapsam tek bir okumayla sınırlıdır ve kötüye
 * kullanılamaz — `userId` yalnızca imzalı oturum çerezindeki
 * `impersonatorId` alanından gelir, istemciden değil.
 */
export async function impersonatorOku(userId: string) {
  const db = yonetimIstemcisi(prisma);
  return db.user.findUnique({ where: { id: userId }, include: { tenant: true } });
}
