/**
 * Hesap güvenliği — TANIMLAR (Faz 12 / F1-F4).
 *
 * `server-only` DEĞİLDİR ve bilinçli olarak `node:crypto` İÇERMEZ: bu dosya
 * istemci bileşenlerine de girer (şifre politikası metni, saklama etiketleri).
 * Kriptografi gerektiren TOTP ve yedek kod üretimi `guvenlik-totp.ts`
 * içindedir — o dosya yalnızca sunucudan ve testlerden çağrılır.
 */

// ── F1: Şifre politikası ───────────────────────────────────────────────────

export const SIFRE_ASGARI_UZUNLUK = 10;

/**
 * Yaygın parolalar — tek başına uzunluk yetmez, "Parola1234" kuralları geçer
 * ama saldırganın ilk denemesidir. Liste kısadır ve bilinçlidir: amaç eksiksiz
 * bir sözlük değil, en bariz seçimleri elemektir.
 */
const YAYGIN_PAROLALAR = [
  "password", "parola", "sifre", "123456", "12345678", "qwerty", "asdasd",
  "admin", "gezegen", "crm", "iloveyou", "welcome", "abc123", "1q2w3e4r",
];

export type SifreSonucu = { ok: true } | { ok: false; hata: string };

/**
 * Şifre politikası — TÜM şifre belirleme noktalarında aynı kural geçerlidir
 * (davet kabulü, şifre sıfırlama, yönetici sıfırlaması, profil değişikliği).
 * Tek yerde tutulmasının sebebi budur: bir kapıda gevşek kural, politikanın
 * tamamını hükümsüz kılar.
 */
export function sifreDogrula(sifre: string, email?: string): SifreSonucu {
  if (sifre.length < SIFRE_ASGARI_UZUNLUK) {
    return { ok: false, hata: `Şifre en az ${SIFRE_ASGARI_UZUNLUK} karakter olmalıdır.` };
  }
  if (sifre.length > 200) {
    return { ok: false, hata: "Şifre en fazla 200 karakter olabilir." };
  }
  // DİKKAT: kontrol şifrenin KENDİSİNDE yapılır. Önce küçük harfe çevirip
  // "küçük harf var mı" diye bakmak her şifreyi geçirirdi (bir kez yaşandı).
  if (!/[a-zçğıöşü]/.test(sifre) || !/[A-ZÇĞİÖŞÜ]/.test(sifre)) {
    return { ok: false, hata: "Şifre hem büyük hem küçük harf içermelidir." };
  }
  if (!/\d/.test(sifre)) {
    return { ok: false, hata: "Şifre en az bir rakam içermelidir." };
  }

  const kucuk = sifre.toLocaleLowerCase("tr");
  if (YAYGIN_PAROLALAR.some((y) => kucuk.includes(y))) {
    return { ok: false, hata: "Şifre çok yaygın bir sözcük içeriyor, başka bir şey seçin." };
  }

  // E-postanın kullanıcı adı kısmı şifrede geçmemeli.
  const kullaniciAdi = (email ?? "").split("@")[0]?.toLocaleLowerCase("tr") ?? "";
  if (kullaniciAdi.length >= 3 && kucuk.includes(kullaniciAdi)) {
    return { ok: false, hata: "Şifre e-posta adresinizi içeremez." };
  }

  return { ok: true };
}

/** Politika metni — arayüzde kullanıcıya gösterilir. */
export const SIFRE_POLITIKA_METNI =
  `En az ${SIFRE_ASGARI_UZUNLUK} karakter; büyük harf, küçük harf ve rakam içermeli. ` +
  `Yaygın parolalar ve e-posta adresiniz kabul edilmez.`;

/** Şifre yaşı politikası: 0 = süresiz. */
export function sifreEskidiMi(guncellendi: Date | null, azamiGun: number): boolean {
  if (azamiGun <= 0 || !guncellendi) return false;
  const gun = (Date.now() - guncellendi.getTime()) / 86_400_000;
  return gun > azamiGun;
}

// ── F4: Hız sınırlama ──────────────────────────────────────────────────────

/** Kilit eşikleri. Kilit KISA sürelidir: amaç engellemek değil yavaşlatmaktır. */
export const KILIT_ESIGI = 5; // ardışık başarısız deneme
export const KILIT_DAKIKA = 15;
/** Aynı IP'den bir saatte kabul edilen azami başarısız deneme. */
export const IP_SAATLIK_SINIR = 30;
/** Bir hesap için bir saatte açılabilecek azami şifre sıfırlama isteği. */
export const SIFIRLAMA_SAATLIK_SINIR = 3;

export function kilitliMi(kilitBitis: Date | null, simdi: Date = new Date()): boolean {
  return !!kilitBitis && kilitBitis.getTime() > simdi.getTime();
}

export function kalanKilitDakika(kilitBitis: Date | null, simdi: Date = new Date()): number {
  if (!kilitliMi(kilitBitis, simdi)) return 0;
  return Math.max(1, Math.ceil((kilitBitis!.getTime() - simdi.getTime()) / 60_000));
}

/**
 * Başarısız denemeden sonraki yeni sayaç ve kilit bitişi.
 * Eşiğe ulaşan hesap kilitlenir ve sayaç sıfırlanır — kilit süresi dolunca
 * kullanıcı yeniden tam hakla başlar.
 */
export function basarisizSonrasi(
  mevcutSayac: number,
  simdi: Date = new Date()
): { sayac: number; kilitBitis: Date | null } {
  const sayac = mevcutSayac + 1;
  if (sayac >= KILIT_ESIGI) {
    return { sayac: 0, kilitBitis: new Date(simdi.getTime() + KILIT_DAKIKA * 60_000) };
  }
  return { sayac, kilitBitis: null };
}

// ── Base32 (saf — TOTP sırları bu alfabeyle yazılır) ──────────────────────

const BASE32_ALFABE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIYOT = 30; // saniye
export const TOTP_BASAMAK = 6;
/** Saat kaymasına tolerans: ±1 pencere (±30 sn). */
export const TOTP_PENCERE = 1;

export function base32Kodla(veri: Buffer): string {
  let bit = 0;
  let deger = 0;
  let cikti = "";
  for (const bayt of veri) {
    deger = (deger << 8) | bayt;
    bit += 8;
    while (bit >= 5) {
      cikti += BASE32_ALFABE[(deger >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) cikti += BASE32_ALFABE[(deger << (5 - bit)) & 31];
  return cikti;
}

export function base32Coz(metin: string): Buffer {
  const temiz = metin.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bit = 0;
  let deger = 0;
  const baytlar: number[] = [];
  for (const karakter of temiz) {
    const indeks = BASE32_ALFABE.indexOf(karakter);
    if (indeks === -1) continue;
    deger = (deger << 5) | indeks;
    bit += 5;
    if (bit >= 8) {
      baytlar.push((deger >>> (bit - 8)) & 255);
      bit -= 8;
    }
  }
  return Buffer.from(baytlar);
}

// ── Cihaz özeti (oturum listesi) ───────────────────────────────────────────

/**
 * User-Agent'tan okunabilir bir özet çıkarır ("Chrome · macOS").
 * Ham User-Agent saklamak KVKK açısından gereksiz bir ayrıntıdır; kullanıcının
 * "bu oturum benim mi?" sorusuna yanıt verecek kadarı yeterlidir.
 */
export function cihazOzeti(ua: string | null | undefined): string {
  if (!ua) return "Bilinmeyen cihaz";

  const tarayici =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /Firefox\//.test(ua) ? "Firefox" :
    "Tarayıcı";

  const isletim =
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" :
    "";

  return isletim ? `${tarayici} · ${isletim}` : tarayici;
}
