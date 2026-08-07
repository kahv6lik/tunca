/**
 * Kiracıya özel alanlar — TANIMLAR ve SAF mantık (Faz 11 / E6).
 *
 * Bu dosya bilinçli olarak `server-only` DEĞİLDİR: tip listesi ve
 * doğrulama/ayrıştırma buradadır ki istemci bileşenleri etiketleri, testler
 * de mantığı veritabanı olmadan kullanabilsin. Veri erişimi `ozel-alan.ts`
 * içindedir (o server-only'dir).
 *
 * Değer HER ZAMAN String saklanır; tip yalnızca doğrulama ve gösterim
 * içindir. Bu, constants.ts'teki "enum yerine String" tercihinin devamıdır:
 * yeni tip eklemek migration gerektirmez.
 */

// ── Varlıklar ──────────────────────────────────────────────────────────────
// Özel alan eklenebilen kayıt türleri. Yeni varlık eklemek: buraya + şemaya
// (OzelAlanDeger'e FK sütunu) + ilgili form/detay sayfasına dokunmak demektir.
export const OZEL_ALAN_VARLIKLARI = ["firma", "kisi", "firsat"] as const;
export type OzelAlanVarligi = (typeof OZEL_ALAN_VARLIKLARI)[number];

export const VARLIK_ETIKET: Record<OzelAlanVarligi, string> = {
  firma: "Firma",
  kisi: "Kişi",
  firsat: "Fırsat",
};

// ── Tipler ─────────────────────────────────────────────────────────────────
export const OZEL_ALAN_TIPLERI = ["metin", "sayi", "tarih", "secim", "onay"] as const;
export type OzelAlanTipi = (typeof OZEL_ALAN_TIPLERI)[number];

export const TIP_ETIKET: Record<OzelAlanTipi, string> = {
  metin: "Metin",
  sayi: "Sayı",
  tarih: "Tarih",
  secim: "Seçim listesi",
  onay: "Onay kutusu",
};

/** Form ve doğrulamada kullanılan alan tanımı (Prisma satırının alt kümesi). */
export type OzelAlanTanimi = {
  id: string;
  varlik: string;
  ad: string;
  tip: string;
  secenekler: string[];
  zorunlu: boolean;
  sira: number;
};

/** Formdaki girdi adı: "oa_<alanId>". Filtre parametresi de aynı adı taşır. */
export function ozelAlanGirdiAdi(alanId: string): string {
  return `oa_${alanId}`;
}

// ── Doğrulama ──────────────────────────────────────────────────────────────

export type DegerSonucu =
  | { ok: true; deger: string } // boş değer "" olarak döner (satır yazılmaz)
  | { ok: false; hata: string };

/**
 * Tek bir alan için ham form değerini doğrular ve saklanacak hâle getirir.
 *
 * - sayı: TR virgülü kabul edilir ("12,5" → "12.5")
 * - tarih: YYYY-AA-GG (date input'un ürettiği biçim) ve geçerli bir gün olmalı
 * - seçim: tanımlı seçeneklerden biri olmalı — istemciden gelen listeye
 *   güvenilmez, sunucu tanımdan kontrol eder
 * - onay: işaretliyse "1", değilse boş (satır yazılmaz)
 */
export function degerDogrula(alan: OzelAlanTanimi, ham: string): DegerSonucu {
  const deger = ham.trim();

  if (!deger) {
    if (alan.zorunlu && alan.tip !== "onay") {
      return { ok: false, hata: `"${alan.ad}" alanı zorunludur.` };
    }
    return { ok: true, deger: "" };
  }
  if (deger.length > 500) {
    return { ok: false, hata: `"${alan.ad}" en fazla 500 karakter olabilir.` };
  }

  switch (alan.tip) {
    case "sayi": {
      const normal = deger.replace(",", ".");
      if (!/^-?\d+(\.\d+)?$/.test(normal)) {
        return { ok: false, hata: `"${alan.ad}" sayı olmalıdır.` };
      }
      return { ok: true, deger: normal };
    }
    case "tarih": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deger) || isNaN(Date.parse(deger))) {
        return { ok: false, hata: `"${alan.ad}" geçerli bir tarih olmalıdır.` };
      }
      return { ok: true, deger };
    }
    case "secim": {
      if (!alan.secenekler.includes(deger)) {
        return { ok: false, hata: `"${alan.ad}" için geçersiz seçenek.` };
      }
      return { ok: true, deger };
    }
    case "onay":
      return { ok: true, deger: deger === "1" ? "1" : "" };
    default:
      return { ok: true, deger };
  }
}

export type FormDegerleri =
  | { ok: true; degerler: Map<string, string> } // alanId → deger ("" dahil: silinecek)
  | { ok: false; hata: string };

/**
 * Formdan gelen özel alan girdilerini tanım listesine göre ayrıştırır.
 *
 * Tanımda OLMAYAN "oa_*" anahtarları sessizce yok sayılır — istemci, tanımlı
 * olmayan bir alana değer yazdıramaz. İlk hata bütün kaydı durdurur: yarım
 * doğrulanmış özel alan seti yazılmaz.
 */
export function formdanDegerler(
  alanlar: OzelAlanTanimi[],
  formData: FormData
): FormDegerleri {
  const degerler = new Map<string, string>();

  for (const alan of alanlar) {
    const ham = formData.get(ozelAlanGirdiAdi(alan.id));
    const sonuc = degerDogrula(alan, typeof ham === "string" ? ham : "");
    if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
    degerler.set(alan.id, sonuc.deger);
  }

  return { ok: true, degerler };
}

// ── Gösterim ───────────────────────────────────────────────────────────────

/** Saklanan değeri okunur hâle getirir (detay sayfaları ve dışa aktarım). */
export function degerBicimle(alan: OzelAlanTanimi, deger: string): string {
  if (!deger) return "";
  switch (alan.tip) {
    case "onay":
      return deger === "1" ? "Evet" : "Hayır";
    case "tarih": {
      const [y, a, g] = deger.split("-");
      return y && a && g ? `${g}.${a}.${y}` : deger;
    }
    case "sayi":
      return deger.replace(".", ",");
    default:
      return deger;
  }
}

/**
 * RecordForm tabanlı formlar (kişi ekleme/düzenleme) için alan tanımını
 * `Field` biçimine çevirir. Yapısal tiptir; RecordForm'a import bağımlılığı
 * bilinçli olarak yoktur (bu dosya istemciye de girer).
 */
export function alanFieldTanimi(
  alan: OzelAlanTanimi,
  deger?: string
): {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  step?: string;
} {
  const ortak = {
    name: ozelAlanGirdiAdi(alan.id),
    label: alan.ad,
    required: alan.zorunlu,
    defaultValue: deger ?? "",
  };
  switch (alan.tip) {
    case "sayi":
      return { ...ortak, type: "number", step: "any" };
    case "tarih":
      return { ...ortak, type: "date" };
    case "secim":
      return {
        ...ortak,
        type: "select",
        options: [
          { value: "", label: "Seçiniz…" },
          ...alan.secenekler.map((s) => ({ value: s, label: s })),
        ],
      };
    case "onay":
      return {
        ...ortak,
        type: "select",
        required: false, // "Hayır" da geçerli bir yanıttır
        options: [
          { value: "", label: "Hayır" },
          { value: "1", label: "Evet" },
        ],
      };
    default:
      return { ...ortak, type: "text" };
  }
}

/** Alan adı doğrulaması (tanımlama ekranı). */
export function alanAdiDogrula(ad: string): string | null {
  const temiz = ad.trim();
  if (!temiz) return "Alan adı zorunludur.";
  if (temiz.length > 60) return "Alan adı en fazla 60 karakter olabilir.";
  return null;
}

/**
 * Seçenek listesini ayrıştırır (satır başına bir seçenek).
 * Boş satırlar ve kopyalar atılır; 30 seçenek sınırı vardır.
 */
export function secenekleriAyristir(ham: string): string[] {
  const görülen = new Set<string>();
  const sonuc: string[] = [];
  for (const satir of ham.split("\n")) {
    const s = satir.trim();
    if (!s || s.length > 100 || görülen.has(s)) continue;
    görülen.add(s);
    sonuc.push(s);
    if (sonuc.length >= 30) break;
  }
  return sonuc;
}
