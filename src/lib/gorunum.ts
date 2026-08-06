import "server-only";
import { redirect } from "next/navigation";
import { getTenantContext } from "./tenant-db";

export * from "./gorunum-tanimlar";
import type { GorunumOgesi } from "./gorunum-tanimlar";

/**
 * Kayıtlı görünümler — Faz 10 / E4.
 *
 * Görünüm = bir listenin ADLANDIRILMIŞ filtre hâli. Listeler zaten URL
 * parametreleriyle filtrelendiği için görünümün gövdesi ham bir
 * querystring'dir; her liste için ayrı şema gerekmez ve dışa aktarım da aynı
 * parametreleri kullandığından görünümler orada da kendiliğinden geçerlidir.
 *
 * Paylaşım modeli:
 *   - Herkes kendi görünümünü oluşturur.
 *   - `paylasilan` işaretliyse kiracıdaki HERKES görür (ama yalnızca sahibi
 *     ya da kuruluş yöneticisi değiştirir/siler).
 *   - `varsayilan` kişiseldir: liste parametresiz açılınca sahibine uygulanır.
 */

/** Listenin görünümleri: benimkiler + paylaşılanlar. */
export async function gorunumleriGetir(liste: string): Promise<GorunumOgesi[]> {
  const { db, session } = await getTenantContext();

  const kayitlar = await db.kayitliGorunum.findMany({
    where: {
      liste,
      OR: [{ kullaniciId: session.userId }, { paylasilan: true }],
    },
    orderBy: [{ paylasilan: "asc" }, { ad: "asc" }],
  });

  // Paylaşılan görünümlerde sahibin adı gösterilir ("kim kurmuş?").
  const sahipler = [...new Set(kayitlar.map((k) => k.kullaniciId))];
  const kullanicilar = await db.user.findMany({
    where: { id: { in: sahipler } },
    select: { id: true, name: true },
  });
  const adOf = new Map(kullanicilar.map((k) => [k.id, k.name]));

  return kayitlar.map((k) => ({
    id: k.id,
    ad: k.ad,
    sorgu: k.sorgu,
    paylasilan: k.paylasilan,
    varsayilan: k.varsayilan && k.kullaniciId === session.userId,
    benim: k.kullaniciId === session.userId,
    sahibi: k.kullaniciId === session.userId ? null : adOf.get(k.kullaniciId) ?? null,
  }));
}

/**
 * Liste PARAMETRESIZ açıldıysa ve kullanıcının varsayılan görünümü varsa
 * ona yönlendirir.
 *
 * Yönlendirilen adreste `g=1` işareti bulunur; işaret varken bu fonksiyon
 * hiçbir şey yapmaz — döngü imkânsızdır ve kullanıcı "Tümü" bağlantısıyla
 * (o da `g=1` taşır) süzgeçsiz listeye her zaman dönebilir.
 */
export async function varsayilanaYonlendir(
  liste: string,
  searchParams: Record<string, string | undefined>
): Promise<void> {
  if (Object.keys(searchParams).length > 0) return;

  const { db, session } = await getTenantContext();
  const varsayilan = await db.kayitliGorunum.findFirst({
    where: { liste, kullaniciId: session.userId, varsayilan: true },
  });

  if (!varsayilan || !varsayilan.sorgu) return;
  redirect(`/${liste}?g=1&${varsayilan.sorgu}`);
}
