import type { TarihAraligi } from "./tarih-araligi";

/**
 * Rapor hesapları — saf (Faz 18 / R2, R3).
 *
 * `server-only` DEĞİLDİR: rapor sayfaları ve testler aynı hesabı paylaşır.
 * Ekranda görünen her oran burada hesaplanır; sayfa yalnızca çizer.
 */

// ── Dönem karşılaştırması ──────────────────────────────────────────────────

export type DonemFarki = {
  simdi: number;
  onceki: number;
  fark: number;
  /** Yüzde değişim; önceki dönem sıfırsa `null` (bölme yok). */
  yuzde: number | null;
  yon: "artis" | "azalis" | "sabit";
};

/**
 * İki dönemi karşılaştırır.
 *
 * ÖNCEKİ DÖNEM SIFIRSA YÜZDE ÜRETİLMEZ. "0'dan 5'e %500 artış" gibi bir
 * rakam matematiksel olarak tanımsız, kullanıcı için de yanıltıcıdır;
 * arayüz bu durumda "yeni" der.
 */
export function donemKarsilastir(simdi: number, onceki: number): DonemFarki {
  const fark = simdi - onceki;
  return {
    simdi,
    onceki,
    fark,
    yuzde: onceki > 0 ? Math.round((fark / onceki) * 1000) / 10 : null,
    yon: fark > 0 ? "artis" : fark < 0 ? "azalis" : "sabit",
  };
}

/**
 * Seçili aralığın AYNI UZUNLUKTAKİ bir önceki dönemini üretir.
 *
 * "Geçen ay" gibi sabit bir tanım kullanılmaz: kullanıcı 10 günlük bir
 * aralık seçtiyse karşılaştırma da önceki 10 gün olmalıdır, yoksa oran
 * anlamsızlaşır.
 *
 * Aralık açık uçluysa (yalnızca başlangıç ya da yalnızca bitiş) karşılaştırma
 * YAPILAMAZ ve `null` döner — uydurma bir dönem üretmek yanlış bir oran
 * göstermekten kötüdür.
 */
export function oncekiDonem(aralik?: TarihAraligi): TarihAraligi | null {
  if (!aralik?.gte || !aralik?.lte) return null;
  const uzunluk = aralik.lte.getTime() - aralik.gte.getTime();
  if (uzunluk <= 0) return null;
  return {
    gte: new Date(aralik.gte.getTime() - uzunluk - 1),
    lte: new Date(aralik.gte.getTime() - 1),
  };
}

// ── Oranlar ────────────────────────────────────────────────────────────────

/** Yüzde oranı (0–100). Payda sıfırsa `null`. */
export function oran(pay: number, payda: number): number | null {
  if (payda <= 0) return null;
  return Math.round((pay / payda) * 1000) / 10;
}

export function oranMetni(deger: number | null): string {
  return deger === null ? "—" : `%${deger.toLocaleString("tr-TR")}`;
}

// ── Satış hattı ────────────────────────────────────────────────────────────

export type HatOzeti = {
  toplam: number;
  acik: number;
  kazanilan: number;
  kaybedilen: number;
  /** Kapanmış işler içinde kazanılanların oranı. */
  donusumOrani: number | null;
  acikTutar: number;
  kazanilanTutar: number;
  /** Açık fırsatların olasılıkla ağırlıklı toplamı. */
  beklenenCiro: number;
};

/**
 * Fırsat hattı özeti.
 *
 * DÖNÜŞÜM ORANI KAPANMIŞ İŞLER ÜZERİNDEN hesaplanır: hâlâ açık olan bir
 * fırsat henüz kaybedilmedi, onu paydaya koymak oranı sürekli düşük
 * gösterirdi ("hattı doldurdukça başarın düşüyor" gibi yanlış bir okuma).
 */
export function hatOzeti(
  firsatlar: { durum: string; tutar: number; olasilik: number }[]
): HatOzeti {
  let acik = 0;
  let kazanilan = 0;
  let kaybedilen = 0;
  let acikTutar = 0;
  let kazanilanTutar = 0;
  let beklenenCiro = 0;

  for (const f of firsatlar) {
    if (f.durum === "kazanildi") {
      kazanilan++;
      kazanilanTutar += f.tutar;
    } else if (f.durum === "kaybedildi") {
      kaybedilen++;
    } else {
      acik++;
      acikTutar += f.tutar;
      beklenenCiro += (f.tutar * f.olasilik) / 100;
    }
  }

  const kapanan = kazanilan + kaybedilen;
  return {
    toplam: firsatlar.length,
    acik,
    kazanilan,
    kaybedilen,
    donusumOrani: oran(kazanilan, kapanan),
    acikTutar,
    kazanilanTutar,
    beklenenCiro: Math.round(beklenenCiro),
  };
}

// ── Mali özet ──────────────────────────────────────────────────────────────

export type MaliOzet = {
  /** Onaylanmış siparişlerin toplamı — gerçekleşen ciro. */
  ciro: number;
  siparisAdedi: number;
  /** Onay bekleyen siparişler: henüz ciro değil, hattaki para. */
  bekleyen: number;
  /** Kabul edilmiş ama siparişe dönmemiş teklifler. */
  kabulEdilenTeklif: number;
  /** Açık fırsatların olasılıkla ağırlıklı toplamı. */
  agirlikliFirsat: number;
  /** Toplam beklenen tahsilat = bekleyen + kabul edilen teklif + ağırlıklı fırsat. */
  beklenenTahsilat: number;
  /** Verilen indirimlerin toplamı (kalem iskontosu + kampanya). */
  indirim: number;
  /** İndirimin brüt tutara oranı. */
  indirimOrani: number | null;
  ortalamaSepet: number;
};

/**
 * Mali özet.
 *
 * "CİRO" = ONAYLANMIŞ SİPARİŞ. Teklif bir niyet, fırsat bir tahmindir;
 * ikisini ciroya saymak rakamı şişirir. Onay anı ise stok ve kampanya
 * kotasının düştüğü andır (Faz 15) — yani kuruluşun taahhüde girdiği an.
 *
 * "BEKLENEN TAHSİLAT" bilinçli olarak bir TAHMİNDİR ve öyle etiketlenir:
 * sistemde ödeme/fatura kaydı yoktur (karar: v1.18.0), bu yüzden "kim ne
 * zaman ödedi" sorusu YANITLANMAZ. Hesap, elde olan veriden türetilir.
 */
export function maliOzet(veri: {
  onayliSiparisler: { toplam: number; indirimTutari: number; araToplam: number }[];
  bekleyenSiparisler: { toplam: number }[];
  kabulEdilenTeklifler: { toplam: number }[];
  acikFirsatlar: { tutar: number; olasilik: number }[];
}): MaliOzet {
  const ciro = veri.onayliSiparisler.reduce((t, s) => t + s.toplam, 0);
  const brut = veri.onayliSiparisler.reduce((t, s) => t + s.araToplam, 0);
  const indirim = veri.onayliSiparisler.reduce((t, s) => t + s.indirimTutari, 0);
  const bekleyen = veri.bekleyenSiparisler.reduce((t, s) => t + s.toplam, 0);
  const kabulEdilenTeklif = veri.kabulEdilenTeklifler.reduce((t, x) => t + x.toplam, 0);
  const agirlikliFirsat = Math.round(
    veri.acikFirsatlar.reduce((t, f) => t + (f.tutar * f.olasilik) / 100, 0)
  );

  return {
    ciro: Math.round(ciro),
    siparisAdedi: veri.onayliSiparisler.length,
    bekleyen: Math.round(bekleyen),
    kabulEdilenTeklif: Math.round(kabulEdilenTeklif),
    agirlikliFirsat,
    beklenenTahsilat: Math.round(bekleyen + kabulEdilenTeklif + agirlikliFirsat),
    indirim: Math.round(indirim),
    indirimOrani: oran(indirim, brut),
    ortalamaSepet:
      veri.onayliSiparisler.length > 0
        ? Math.round(ciro / veri.onayliSiparisler.length)
        : 0,
  };
}

// ── Aktivite yükü ──────────────────────────────────────────────────────────

export type KisiYuku = {
  kullaniciId: string | null;
  toplam: number;
  acikGorev: number;
  geciken: number;
  tamamlanan: number;
};

/**
 * Kişi bazında aktivite yükü.
 *
 * GECİKEN, açık görevlerin ALT KÜMESİDİR (ayrı bir sayı değil): bir görev
 * hem açık hem gecikmiş olabilir ve iki sütunu toplamak yanlış olurdu.
 */
export function aktiviteYuku(
  kayitlar: {
    atananId: string | null;
    sonTarih: Date | null;
    tamamlandi: Date | null;
  }[],
  an = new Date()
): KisiYuku[] {
  const harita = new Map<string | null, KisiYuku>();

  for (const a of kayitlar) {
    const mevcut =
      harita.get(a.atananId) ??
      { kullaniciId: a.atananId, toplam: 0, acikGorev: 0, geciken: 0, tamamlanan: 0 };

    mevcut.toplam++;
    if (a.tamamlandi) {
      mevcut.tamamlanan++;
    } else if (a.sonTarih) {
      mevcut.acikGorev++;
      if (a.sonTarih < an) mevcut.geciken++;
    }
    harita.set(a.atananId, mevcut);
  }

  return [...harita.values()].sort((a, b) => b.toplam - a.toplam);
}

// ── Kırılım yardımcıları ───────────────────────────────────────────────────

/** Anahtar başına toplam üretir, çoktan aza sıralar ve ilk N'i döndürür. */
export function kirilim<T>(
  kayitlar: T[],
  anahtar: (k: T) => string,
  deger: (k: T) => number,
  limit = 10
): { label: string; value: number }[] {
  const toplam = new Map<string, number>();
  for (const k of kayitlar) {
    const a = anahtar(k);
    toplam.set(a, (toplam.get(a) ?? 0) + deger(k));
  }
  return [...toplam]
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
