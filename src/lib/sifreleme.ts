import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Simetrik şifreleme — Faz 8.
 *
 * Kiracıların posta kutusu parolaları veritabanında AÇIK saklanmaz.
 * Veritabanı yedeğini eline geçiren birinin müşterinin e-postalarını
 * okuyabilmesi kabul edilemez.
 *
 * AES-256-GCM kullanılır: hem gizlilik hem bütünlük sağlar, yani şifreli
 * metni kurcalayan biri çözme aşamasında yakalanır.
 *
 * ANAHTAR `AUTH_SECRET`'tan türetilir. Bu, ayrı bir sır yönetmemek için
 * bilinçli bir sadeleştirmedir ve şu sonucu doğurur: **AUTH_SECRET
 * değiştirilirse kayıtlı posta parolaları çözülemez hâle gelir** (uygulama
 * çökmez; ayar "yeniden girin" durumuna düşer). Bu davranış
 * `docs/DEPLOY.md` içinde de yazılıdır.
 *
 * Biçim:  v1:<iv-base64>:<etiket-base64>:<sifreli-base64>
 * Sürüm ön eki bilinçlidir; ileride algoritma değişirse eski kayıtlar
 * tanınabilir kalır.
 */

const SURUM = "v1";
const ALGORITMA = "aes-256-gcm";
// Sabit tuz: anahtar türetmenin deterministik olması gerekir, aksi halde
// yeniden başlatmada eski kayıtlar çözülemezdi. Tuzun gizli olması gerekmez;
// gizli olan AUTH_SECRET'tır.
const TUZ = "gezegen-crm-eposta-v1";

function anahtar(): Buffer {
  const sir = process.env.AUTH_SECRET;
  if (!sir) {
    throw new Error("AUTH_SECRET tanımlı değil; şifreleme yapılamaz.");
  }
  return scryptSync(sir, TUZ, 32);
}

/** Düz metni şifreler. Boş/undefined girdi olduğu gibi döner. */
export function sifrele(duzMetin: string | null | undefined): string | null {
  if (!duzMetin) return null;

  const iv = randomBytes(12); // GCM için önerilen uzunluk
  const sifreleyici = createCipheriv(ALGORITMA, anahtar(), iv);
  const sifreli = Buffer.concat([
    sifreleyici.update(duzMetin, "utf8"),
    sifreleyici.final(),
  ]);
  const etiket = sifreleyici.getAuthTag();

  return [
    SURUM,
    iv.toString("base64"),
    etiket.toString("base64"),
    sifreli.toString("base64"),
  ].join(":");
}

/**
 * Şifreli metni çözer.
 *
 * Çözülemezse (anahtar değişmiş, kayıt bozulmuş) `null` döner ve hata
 * FIRLATMAZ: ayar sayfası bu durumda "parolayı yeniden girin" der. Bir
 * ayarın okunamaması yüzünden bütün sayfanın çökmesi doğru davranış olmazdı.
 */
export function coz(sifreliMetin: string | null | undefined): string | null {
  if (!sifreliMetin) return null;

  const parcalar = sifreliMetin.split(":");
  if (parcalar.length !== 4 || parcalar[0] !== SURUM) return null;

  try {
    const [, ivB64, etiketB64, veriB64] = parcalar;
    const cozucu = createDecipheriv(ALGORITMA, anahtar(), Buffer.from(ivB64, "base64"));
    cozucu.setAuthTag(Buffer.from(etiketB64, "base64"));
    return Buffer.concat([
      cozucu.update(Buffer.from(veriB64, "base64")),
      cozucu.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Arayüzde parolayı göstermeden "tanımlı mı?" bilgisini vermek için. */
export function maskele(sifreliMetin: string | null | undefined): string {
  return sifreliMetin ? "••••••••" : "";
}
