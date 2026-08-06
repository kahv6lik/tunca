import "server-only";
import { prisma } from "./db";
import { yonetimIstemcisi, kimlikIstemcisi } from "./rls";
import { tokenOzeti } from "./davet";

/**
 * Davet veri erişimi (Faz 5 / B3) — TEK KAPI.
 *
 * Davet akışı oturum AÇILMADAN çalışır: davet edilen kişinin henüz hesabı
 * yoktur. Bu yüzden kiracı bağlamı kurulamaz ve burası, giriş action'ından
 * sonra kiracı izolasyonunun ikinci bilinçli istisnasıdır. İstisnayı bu
 * dosyada topluyoruz ki kapsamı bir bakışta görülebilsin:
 *
 *   - Okuma `kimlikIstemcisi` ile yapılır (RLS'te salt okuma, iş verisi yok).
 *   - Yazma yalnızca `davetiKullan` içinde ve yalnızca geçerli bir token'la.
 *   - Kiracı, e-posta ve rol İSTEMCİDEN GELMEZ; davet kaydından okunur.
 *   - Token tahmin edilemez (32 rastgele bayt) ve veritabanında yalnızca
 *     sha256 özeti durur.
 */

export type DavetGorunumu = {
  email: string;
  ad: string;
  rol: string;
  sonKullanma: Date;
  kiraciAd: string;
  gecerli: boolean;
};

/** Davet sayfası için salt okuma. Geçersiz token'da `null` döner. */
export async function davetGoruntule(token: string): Promise<DavetGorunumu | null> {
  const db = kimlikIstemcisi(prisma);
  const davet = await db.davet.findUnique({
    where: { tokenOzeti: tokenOzeti(token) },
    include: { tenant: { select: { ad: true, durum: true } } },
  });
  if (!davet) return null;

  return {
    email: davet.email,
    ad: davet.ad,
    rol: davet.rol,
    sonKullanma: davet.sonKullanma,
    kiraciAd: davet.tenant.ad,
    gecerli:
      !davet.kullanildi &&
      davet.sonKullanma > new Date() &&
      davet.tenant.durum === "aktif",
  };
}

export type KabulSonucu =
  | { hata: string }
  | {
      kullanici: { id: string; email: string; name: string; role: string };
      kiraci: { id: string; slug: string; ad: string };
    };

/**
 * Daveti tüketip kullanıcıyı oluşturur.
 *
 * Şifre bu katmana HASH'LENMİŞ gelir — düz metin şifre buradan geçmez.
 */
export async function davetiKullan(
  token: string,
  sifreHash: string
): Promise<KabulSonucu> {
  const db = yonetimIstemcisi(prisma);

  const davet = await db.davet.findUnique({
    where: { tokenOzeti: tokenOzeti(token) },
    include: { tenant: { include: { plan: true } } },
  });

  if (!davet || davet.kullanildi || davet.sonKullanma < new Date()) {
    return { hata: "Bu davet bağlantısı geçersiz ya da süresi dolmuş." };
  }
  if (davet.tenant.durum !== "aktif") {
    return { hata: "Kuruluşun erişimi durdurulmuş. Yöneticinizle görüşün." };
  }

  const mevcut = await db.user.findFirst({
    where: { tenantId: davet.tenantId, email: davet.email },
  });
  if (mevcut) return { hata: "Bu e-posta ile bir hesap zaten var. Giriş yapın." };

  // Paket limiti davet OLUŞTURULURKEN de kontrol edilir; kabul anında yeniden
  // bakılır, çünkü aradan geçen sürede başka kullanıcılar eklenmiş olabilir.
  const limit = davet.tenant.plan?.kullaniciLimiti ?? 0;
  if (limit > 0) {
    const sayi = await db.user.count({ where: { tenantId: davet.tenantId } });
    if (sayi >= limit) {
      return { hata: "Kuruluşun kullanıcı sınırına ulaşıldı. Yöneticinizle görüşün." };
    }
  }

  const kullanici = await db.user.create({
    data: {
      tenantId: davet.tenantId,
      email: davet.email,
      name: davet.ad,
      password: sifreHash,
      role: davet.rol,
    },
  });

  await db.davet.update({
    where: { id: davet.id },
    data: { kullanildi: new Date() },
  });

  await db.denetimKaydi.create({
    data: {
      tenantId: davet.tenantId,
      kullaniciId: kullanici.id,
      kullaniciEmail: kullanici.email,
      islem: "olustur",
      varlik: "User",
      varlikId: kullanici.id,
      ozet: `Davet kabul edildi (davet eden: ${davet.olusturanEmail})`,
      yeni: { email: kullanici.email, name: kullanici.name, role: kullanici.role },
    },
  });

  return {
    kullanici: {
      id: kullanici.id,
      email: kullanici.email,
      name: kullanici.name,
      role: kullanici.role,
    },
    kiraci: { id: davet.tenantId, slug: davet.tenant.slug, ad: davet.tenant.ad },
  };
}
