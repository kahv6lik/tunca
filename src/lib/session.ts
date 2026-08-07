import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "gezegen_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 gün (saniye) — varsayılan

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;

  /**
   * Oturum kimliği (Faz 12 / F3).
   *
   * JWT kendi başına iptal edilemez; bu `jti`, sunucudaki `Oturum` satırına
   * karşılık gelir. Satır silinince oturum geçersizleşir — "oturumu uzaktan
   * sonlandır" özelliğini mümkün kılan şey budur.
   *
   * İsteğe bağlıdır çünkü Faz 12 ÖNCESİ çerezler jti taşımaz; onlar doğal
   * ömürleri dolana kadar geçerli sayılır (kullanıcıları toptan çıkarmamak
   * için bilinçli bir geçiş kararı).
   */
  jti?: string;
  // Çok kiracılılık bağlamı (Faz 1 / A2) — her sorgu bu kiracıyla sınırlanır.
  tenantId: string;
  tenantSlug: string;
  tenantAd: string;

  /**
   * Impersonation (Faz 5 / B5) — "kiracı olarak görüntüle".
   *
   * Doluysa oturum, platform yöneticisinin bir müşteriyi görüntülediği
   * anlamına gelir. Arayüzde kalıcı uyarı bandı çıkar ve yapılan HER işlem
   * denetim günlüğüne GERÇEK yönetici kimliğiyle yazılır.
   */
  impersonatorId?: string;
  impersonatorEmail?: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET tanımlı değil. .env dosyasını kontrol edin.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(
  payload: SessionPayload,
  omurSaniye: number = SESSION_DURATION
): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${omurSaniye}s`)
    .sign(getSecret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: omurSaniye,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Kiracı bağlamı olmayan oturum geçersizdir (ör. Faz 1 öncesinden kalan
    // eski çerezler). Aksi halde tenantId'siz sorgu çalıştırma riski doğar.
    if (!payload.tenantId) return null;

    /**
     * Oturum iptali (F3): jti taşıyan çerezlerde sunucudaki kayıt aranır.
     *
     * Bu kontrol middleware'de DEĞİL burada yapılır: middleware Edge
     * çalışma zamanındadır ve Prisma oraya girmez. Uygulamanın her sayfası
     * ve action'ı `requireSession`/`getSession` üzerinden geçtiği için
     * koruma etkin — middleware yalnızca imza ve süre bakar.
     */
    const jti = (payload.jti as string) || undefined;
    if (jti) {
      const { oturumGecerliMi } = await import("./giris-guvenlik");
      if (!(await oturumGecerliMi(jti))) return null;
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      jti,
      tenantId: payload.tenantId as string,
      tenantSlug: payload.tenantSlug as string,
      tenantAd: payload.tenantAd as string,
      impersonatorId: (payload.impersonatorId as string) || undefined,
      impersonatorEmail: (payload.impersonatorEmail as string) || undefined,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export { COOKIE_NAME };
