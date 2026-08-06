/**
 * Dışa aktarımın SAF katmanı — Faz 9 / E1.
 *
 * Biçimlendirme ve CSV üretimi veritabanına dokunmaz; `server-only`
 * olmadıkları için doğrudan test edilebilirler. CSV'nin ayırıcı, BOM ve
 * kaçırma kuralları burada yaşar — dosyanın Excel'de doğru açılıp
 * açılmayacağını belirleyen ayrıntılar bunlardır.
 */

import type { VeriKumesi } from "./disa-aktar-tanimlar";
import { durumBadge } from "./constants";

/** Metin alanlarında görünen ham durum değerlerini Türkçeleştirir. */
export function degerBicimle(deger: unknown, tur?: string): string | number | Date | null {
  if (deger == null) return null;
  if (tur === "durum" && typeof deger === "string") return durumBadge(deger).label;
  if (deger instanceof Date) return deger;
  if (typeof deger === "boolean") return deger ? "Evet" : "Hayır";
  if (typeof deger === "number") return deger;
  return String(deger);
}


/**
 * CSV üretir.
 *
 * BOM ile başlar: Excel BOM'suz UTF-8 CSV'yi Windows'ta yanlış kod
 * sayfasıyla açar ve Türkçe karakterler bozulur. Ayırıcı olarak NOKTALI
 * VİRGÜL kullanılır — Türkçe Windows yerelinde Excel'in beklediği ayırıcı
 * budur; virgül kullanmak sütunların tek hücrede birleşmesine yol açar.
 */
export function csvUret(kume: VeriKumesi, satirlar: Record<string, unknown>[]): string {
  const kacir = (d: unknown): string => {
    if (d == null) return "";
    const metin =
      d instanceof Date ? d.toLocaleDateString("tr-TR") : String(d);
    // Alan içinde ayırıcı, tırnak veya satır sonu varsa tırnakla.
    return /[";\n\r]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
  };

  const basliklar = kume.sutunlar.map((s) => kacir(s.etiket)).join(";");
  const govde = satirlar.map((satir) =>
    kume.sutunlar
      .map((s) => kacir(degerBicimle(satir[s.anahtar], s.tur)))
      .join(";")
  );

  return "﻿" + [basliklar, ...govde].join("\r\n") + "\r\n";
}

