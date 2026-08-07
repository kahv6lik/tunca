"use server";

import { sifirlamaKaydiGetir, sifirlamayiTamamla } from "@/lib/giris-guvenlik";
import { sifreDogrula } from "@/lib/guvenlik-tanimlar";

export type SifirlaState = { ok?: boolean; error?: string };

/**
 * Yeni şifreyi belirler — Faz 12 / F1.
 *
 * Kullanıcı kimliği İSTEMCİDEN GELMEZ: token'dan çözülür. Aksi halde
 * geçerli bir token'la başkasının şifresi değiştirilebilirdi.
 */
export async function sifreyiBelirle(
  token: string,
  _prev: SifirlaState,
  formData: FormData
): Promise<SifirlaState> {
  const kayit = await sifirlamaKaydiGetir(token);
  if (!kayit) {
    return { error: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir istek oluşturun." };
  }

  const sifre = String(formData.get("sifre") ?? "");
  const tekrar = String(formData.get("tekrar") ?? "");
  if (sifre !== tekrar) return { error: "Şifreler birbiriyle uyuşmuyor." };

  const politika = sifreDogrula(sifre, kayit.email);
  if (!politika.ok) return { error: politika.hata };

  await sifirlamayiTamamla(kayit.id, kayit.userId, sifre);
  return { ok: true };
}
