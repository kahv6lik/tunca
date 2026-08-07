import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  base32Kodla,
  base32Coz,
  TOTP_PERIYOT,
  TOTP_BASAMAK,
  TOTP_PENCERE,
} from "./guvenlik-tanimlar";

/**
 * TOTP ve yedek kod üretimi (Faz 12 / F2) — `node:crypto` gerektirir.
 *
 * `guvenlik-tanimlar.ts`ten AYRIDIR çünkü o dosya istemci paketine de girer
 * ve Node modülleri tarayıcıda derlenmez. Buradaki her şey sunucu tarafında
 * ya da testlerde çalışır.
 *
 * Ek kütüphane kurulmadı: TOTP, HMAC-SHA1 üzerine kurulu otuz satırlık bir
 * algoritmadır. Bir bağımlılık eklemek, kimlik doğrulama yoluna denetlenmemiş
 * kod sokmak demekti.
 */

/** Yeni TOTP sırrı (base32, 20 bayt = 160 bit — RFC önerisi). */
export function totpSirUret(): string {
  return base32Kodla(randomBytes(20));
}

/** Verilen sır ve zaman için TOTP kodu. */
export function totpKod(sir: string, zaman: Date = new Date()): string {
  const sayac = Math.floor(zaman.getTime() / 1000 / TOTP_PERIYOT);
  const tampon = Buffer.alloc(8);
  tampon.writeBigUInt64BE(BigInt(sayac));

  const ozet = createHmac("sha1", base32Coz(sir)).update(tampon).digest();
  const konum = ozet[ozet.length - 1] & 0x0f;
  const kod =
    ((ozet[konum] & 0x7f) << 24) |
    ((ozet[konum + 1] & 0xff) << 16) |
    ((ozet[konum + 2] & 0xff) << 8) |
    (ozet[konum + 3] & 0xff);

  return String(kod % 10 ** TOTP_BASAMAK).padStart(TOTP_BASAMAK, "0");
}

/**
 * Kodu doğrular. Karşılaştırma sabit zamanlıdır (timingSafeEqual): kodun
 * kaçıncı basamağa kadar doğru olduğu ölçülebilseydi, kod tahmin edilebilirdi.
 */
export function totpDogrula(sir: string, kod: string, zaman: Date = new Date()): boolean {
  const temiz = kod.replace(/\D/g, "");
  if (temiz.length !== TOTP_BASAMAK) return false;

  for (let kayma = -TOTP_PENCERE; kayma <= TOTP_PENCERE; kayma++) {
    const beklenen = totpKod(sir, new Date(zaman.getTime() + kayma * TOTP_PERIYOT * 1000));
    const a = Buffer.from(beklenen);
    const b = Buffer.from(temiz);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Authenticator uygulamalarının okuduğu otpauth:// adresi (QR içeriği). */
export function totpUri(sir: string, email: string, kuruluş: string): string {
  const etiket = encodeURIComponent(`${kuruluş}:${email}`);
  const veren = encodeURIComponent(kuruluş);
  return (
    `otpauth://totp/${etiket}?secret=${sir}&issuer=${veren}` +
    `&algorithm=SHA1&digits=${TOTP_BASAMAK}&period=${TOTP_PERIYOT}`
  );
}

// ── Yedek kodlar ───────────────────────────────────────────────────────────

export const YEDEK_KOD_ADEDI = 8;

/** Okunabilir yedek kod: "A3F2-9K7Q" (karışan harf/rakamlar elenmiştir). */
export function yedekKodUret(): string {
  const alfabe = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I, O, 0, 1 yok
  const parca = (n: number) =>
    Array.from({ length: n }, () => alfabe[randomInt(alfabe.length)]).join("");
  return `${parca(4)}-${parca(4)}`;
}

export function yedekKodlarUret(adet: number = YEDEK_KOD_ADEDI): string[] {
  return Array.from({ length: adet }, yedekKodUret);
}

/** Karşılaştırma için normalleştirme: boşluk ve tire yok sayılır. */
export function yedekKodNormalize(kod: string): string {
  return kod.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

