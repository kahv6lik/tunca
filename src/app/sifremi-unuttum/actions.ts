"use server";

import { headers } from "next/headers";
import { sifirlamaIstegiOlustur, sifirlamaEpostasiKuyrukla } from "@/lib/giris-guvenlik";

export type UnuttumState = { ok?: boolean; error?: string; bilgi?: string };

/**
 * Şifre sıfırlama isteği — Faz 12 / F1.
 *
 * YANIT HER ZAMAN AYNIDIR: hesap bulunsun ya da bulunmasın kullanıcı
 * "e-posta gönderildi" mesajını görür. Aksi halde bu form, kimlerin müşteri
 * olduğunu sorgulayan bir sayaca dönüşürdü.
 */
export async function sifirlamaIste(
  _prev: UnuttumState,
  formData: FormData
): Promise<UnuttumState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Geçerli bir e-posta adresi girin." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const kokAdres = (process.env.APP_URL ?? "").replace(/\/$/, "");

  const sonuclar = await sifirlamaIstegiOlustur(email, ip);

  for (const sonuc of sonuclar) {
    if (!sonuc.ok) continue;
    await sifirlamaEpostasiKuyrukla({
      tenantId: sonuc.tenantId,
      email: sonuc.email,
      ad: sonuc.ad,
      baglanti: `${kokAdres}/sifre-sifirla/${sonuc.token}`,
    });
  }

  return {
    ok: true,
    bilgi:
      "Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. " +
      "Bağlantı 1 saat geçerlidir.",
  };
}
