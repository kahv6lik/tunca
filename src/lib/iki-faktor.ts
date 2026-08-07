import "server-only";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { girisIstemcisi } from "./rls";
import { yedekKodlarUret, yedekKodNormalize } from "./guvenlik-totp";

/**
 * İki faktörlü doğrulama — sunucu tarafı (Faz 12 / F2).
 *
 * TOTP üretimi/doğrulaması `guvenlik-totp.ts` içindedir; burada ikinci
 * aşama bileti ve yedek kod yönetimi vardır.
 */

const BILET_OMRU = "5m";
// Oturum çerezinden AYRI bir amaç etiketi: bir bilet, oturum jetonu olarak
// kullanılamaz (ve tersi de geçerli değildir).
const AMAC = "iki-faktor-bilet";

function sir(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET tanımlı değil.");
  return new TextEncoder().encode(s);
}

/**
 * Şifre aşamasının geçildiğini KANITLAYAN kısa ömürlü bilet.
 *
 * Neden imzalı bilet: ikinci aşamada istemciden "hangi kullanıcı" bilgisini
 * almak, kod doğrulamasını başka bir hesaba yönlendirmeye izin verirdi.
 * Kullanıcı kimliği bileti imzalayan sunucudan gelir.
 */
export async function ikinciAsamaBileti(userId: string): Promise<string> {
  return new SignJWT({ userId, amac: AMAC })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(BILET_OMRU)
    .sign(sir());
}

export async function ikinciAsamaCoz(bilet: string): Promise<string | null> {
  if (!bilet) return null;
  try {
    const { payload } = await jwtVerify(bilet, sir());
    if (payload.amac !== AMAC) return null;
    return (payload.userId as string) || null;
  } catch {
    return null;
  }
}

/** Kullanılan yedek kodu listeden düşürür — her kod bir kez işe yarar. */
export async function yedekKoduTuket(userId: string, ozet: string): Promise<void> {
  const db = girisIstemcisi();
  const kullanici = await db.user.findFirst({ where: { id: userId } });
  if (!kullanici) return;

  await db.user.updateMany({
    where: { id: userId },
    data: { yedekKodlar: kullanici.yedekKodlar.filter((k) => k !== ozet) },
  });
}

/**
 * Yeni yedek kod seti üretir ve ÖZETLERİNİ döndürür.
 *
 * Açık kodlar yalnızca çağırana döner ve kullanıcıya bir kez gösterilir;
 * veritabanına bcrypt özeti yazılır. Açık saklamak, 2FA'yı veritabanını
 * okuyan biri için ikinci bir parolaya indirgerdi.
 */
export async function yedekKodSetiUret(): Promise<{ kodlar: string[]; ozetler: string[] }> {
  const kodlar = yedekKodlarUret();
  const ozetler = await Promise.all(
    kodlar.map((k) => bcrypt.hash(yedekKodNormalize(k), 10))
  );
  return { kodlar, ozetler };
}
