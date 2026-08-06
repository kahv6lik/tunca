import "server-only";
import { cache } from "react";
import { requireSession } from "./auth";
import { kiraciIstemcisi } from "./rls";
import { prisma } from "./db";
import { PAKET_MODULLERI, modulKapaliMi } from "./constants";

export { modulKapaliMi };

/**
 * Oturumdaki kiracının kendi ayarları: markalama (B7) ve paketi (B4).
 *
 * Kiracı KENDİ satırını okuyabilir (RLS `tenant_kendisi` politikası) ve Plan
 * tablosu herkese okumaya açıktır — bir kiracı kendi limitini bilmelidir.
 * Başka bir kiracının satırı bu bağlamda görünmez.
 *
 * `cache()` sayesinde istek başına tek sorgu çalışır.
 */
export type KiraciAyari = {
  ad: string;
  logoUrl: string | null;
  anaRenk: string | null;
  planAd: string | null;
  kullaniciLimiti: number; // 0 = sınırsız
  firmaLimiti: number; // 0 = sınırsız
  /** null = paket yok, tüm modüller açık. */
  moduller: string[] | null;
};

export const kiraciAyari = cache(async (): Promise<KiraciAyari> => {
  const session = await requireSession();
  const db = kiraciIstemcisi(session.tenantId, prisma);

  const kiraci = await db.tenant.findUnique({
    where: { id: session.tenantId },
    include: { plan: true },
  });

  return {
    ad: kiraci?.ad ?? session.tenantAd,
    logoUrl: kiraci?.logoUrl ?? null,
    anaRenk: kiraci?.anaRenk ?? null,
    planAd: kiraci?.plan?.ad ?? null,
    kullaniciLimiti: kiraci?.plan?.kullaniciLimiti ?? 0,
    firmaLimiti: kiraci?.plan?.firmaLimiti ?? 0,
    moduller: kiraci?.plan ? kiraci.plan.moduller : null,
  };
});

/**
 * Paketi kapalı olan modüllerin izinleri.
 *
 * `etkinIzinler()` bu kümeyi çıkarır; böylece paket kısıtı arayüzde menüyü
 * gizlemekle kalmaz, sayfa ve Server Action korumalarının TAMAMINDA otomatik
 * uygulanır. Yeni bir sayfa eklendiğinde paketi ayrıca kontrol etmek gerekmez.
 */
export async function kapaliModulIzinleri(): Promise<Set<string>> {
  const ayar = await kiraciAyari();
  if (ayar.moduller === null) return new Set();

  const acik = new Set(ayar.moduller);
  const kapali = new Set<string>();
  for (const m of PAKET_MODULLERI) {
    if (!acik.has(m.deger)) {
      // "firma" kapalıysa firma.* izinlerinin tamamı düşer.
      kapali.add(m.deger);
    }
  }

  return kapali;
}

/**
 * Firma limiti (Faz 5 / B4).
 *
 * Yeni kayıt oluşturmadan ÖNCE çağrılır. Limit aşıldıysa kullanıcıya
 * gösterilecek mesajı döndürür, aşılmadıysa `null`. Kontrol sunucudadır;
 * arayüzde düğme gizlemek koruma değildir.
 */
export async function firmaLimitiAsildiMi(): Promise<string | null> {
  const ayar = await kiraciAyari();
  if (ayar.firmaLimiti <= 0) return null;

  const session = await requireSession();
  const db = kiraciIstemcisi(session.tenantId, prisma);
  const sayi = await db.firma.count({ where: { tenantId: session.tenantId } });

  if (sayi >= ayar.firmaLimiti) {
    return (
      `Paketinizin firma sınırına ulaştınız (${ayar.firmaLimiti} firma). ` +
      `Yeni firma eklemek için paketinizi yükseltin.`
    );
  }
  return null;
}
