import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "gezegen_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 gün (saniye)

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  // Çok kiracılılık bağlamı (Faz 1 / A2) — her sorgu bu kiracıyla sınırlanır.
  tenantId: string;
  tenantSlug: string;
  tenantAd: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET tanımlı değil. .env dosyasını kontrol edin.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Kiracı bağlamı olmayan oturum geçersizdir (ör. Faz 1 öncesinden kalan
    // eski çerezler). Aksi halde tenantId'siz sorgu çalıştırma riski doğar.
    if (!payload.tenantId) return null;

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      tenantId: payload.tenantId as string,
      tenantSlug: payload.tenantSlug as string,
      tenantAd: payload.tenantAd as string,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
}

export { COOKIE_NAME };
