"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { davetiKullan } from "@/lib/davet-db";

export type DavetState = { error?: string };

/**
 * Daveti kabul et (Faz 5 / B3).
 *
 * GİRİŞ GEREKTİRMEZ. Veri erişiminin tamamı `src/lib/davet-db.ts` içindedir;
 * kiracı izolasyonunun bu bilinçli istisnası tek bir dosyada toplanmıştır.
 * Burada yalnızca form doğrulaması, şifre hash'i ve oturum açma yapılır.
 */
export async function davetKabul(
  token: string,
  _prev: DavetState,
  formData: FormData
): Promise<DavetState> {
  const sifre = String(formData.get("sifre") ?? "");
  const sifreTekrar = String(formData.get("sifreTekrar") ?? "");

  if (sifre.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (sifre !== sifreTekrar) return { error: "Şifreler eşleşmiyor." };

  const sonuc = await davetiKullan(token, await bcrypt.hash(sifre, 10));
  if ("hata" in sonuc) return { error: sonuc.hata };

  await createSession({
    userId: sonuc.kullanici.id,
    email: sonuc.kullanici.email,
    name: sonuc.kullanici.name,
    role: sonuc.kullanici.role,
    tenantId: sonuc.kiraci.id,
    tenantSlug: sonuc.kiraci.slug,
    tenantAd: sonuc.kiraci.ad,
  });

  redirect("/");
}
