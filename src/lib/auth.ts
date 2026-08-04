import "server-only";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Server component/action içinde oturumu zorunlu kılar
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
