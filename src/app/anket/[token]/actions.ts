"use server";

import { anketiYanitla } from "@/lib/anket-db";

/**
 * Anket yanıtlama action'ı — Faz 19 / N3.
 *
 * OTURUM GEREKTİRMEZ ve bu bilinçlidir: anketi dolduran kişi uygulamanın
 * kullanıcısı değildir. Bu yüzden `yetkiVarMi` / `denetimYaz` de ÇAĞRILMAZ —
 * ortada bir kullanıcı yoktur; denetim günlüğü "kim yaptı" sorusunu
 * yanıtlamak içindir ve burada yanıtı yoktur.
 *
 * Koruma yetkiyle değil TOKEN'la sağlanır: bağlantı tahmin edilemez (32
 * rastgele bayt), tek kullanımlıktır ve anketin bitiş tarihine bağlıdır.
 * Bütün doğrulama `anket-db.ts` içindedir — beşinci dar kapı orasıdır ve
 * bu dosya yalnızca formu ona taşır.
 */

export type YanitState = { error?: string; ok?: boolean };

export async function yanitiKaydet(
  token: string,
  _prev: YanitState,
  formData: FormData
): Promise<YanitState> {
  const degerler: Record<string, string> = {};
  for (const [anahtar, deger] of formData.entries()) {
    // Soru kimlikleri `s_<soruId>` olarak gelir; başka anahtar yok sayılır.
    if (anahtar.startsWith("s_") && typeof deger === "string") {
      degerler[anahtar.slice(2)] = deger;
    }
  }

  const sonuc = await anketiYanitla(token, degerler);
  return sonuc.ok ? { ok: true } : { error: sonuc.hata };
}
