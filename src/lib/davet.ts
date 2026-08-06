import { createHash, randomBytes } from "node:crypto";

/**
 * Davet token'ı (Faz 5 / B3).
 *
 * Bilinçli olarak `server-only` değil ve hiçbir şeye bağımlı değil: hem
 * Server Action'lar, hem davet sayfası, hem testler aynı özet fonksiyonunu
 * kullanır.
 *
 * Token'ın KENDİSİ veritabanına yazılmaz; yalnızca sha256 özeti saklanır.
 * Veritabanını okuyabilen biri geçerli bir davet bağlantısı üretemez.
 */
export function davetTokenUret(): { token: string; ozet: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, ozet: tokenOzeti(token) };
}

export function tokenOzeti(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
