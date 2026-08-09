/**
 * Fırsat ve aday skorlama — Faz 21 / G1 (saf).
 *
 * NEDEN İSTATİSTİK, NEDEN DİL MODELİ DEĞİL:
 *
 * Skor bir satış temsilcisinin gününü sıraya dizer; "bu neden 72?" sorusunun
 * denetlenebilir bir yanıtı olmalıdır. Kiracının KENDİ kapanmış işlerinden
 * çıkarılan oranlar bu yanıtı kendiliğinden verir ("bu sektörde kazanma
 * oranınız %62, ortalamanız %41"), her hesapta aynı sonucu üretir, hiçbir
 * veriyi dışarı çıkarmaz ve hiçbir şeye mal olmaz. Dil modeline sorulan bir
 * skor bunların dördünü de kaybederdi.
 *
 * SKOR SAKLANMAZ, her görüntülemede yeniden hesaplanır: saklanan bir skor
 * veri değiştikçe bayatlar ve "bu rakam ne zamanki hâline ait" sorusunu
 * doğurur.
 *
 * `server-only` DEĞİLDİR: testler veritabanı olmadan doğrudan sınar.
 */

/** Kapanmış bir işin skorlamayı besleyen özeti. */
export type GecmisIs = {
  kazanildi: boolean;
  sektor: string | null;
  tutar: number;
  kaynak: string | null;
};

/** Skoru hesaplanacak açık iş. */
export type AcikIs = {
  sektor: string | null;
  tutar: number;
  kaynak: string | null;
  /** Aşamanın kendi olasılığı (%0-100) — kullanıcı tanımlı. */
  asamaOlasilik: number;
  /** Son aktiviteden bu yana geçen gün; hiç aktivite yoksa null. */
  sonTemasGun: number | null;
  /** Kayıttaki toplam aktivite sayısı. */
  aktiviteSayisi: number;
};

export type SkorEtkeni = {
  etiket: string;
  /** Skora katkı (+/-). */
  katki: number;
  /** Kullanıcıya gösterilen gerekçe cümlesi. */
  aciklama: string;
};

export type Skor = {
  /** 0-100. */
  deger: number;
  /** "yuksek" | "orta" | "dusuk" */
  seviye: string;
  etkenler: SkorEtkeni[];
  /**
   * Skorun dayandığı kapanmış iş sayısı. Az veriyle üretilen skor
   * güvenilmezdir ve ekranda BÖYLE SÖYLENİR — sessizce bir rakam basmak,
   * olmayan bir kesinlik iddiasıdır.
   */
  ornekSayisi: number;
  yeterliVeri: boolean;
};

/** Skorun anlamlı sayılması için gereken en az kapanmış iş sayısı. */
export const EN_AZ_ORNEK = 10;

/** Bir kırılımın (sektör, kaynak) kendi oranını kullanması için gereken en az iş. */
export const KIRILIM_EN_AZ = 5;

export const SKOR_SEVIYE: Record<string, { etiket: string; className: string }> = {
  yuksek: {
    etiket: "Yüksek",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  orta: {
    etiket: "Orta",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  dusuk: {
    etiket: "Düşük",
    className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
};

export function skorSeviyesi(deger: number): string {
  if (deger >= 65) return "yuksek";
  if (deger >= 40) return "orta";
  return "dusuk";
}

function yuzde(pay: number, payda: number): number {
  return payda === 0 ? 0 : (pay / payda) * 100;
}

/** Bir alt kümedeki kazanma oranı; örnek az ise null (oran uydurulmaz). */
function oranHesapla(isler: GecmisIs[], enAz: number): number | null {
  if (isler.length < enAz) return null;
  return yuzde(isler.filter((i) => i.kazanildi).length, isler.length);
}

/**
 * Kiracının kapanmış işlerinden taban istatistikleri çıkarır.
 *
 * Bir kez hesaplanır, bütün açık işlerin skorunda kullanılır — liste
 * sayfasında her satır için yeniden dolaşmak gerekmez.
 */
export type SkorTabani = {
  genelOran: number;
  ornekSayisi: number;
  sektorOrani: Map<string, number>;
  kaynakOrani: Map<string, number>;
  /** Kazanılan işlerin ortanca tutarı — "bu bizim beden ölçümüz" sorusu. */
  ortancaKazanilanTutar: number;
};

export function skorTabani(gecmis: GecmisIs[]): SkorTabani {
  const genelOran = yuzde(gecmis.filter((i) => i.kazanildi).length, gecmis.length);

  const grupla = (anahtar: (i: GecmisIs) => string | null) => {
    const kova = new Map<string, GecmisIs[]>();
    for (const is of gecmis) {
      const k = anahtar(is);
      if (!k) continue;
      const mevcut = kova.get(k);
      if (mevcut) mevcut.push(is);
      else kova.set(k, [is]);
    }
    const oranlar = new Map<string, number>();
    for (const [k, liste] of kova) {
      const oran = oranHesapla(liste, KIRILIM_EN_AZ);
      if (oran !== null) oranlar.set(k, oran);
    }
    return oranlar;
  };

  const kazanilanTutarlar = gecmis
    .filter((i) => i.kazanildi && i.tutar > 0)
    .map((i) => i.tutar)
    .sort((a, b) => a - b);
  const ortanca =
    kazanilanTutarlar.length === 0
      ? 0
      : kazanilanTutarlar[Math.floor(kazanilanTutarlar.length / 2)];

  return {
    genelOran,
    ornekSayisi: gecmis.length,
    sektorOrani: grupla((i) => i.sektor),
    kaynakOrani: grupla((i) => i.kaynak),
    ortancaKazanilanTutar: ortanca,
  };
}

/**
 * Bir açık işin skoru.
 *
 * Skor, aşamanın kendi olasılığından BAŞLAR (kullanıcının süreç bilgisi en
 * güçlü sinyaldir) ve geçmiş verisiyle düzeltilir. Her düzeltme adı ve
 * gerekçesiyle listeye yazılır — açıklanabilirlik sonradan eklenen bir metin
 * değil, hesabın kendisidir.
 */
export function skorHesapla(is: AcikIs, taban: SkorTabani): Skor {
  const etkenler: SkorEtkeni[] = [];

  // Taban: aşama olasılığı ile kiracının genel kazanma oranının ortalaması.
  // Yalnızca aşamaya bakmak, hattı iyimser kuran kuruluşta her işi yüksek
  // gösterirdi; yalnızca genel orana bakmak süreci hiç saymazdı.
  const baslangic = (is.asamaOlasilik + taban.genelOran) / 2;
  etkenler.push({
    etiket: "Aşama ve genel oran",
    katki: baslangic,
    aciklama: `Aşama olasılığı %${Math.round(is.asamaOlasilik)}, kuruluş kazanma oranı %${Math.round(taban.genelOran)}`,
  });

  let skor = baslangic;

  // Sektör: kırılımın kendi oranı genel orandan ne kadar sapıyorsa yarısı
  // kadar etki eder. Tam etki, tek bir kırılımın skoru domine etmesine yol
  // açardı.
  const sektorOran = is.sektor ? taban.sektorOrani.get(is.sektor) : undefined;
  if (sektorOran !== undefined) {
    const katki = (sektorOran - taban.genelOran) / 2;
    skor += katki;
    etkenler.push({
      etiket: "Sektör",
      katki,
      aciklama: `${is.sektor} sektöründe kazanma oranınız %${Math.round(sektorOran)}`,
    });
  }

  const kaynakOran = is.kaynak ? taban.kaynakOrani.get(is.kaynak) : undefined;
  if (kaynakOran !== undefined) {
    const katki = (kaynakOran - taban.genelOran) / 2;
    skor += katki;
    etkenler.push({
      etiket: "Kaynak",
      katki,
      aciklama: `${is.kaynak} kaynağından gelen işlerde oranınız %${Math.round(kaynakOran)}`,
    });
  }

  // Tutar: kazanılan işlerin ortancasının çok üstündeki işler daha zor
  // kapanır. Eşik ortancanın 3 katıdır ve etki sabittir — tutarı sürekli bir
  // eğriye bağlamak, rakamı açıklanamaz hale getirirdi.
  if (taban.ortancaKazanilanTutar > 0 && is.tutar > taban.ortancaKazanilanTutar * 3) {
    skor -= 10;
    etkenler.push({
      etiket: "Tutar",
      katki: -10,
      aciklama: "Tutar, kazandığınız işlerin ortancasının üç katından yüksek",
    });
  }

  // Temas: satışın en somut sinyali ilgidir. "Hiç aktivite yok" ile "30
  // gündür sessiz" ayrı ayrı cezalandırılır — ikisi farklı sorunlardır.
  if (is.aktiviteSayisi === 0) {
    skor -= 15;
    etkenler.push({
      etiket: "Temas",
      katki: -15,
      aciklama: "Bu iş için hiç aktivite kaydı yok",
    });
  } else if (is.sonTemasGun !== null && is.sonTemasGun > 30) {
    skor -= 12;
    etkenler.push({
      etiket: "Temas",
      katki: -12,
      aciklama: `Son temastan bu yana ${is.sonTemasGun} gün geçmiş`,
    });
  } else if (is.sonTemasGun !== null && is.sonTemasGun <= 7) {
    skor += 8;
    etkenler.push({
      etiket: "Temas",
      katki: 8,
      aciklama: "Son bir hafta içinde temas edilmiş",
    });
  }

  const deger = Math.max(0, Math.min(100, Math.round(skor)));

  return {
    deger,
    seviye: skorSeviyesi(deger),
    etkenler,
    ornekSayisi: taban.ornekSayisi,
    yeterliVeri: taban.ornekSayisi >= EN_AZ_ORNEK,
  };
}

/** Gün farkı — saat/dakika yok sayılır. */
export function gunFarki(bitis: Date, baslangic: Date): number {
  const ms = bitis.getTime() - baslangic.getTime();
  return Math.floor(ms / 86_400_000);
}
