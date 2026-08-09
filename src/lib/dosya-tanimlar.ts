/**
 * Dosya eki kuralları — saf (Faz 17 / A1).
 *
 * `server-only` DEĞİLDİR: sunucudaki yükleme kapısı, istemcideki form ve
 * testler aynı sınırları paylaşır. Kullanıcıya "10 MB" yazıp sunucuda 5 MB'ta
 * kesmek, kuralın iki yerde ayrı yazılmasının klasik sonucudur.
 */

/** Tek dosya için üst sınır (bayt). Karar: 10 MB (v1.17.0). */
export const AZAMI_DOSYA_BAYT = 10 * 1024 * 1024;

/** Kiracı başına varsayılan kota (MB). `Tenant.dosyaKotaMb` bunu geçersiz kılar. */
export const VARSAYILAN_KOTA_MB = 2048;

/** Görseller bu genişliğe küçültülür; daha büyüğü ekranda işe yaramaz. */
export const AZAMI_GORSEL_GENISLIK = 1600;

export type DosyaTuru = {
  mime: string;
  uzanti: string;
  etiket: string;
  gorsel: boolean;
};

/**
 * İZİN VERİLEN TÜRLER.
 *
 * Beyaz liste, kara liste DEĞİL: "şunlar yasak" yaklaşımı her yeni tehlikeli
 * türde güncelleme ister ve unutulan bir tür açık kapı bırakır.
 */
export const DOSYA_TURLERI: DosyaTuru[] = [
  { mime: "image/jpeg", uzanti: "jpg", etiket: "JPEG görsel", gorsel: true },
  { mime: "image/png", uzanti: "png", etiket: "PNG görsel", gorsel: true },
  { mime: "image/webp", uzanti: "webp", etiket: "WebP görsel", gorsel: true },
  { mime: "image/gif", uzanti: "gif", etiket: "GIF görsel", gorsel: true },
  { mime: "application/pdf", uzanti: "pdf", etiket: "PDF belge", gorsel: false },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uzanti: "docx",
    etiket: "Word belgesi",
    gorsel: false,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uzanti: "xlsx",
    etiket: "Excel dosyası",
    gorsel: false,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    uzanti: "pptx",
    etiket: "PowerPoint sunumu",
    gorsel: false,
  },
  { mime: "text/plain", uzanti: "txt", etiket: "Metin dosyası", gorsel: false },
  { mime: "text/csv", uzanti: "csv", etiket: "CSV dosyası", gorsel: false },
];

export function turBul(mime: string): DosyaTuru | undefined {
  return DOSYA_TURLERI.find((t) => t.mime === mime);
}

/** Form girdisinin `accept` değeri — tarayıcı seçiciyi baştan süzsün. */
export const KABUL_EDILEN = DOSYA_TURLERI.map((t) => `.${t.uzanti}`).join(",");

// ── İçerik imzaları ────────────────────────────────────────────────────────

function baslarMi(bayt: Uint8Array, imza: number[], konum = 0): boolean {
  if (bayt.length < konum + imza.length) return false;
  return imza.every((b, i) => bayt[konum + i] === b);
}

/**
 * Dosyanın GERÇEK türünü içerikten belirler.
 *
 * UZANTIYA BAKILMAZ: `.jpg` uzantılı bir çalıştırılabilir dosya, uzantıya
 * güvenen bir sistemde sunucuya girer ve tarayıcıya görsel diye sunulur.
 * İmza eşleşmezse dosya reddedilir.
 *
 * ZIP TABANLI OFİS BELGELERİ tek bir imzayı paylaşır (`PK\x03\x04`); docx,
 * xlsx ve pptx ayrımı imzadan YAPILAMAZ. Bu yüzden içerik "zip kapsayıcı"
 * olarak doğrulanır, etiket ise uzantıdan seçilir — uzantı burada güvenlik
 * kararı değil, yalnızca gösterim kararıdır.
 */
export function turTespit(bayt: Uint8Array, uzantiIpucu = ""): string | null {
  if (baslarMi(bayt, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (baslarMi(bayt, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (baslarMi(bayt, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (baslarMi(bayt, [0x52, 0x49, 0x46, 0x46]) && baslarMi(bayt, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (baslarMi(bayt, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";

  if (baslarMi(bayt, [0x50, 0x4b, 0x03, 0x04])) {
    const u = uzantiIpucu.toLowerCase();
    const tur = DOSYA_TURLERI.find((t) => t.uzanti === u && t.mime.includes("openxmlformats"));
    return tur ? tur.mime : null;
  }

  // Metin: yazdırılabilir olmalı. NUL baytı olan bir dosya metin değildir ve
  // "text/plain" etiketiyle sunulmamalıdır.
  if (metinMi(bayt)) {
    return uzantiIpucu.toLowerCase() === "csv" ? "text/csv" : "text/plain";
  }

  return null;
}

/** İlk 512 baytta NUL yoksa ve UTF-8 çözülüyorsa metin sayılır. */
export function metinMi(bayt: Uint8Array): boolean {
  const ornek = bayt.subarray(0, 512);
  if (ornek.length === 0) return false;
  for (const b of ornek) if (b === 0) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(ornek);
    return true;
  } catch {
    return false;
  }
}

// ── Adlandırma ve sınırlar ─────────────────────────────────────────────────

/**
 * Kullanıcının verdiği adı GÖSTERİM için temizler.
 *
 * Diskteki ad bu DEĞİLDİR (kayıt id'si kullanılır): dizin gezinme (`../`),
 * çakışma ve karakter kodlaması sorunlarının hiçbiri diske ulaşmasın.
 */
export function guvenliAd(ad: string): string {
  const temiz = ad
    .replace(/[\r\n\t]/g, " ")
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (temiz || "dosya").slice(0, 180);
}

export function uzantiAl(ad: string): string {
  const nokta = ad.lastIndexOf(".");
  if (nokta < 0 || nokta === ad.length - 1) return "";
  return ad.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Diskteki göreli yol: `<tenantId>/<yyyy-mm>/<id>.<uzanti>` */
export function depoYolu(tenantId: string, id: string, uzanti: string, an = new Date()): string {
  const ay = `${an.getFullYear()}-${String(an.getMonth() + 1).padStart(2, "0")}`;
  return `${tenantId}/${ay}/${id}.${uzanti}`;
}

export function boyutMetni(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

export type KotaDurumu = {
  kullanilanBayt: number;
  kotaBayt: number;
  yuzde: number;
  doluMu: boolean;
};

export function kotaDurumu(kullanilanBayt: number, kotaMb: number): KotaDurumu {
  const kotaBayt = Math.max(0, kotaMb) * 1024 * 1024;
  return {
    kullanilanBayt,
    kotaBayt,
    yuzde: kotaBayt > 0 ? Math.min(100, Math.round((kullanilanBayt / kotaBayt) * 100)) : 0,
    doluMu: kotaBayt > 0 && kullanilanBayt >= kotaBayt,
  };
}

/**
 * Yükleme kabul edilebilir mi? Hata metni KULLANICIYA gösterilir.
 *
 * Kota kontrolü yüklemeden ÖNCE yapılır: diski doldurup sonra silmek,
 * eşzamanlı iki yüklemede kotanın aşılmasına izin verirdi.
 */
export function yuklemeKontrol(
  boyut: number,
  mime: string | null,
  kullanilanBayt: number,
  kotaMb: number
): { ok: true } | { ok: false; hata: string } {
  if (boyut <= 0) return { ok: false, hata: "Dosya boş." };
  if (boyut > AZAMI_DOSYA_BAYT) {
    return {
      ok: false,
      hata: `Dosya çok büyük (${boyutMetni(boyut)}). Üst sınır ${boyutMetni(AZAMI_DOSYA_BAYT)}.`,
    };
  }
  if (!mime || !turBul(mime)) {
    return {
      ok: false,
      hata: "Bu dosya türü kabul edilmiyor. Görsel, PDF, Office belgesi ya da metin dosyası yükleyin.",
    };
  }
  const kota = kotaDurumu(kullanilanBayt + boyut, kotaMb);
  if (kota.kotaBayt > 0 && kullanilanBayt + boyut > kota.kotaBayt) {
    return {
      ok: false,
      hata: `Kuruluş dosya kotası dolu (${kotaMb} MB). Yer açmak için eski ekleri silin.`,
    };
  }
  return { ok: true };
}
