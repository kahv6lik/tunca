/**
 * Konum hesapları — saf (Faz 17 / A3, A5).
 *
 * `server-only` DEĞİLDİR: doğrulama sunucuda yapılır ama form ve harita
 * bağlantısı istemcide de aynı fonksiyonları kullanır; testler ikisini de
 * veritabanı olmadan sınar.
 */

const DUNYA_YARICAP_M = 6_371_000;

/** Enlem/boylam gerçekten bir koordinat mı? (0,0 Gine Körfezi'dir — kabul edilir) */
export function koordinatGecerliMi(enlem: unknown, boylam: unknown): boolean {
  if (typeof enlem !== "number" || typeof boylam !== "number") return false;
  if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return false;
  return enlem >= -90 && enlem <= 90 && boylam >= -180 && boylam <= 180;
}

/**
 * İki koordinat arasındaki mesafe (metre, haversine).
 *
 * Düz Öklid mesafesi yerine küresel hesap: Türkiye enlemlerinde bir derece
 * boylam ≈ 85 km, bir derece enlem ≈ 111 km. Düz hesap, doğu-batı yönündeki
 * sapmayı %30 fazla göstererek "yerinde" olan bir ziyareti uzak sayardı.
 */
export function mesafeMetre(
  enlem1: number,
  boylam1: number,
  enlem2: number,
  boylam2: number
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dEnlem = rad(enlem2 - enlem1);
  const dBoylam = rad(boylam2 - boylam1);
  const a =
    Math.sin(dEnlem / 2) ** 2 +
    Math.cos(rad(enlem1)) * Math.cos(rad(enlem2)) * Math.sin(dBoylam / 2) ** 2;
  return Math.round(2 * DUNYA_YARICAP_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** Kullanıcının yazdığı "39.925, 32.866" biçimini ayrıştırır. */
export function koordinatAyristir(
  metin: string
): { enlem: number; boylam: number } | null {
  const parcalar = metin
    .replace(/\s+/g, " ")
    .split(/[,; ]/)
    .map((p) => p.trim().replace(",", "."))
    .filter(Boolean);
  if (parcalar.length !== 2) return null;
  const enlem = Number(parcalar[0]);
  const boylam = Number(parcalar[1]);
  return koordinatGecerliMi(enlem, boylam) ? { enlem, boylam } : null;
}

export type DogrulamaDurumu = "dogrulandi" | "uzak" | "alinamadi";

export type DogrulamaSonucu = {
  durum: DogrulamaDurumu;
  mesafeM: number | null;
  aciklama: string;
};

/**
 * Ziyaret konumunu firmanın koordinatıyla karşılaştırır.
 *
 * ÜÇ SONUÇ vardır, iki değil: konum alınamadığında (izin reddi, kapalı GPS,
 * koordinatsız firma) ziyaret "uzak" sayılmaz — teknik bir aksaklık,
 * personeli suçlu duruma düşürmemelidir (karar 4, v1.17.0). Bu durum sarı
 * "doğrulanamadı" olarak işaretlenir ve ziyaret yine de açılır.
 */
export function konumDogrula(
  firma: { enlem: number | null; boylam: number | null },
  konum: { enlem: number | null; boylam: number | null },
  yaricapM: number
): DogrulamaSonucu {
  if (!koordinatGecerliMi(konum.enlem, konum.boylam)) {
    return {
      durum: "alinamadi",
      mesafeM: null,
      aciklama: "Konum alınamadı (izin verilmemiş ya da konum servisi kapalı).",
    };
  }
  if (!koordinatGecerliMi(firma.enlem, firma.boylam)) {
    return {
      durum: "alinamadi",
      mesafeM: null,
      aciklama: "Firmanın kayıtlı konumu yok; karşılaştırma yapılamadı.",
    };
  }

  const mesafe = mesafeMetre(firma.enlem!, firma.boylam!, konum.enlem!, konum.boylam!);
  if (mesafe <= yaricapM) {
    return {
      durum: "dogrulandi",
      mesafeM: mesafe,
      aciklama: `Konum doğrulandı (firmaya ${mesafe} m).`,
    };
  }
  return {
    durum: "uzak",
    mesafeM: mesafe,
    aciklama: `Konum firmadan ${mesafe} m uzakta (izin verilen ${yaricapM} m).`,
  };
}

export const DOGRULAMA_ETIKET: Record<
  DogrulamaDurumu,
  { label: string; className: string }
> = {
  dogrulandi: {
    label: "Konum doğrulandı",
    className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  },
  uzak: {
    label: "Konum uyuşmuyor",
    className: "bg-rose-500/15 text-rose-400 ring-rose-500/25",
  },
  alinamadi: {
    label: "Konum doğrulanamadı",
    className: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  },
};

/**
 * Harita bağlantısı.
 *
 * ANAHTAR GEREKTİRMEZ: koordinatı haritada göstermek için gömülü harita
 * yerine dış bağlantı kullanılır. Gömülü harita her açılışta ücretli bir
 * istek demektir; bağlantı ise bedavadır ve kullanıcının kendi harita
 * uygulamasında (yol tarifi dahil) açılır.
 */
export function haritaBaglantisi(enlem: number, boylam: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${enlem},${boylam}`;
}

/** Süreyi dakikadan okunur metne çevirir ("1 sa 25 dk"). */
export function sureMetniDakika(dakika: number | null): string {
  if (dakika === null || dakika < 0) return "—";
  if (dakika < 60) return `${dakika} dk`;
  const saat = Math.floor(dakika / 60);
  const kalan = dakika % 60;
  return kalan === 0 ? `${saat} sa` : `${saat} sa ${kalan} dk`;
}

/** İki damga arasındaki süre (tam dakika). Ters damgada 0 döner. */
export function sureDakika(baslangic: Date, bitis: Date): number {
  return Math.max(0, Math.round((bitis.getTime() - baslangic.getTime()) / 60_000));
}

// ── Geocoding maliyet koruması (saf kısım) ────────────────────────────────
//
// Bu iki fonksiyon `geocode.ts` içinde DEĞİL burada durur: orası
// `server-only` olduğu için Vitest onu çözemiyor ve maliyet korumasının
// kuralı sınanamaz hâle geliyordu (aynı tuzak firma-no'da yaşandı).

/** Firma alanlarından tek satırlık adres kurar. */
export function adresMetni(firma: {
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
}): string {
  return [firma.adres, firma.ilce, firma.il, "Türkiye"]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Yeni bir geocoding isteği gerekli mi?
 *
 * Koordinat varsa ve adres değişmediyse HAYIR — bu kontrol maliyet
 * korumasının kendisidir, "her kayıtta bir kez daha sorsak ne olur" diye
 * kaldırılmamalıdır.
 */
export function yenidenGerekliMi(
  firma: { enlem: number | null; boylam: number | null; konumAdres: string | null },
  yeniAdres: string
): boolean {
  if (!yeniAdres) return false;
  if (!koordinatGecerliMi(firma.enlem, firma.boylam)) return true;
  return (firma.konumAdres ?? "").trim() !== yeniAdres.trim();
}
