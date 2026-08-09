import { DESTEK_DURUM, DESTEK_ONCELIK } from "./constants";

/**
 * Destek kaydı kuralları — saf (Faz 16 / P2, P3).
 *
 * `server-only` DEĞİLDİR: hem action'lar hem testler hem de rapor ekranı
 * kullanır.
 */

/** Önceliğin sıralama ağırlığı — "kritik önce" listesi için. */
export function oncelikSirasi(oncelik: string): number {
  return DESTEK_ONCELIK.find((o) => o.deger === oncelik)?.sira ?? 0;
}

/** Kayıt hâlâ açık mı? (çözülmüş ve kapanmış olanlar iş listesinden düşer) */
export function acikMi(durum: string): boolean {
  return durum === "acik" || durum === "islemde" || durum === "beklemede";
}

/**
 * Durum değişiminde damgalanacak tarihler.
 *
 * Kullanıcıya "çözüm tarihini de yaz" dedirtmek bir gün unutulacak bir
 * adımdır ve çözüm süresi raporunu bozar; damga KENDİLİĞİNDEN atılır.
 *
 * ÇÖZÜM damgası bir kez atılır ve geri alınmaz: kayıt yeniden açılırsa
 * (çözüm yanlış çıkmışsa) ilk çözüm anı yine de gerçekti. Kapanış damgası
 * ise kayıt yeniden açılınca temizlenir — kapalı olmayan bir kaydın kapanış
 * tarihi olmamalı.
 */
export function durumDamgalari(
  yeniDurum: string,
  mevcut: { cozumTarihi: Date | null; kapanisTarihi: Date | null },
  an = new Date()
): { cozumTarihi?: Date | null; kapanisTarihi?: Date | null } {
  const damga: { cozumTarihi?: Date | null; kapanisTarihi?: Date | null } = {};

  if (yeniDurum === "cozuldu" && !mevcut.cozumTarihi) {
    damga.cozumTarihi = an;
  }

  if (yeniDurum === "kapandi") {
    // Doğrudan kapatılan kayıt da çözülmüş sayılır; aksi halde çözüm süresi
    // raporu bu kayıtları hiç görmezdi.
    if (!mevcut.cozumTarihi) damga.cozumTarihi = an;
    damga.kapanisTarihi = an;
  }

  if (acikMi(yeniDurum) && mevcut.kapanisTarihi) {
    damga.kapanisTarihi = null;
  }

  return damga;
}

/** Çözüm süresi (saat). Çözülmemiş kayıtta `null`. */
export function cozumSuresiSaat(kayit: {
  createdAt: Date;
  cozumTarihi: Date | null;
}): number | null {
  if (!kayit.cozumTarihi) return null;
  const fark = kayit.cozumTarihi.getTime() - kayit.createdAt.getTime();
  return Math.max(0, Math.round((fark / 3_600_000) * 10) / 10);
}

/** Saat değerini okunur süreye çevirir ("3,5 saat" / "2 gün"). */
export function sureMetni(saat: number | null): string {
  if (saat === null) return "—";
  if (saat < 24) return `${saat.toLocaleString("tr-TR")} saat`;
  const gun = Math.round((saat / 24) * 10) / 10;
  return `${gun.toLocaleString("tr-TR")} gün`;
}

export type DestekOzeti = {
  toplam: number;
  acik: number;
  cozulen: number;
  ortalamaCozumSaat: number | null;
  kanalDagilimi: { kanal: string; adet: number }[];
  oncelikDagilimi: { oncelik: string; adet: number }[];
  kisiYuku: { kullaniciId: string | null; adet: number }[];
};

/**
 * Destek raporunu SAF olarak hesaplar (P3).
 *
 * Veritabanı sorgusu değil, satırlar üzerinde hesap: testler bunu doğrudan
 * sınar ve rapor ekranı ile testler aynı mantığı paylaşır.
 */
export function destekOzeti(
  kayitlar: {
    kanal: string;
    oncelik: string;
    durum: string;
    atananId: string | null;
    createdAt: Date;
    cozumTarihi: Date | null;
  }[]
): DestekOzeti {
  const kanal = new Map<string, number>();
  const oncelik = new Map<string, number>();
  const kisi = new Map<string | null, number>();

  let acikSayi = 0;
  let cozulenSayi = 0;
  let sureToplam = 0;

  for (const k of kayitlar) {
    kanal.set(k.kanal, (kanal.get(k.kanal) ?? 0) + 1);
    oncelik.set(k.oncelik, (oncelik.get(k.oncelik) ?? 0) + 1);

    // Kişi yükü YALNIZCA açık kayıtları sayar: kapanmış işler kimsenin
    // üzerinde yük değildir, "kimde kaç iş var" sorusu bugünü sorar.
    if (acikMi(k.durum)) {
      acikSayi++;
      kisi.set(k.atananId, (kisi.get(k.atananId) ?? 0) + 1);
    }

    const sure = cozumSuresiSaat(k);
    if (sure !== null) {
      cozulenSayi++;
      sureToplam += sure;
    }
  }

  const sirala = <T extends { adet: number }>(l: T[]) => l.sort((a, b) => b.adet - a.adet);

  return {
    toplam: kayitlar.length,
    acik: acikSayi,
    cozulen: cozulenSayi,
    ortalamaCozumSaat:
      cozulenSayi > 0 ? Math.round((sureToplam / cozulenSayi) * 10) / 10 : null,
    kanalDagilimi: sirala([...kanal].map(([k, adet]) => ({ kanal: k, adet }))),
    oncelikDagilimi: [...oncelik]
      .map(([o, adet]) => ({ oncelik: o, adet }))
      .sort((a, b) => oncelikSirasi(b.oncelik) - oncelikSirasi(a.oncelik)),
    kisiYuku: sirala([...kisi].map(([k, adet]) => ({ kullaniciId: k, adet }))),
  };
}

/** Geçerli bir durum mu? (istemciden gelen değer doğrulanır) */
export function durumGecerliMi(durum: string): boolean {
  return (DESTEK_DURUM as readonly string[]).includes(durum);
}
