"use server";

import { redirect } from "next/navigation";
import { getSession, destroySession } from "@/lib/session";
import { oturumKapat } from "@/lib/giris-guvenlik";

export async function logoutAction(): Promise<void> {
  // Çerezi silmek yetmez: sunucudaki oturum kaydı da düşmelidir (Faz 12 / F3).
  // Aksi halde kayıt "açık oturumlar" listesinde asılı kalırdı.
  const session = await getSession();
  if (session?.jti) await oturumKapat(session.jti);

  await destroySession();
  redirect("/login");
}
