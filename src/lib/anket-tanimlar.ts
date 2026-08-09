/**
 * Anket kuralları — saf (Faz 19 / N1, N3, N4).
 *
 * `server-only` DEĞİLDİR: tanım ekranı, oturumsuz yanıt sayfası, rapor ve
 * testler aynı kuralları paylaşır. Yanıt doğrulaması hem istemcide (kibarlık)
 * hem sunucuda (asıl kontrol) buradan gelir.
 */

export const ANKET_DURUM = ["taslak", "yayinda", "kapandi"] as const;
export type AnketDurumu = (typeof ANKET_DURUM)[number];

export type SoruTipi = {
  deger: string;
  etiket: string;
  aciklama: string;
  /** Seçenek listesi gerektirir mi? */
  secenekli: boolean;
  /** Sayısal ortalama/NPS hesabına girer mi? */
  sayisal: boolean;
};

export const SORU_TIPLERI: SoruTipi[] = [
  {
    deger: "metin",
    etiket: "Serbest metin",
    aciklama: "Açık uçlu yanıt",
    secenekli: false,
    sayisal: false,
  },
  {
    deger: "coktan",
    etiket: "Çoktan seçmeli",
    aciklama: "Tanımlı seçeneklerden biri",
    secenekli: true,
    sayisal: false,
  },
  {
    deger: "olcek5",
    etiket: "Ölçek 1-5",
    aciklama: "Memnuniyet puanı",
    secenekli: false,
    sayisal: true,
  },
  {
    deger: "olcek10",
    etiket: "Ölçek 0-10 (NPS)",
    aciklama: "Tavsiye skoru — NPS bu sorudan hesaplanır",
    secenekli: false,
    sayisal: true,
  },
  {
    deger: "evethayir",
    etiket: "Evet / Hayır",
    aciklama: "İki seçenekli",
    secenekli: false,
    sayisal: false,
  },
];

export function soruTipi(tip: string): SoruTipi | undefined {
  return SORU_TIPLERI.find((t) => t.deger === tip);
}

/** Ölçek sorusunun geçerli değer aralığı. */
export function olcekAraligi(tip: string): { min: number; max: number } | null {
  if (tip === "olcek5") return { min: 1, max: 5 };
  if (tip === "olcek10") return { min: 0, max: 10 };
  return null;
}

export type SoruTanimi = {
  id: string;
  tip: string;
  metin: string;
  secenekler: string[];
  zorunlu: boolean;
};

/**
 * Tek bir yanıtı doğrular.
 *
 * ÇOKTAN SEÇMELİ YANIT, TANIMDAKİ SEÇENEKLERLE karşılaştırılır: istemciden
 * gelen değere güvenilmez (özel alanlardaki aynı kural, Faz 11). Aksi halde
 * rapor kırılımı, kimsenin sormadığı bir seçenekle dolardı.
 */
export function yanitDogrula(
  soru: SoruTanimi,
  ham: string
): { ok: true; deger: string } | { ok: false; hata: string } {
  const deger = (ham ?? "").trim();

  if (!deger) {
    return soru.zorunlu
      ? { ok: false, hata: `"${soru.metin}" sorusu zorunludur.` }
      : { ok: true, deger: "" };
  }

  const aralik = olcekAraligi(soru.tip);
  if (aralik) {
    const sayi = Number(deger);
    if (!Number.isInteger(sayi) || sayi < aralik.min || sayi > aralik.max) {
      return {
        ok: false,
        hata: `"${soru.metin}" için ${aralik.min}-${aralik.max} arası bir değer seçin.`,
      };
    }
    return { ok: true, deger: String(sayi) };
  }

  if (soru.tip === "evethayir") {
    if (deger !== "evet" && deger !== "hayir") {
      return { ok: false, hata: `"${soru.metin}" için evet ya da hayır seçin.` };
    }
    return { ok: true, deger };
  }

  if (soru.tip === "coktan") {
    if (!soru.secenekler.includes(deger)) {
      return { ok: false, hata: `"${soru.metin}" için listedeki bir seçeneği işaretleyin.` };
    }
    return { ok: true, deger };
  }

  // Serbest metin: uzunluk sınırı, yoksa tek yanıt veritabanını şişirebilir.
  return { ok: true, deger: deger.slice(0, 2000) };
}

/**
 * Anket şu anda yanıtlanabilir mi?
 *
 * ÜÇ AYRI KAPI vardır ve üçü de ayrı gerekçelidir: anket yayında olmalı,
 * süresi dolmamış olmalı, bağlantı daha önce kullanılmamış olmalı. Hepsi
 * ayrı bir mesaj üretir — "bağlantı geçersiz" demek, süresi dolmuş bir
 * anketi teknik bir hata gibi gösterirdi.
 */
export type YanitlanabilirSonuc =
  | { ok: true }
  | { ok: false; sebep: "taslak" | "kapandi" | "suredoldu" | "yanitlandi"; mesaj: string };

export function yanitlanabilirMi(
  anket: { durum: string; bitisTarihi: Date | null },
  gonderim: { yanitTarihi: Date | null },
  an = new Date()
): YanitlanabilirSonuc {
  if (anket.durum === "taslak") {
    return { ok: false, sebep: "taslak", mesaj: "Bu anket henüz yayında değil." };
  }
  if (anket.durum === "kapandi") {
    return { ok: false, sebep: "kapandi", mesaj: "Bu anket kapanmıştır." };
  }
  if (anket.bitisTarihi && anket.bitisTarihi < an) {
    return {
      ok: false,
      sebep: "suredoldu",
      mesaj: "Bu anketin yanıtlama süresi dolmuştur.",
    };
  }
  if (gonderim.yanitTarihi) {
    return {
      ok: false,
      sebep: "yanitlandi",
      mesaj: "Bu anketi daha önce yanıtladınız. Katkınız için teşekkürler.",
    };
  }
  return { ok: true };
}

// ── Rapor hesapları ────────────────────────────────────────────────────────

export type SoruOzeti = {
  soruId: string;
  metin: string;
  tip: string;
  yanitSayisi: number;
  /** Ölçek sorularında ortalama; diğerlerinde null. */
  ortalama: number | null;
  /** Seçenek/değer bazında dağılım, çoktan aza. */
  dagilim: { deger: string; adet: number }[];
};

export function soruOzeti(
  soru: { id: string; metin: string; tip: string },
  yanitlar: { soruId: string; deger: string }[]
): SoruOzeti {
  const kendi = yanitlar.filter((y) => y.soruId === soru.id && y.deger !== "");
  const sayisal = soruTipi(soru.tip)?.sayisal ?? false;

  const dagilim = new Map<string, number>();
  let toplam = 0;
  for (const y of kendi) {
    dagilim.set(y.deger, (dagilim.get(y.deger) ?? 0) + 1);
    if (sayisal) toplam += Number(y.deger);
  }

  return {
    soruId: soru.id,
    metin: soru.metin,
    tip: soru.tip,
    yanitSayisi: kendi.length,
    ortalama:
      sayisal && kendi.length > 0
        ? Math.round((toplam / kendi.length) * 10) / 10
        : null,
    dagilim: [...dagilim]
      .map(([deger, adet]) => ({ deger, adet }))
      // Ölçek sorularında sıralama SAYISAL olmalı: "10" metin olarak "2"den
      // önce gelirdi ve grafik anlamsız çıkardı.
      .sort((a, b) =>
        sayisal ? Number(a.deger) - Number(b.deger) : b.adet - a.adet
      ),
  };
}

export type NpsSonucu = {
  toplam: number;
  destekci: number;
  notr: number;
  kotuleyen: number;
  /** −100 ile +100 arası. Yanıt yoksa null. */
  skor: number | null;
};

/**
 * Net Tavsiye Skoru (NPS) — 0-10 ölçeğinden.
 *
 * Standart eşikler kullanılır: 9-10 destekçi, 7-8 nötr, 0-6 kötüleyen.
 * Skor = %destekçi − %kötüleyen. Nötrler paydaya girer ama skoru
 * doğrudan etkilemez — NPS'in tanımı budur ve "kendi eşiğimizi koyalım"
 * demek, rakamı sektör ortalamasıyla kıyaslanamaz hâle getirirdi.
 */
export function npsHesapla(degerler: number[]): NpsSonucu {
  let destekci = 0;
  let notr = 0;
  let kotuleyen = 0;

  for (const d of degerler) {
    if (d >= 9) destekci++;
    else if (d >= 7) notr++;
    else kotuleyen++;
  }

  const toplam = degerler.length;
  return {
    toplam,
    destekci,
    notr,
    kotuleyen,
    skor:
      toplam > 0
        ? Math.round(((destekci - kotuleyen) / toplam) * 100)
        : null,
  };
}

/** Yanıtlama oranı: yanıtlayan gönderim / gönderilen. */
export function yanitOrani(gonderilen: number, yanitlayan: number): number | null {
  if (gonderilen <= 0) return null;
  return Math.round((yanitlayan / gonderilen) * 1000) / 10;
}
