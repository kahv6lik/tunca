/**
 * İçe aktarımın SAF katmanı — Faz 9 / E2.
 *
 * `yetki-tanimlar.ts` ile aynı gerekçe: bu dosya `server-only` DEĞİLDİR ve
 * veritabanına dokunmaz. Burada yalnızca ayrıştırma, eşleştirme ve doğrulama
 * vardır — yani içe aktarımın hata çıkarmaya en yatkın kısmı. Saf olması
 * doğrudan test edilebilmesini sağlar.
 */

import type { VeriKumesi } from "./disa-aktar-tanimlar";

/** Bir seferde işlenebilecek en fazla satır. */
export const AZAMI_SATIR = 5_000;

export type OkunanDosya = {
  basliklar: string[];
  satirlar: string[][];
  toplamSatir: number;
};

export type SatirSonucu = {
  satirNo: number;
  durum: "gecerli" | "hata";
  hata?: string;
  veri: Record<string, string>;
};

export type OnIzleme = {
  kume: string;
  gecerli: number;
  hatali: number;
  satirlar: SatirSonucu[];
};

/**
 * CSV okur.
 *
 * Ayırıcı otomatik seçilir: başlık satırında noktalı virgül mü virgül mü
 * daha çok geçiyorsa o kullanılır. Türkçe Excel noktalı virgülle kaydeder,
 * başka sistemler virgülle; ikisini de kabul etmek gerekir.
 */
export function csvOku(tampon: Buffer): string[][] {
  let metin = tampon.toString("utf8");
  if (metin.charCodeAt(0) === 0xfeff) metin = metin.slice(1); // BOM

  const ilkSatir = metin.split(/\r?\n/, 1)[0] ?? "";
  const ayirici =
    (ilkSatir.match(/;/g) ?? []).length >= (ilkSatir.match(/,/g) ?? []).length
      ? ";"
      : ",";

  const satirlar: string[][] = [];
  let hucre = "";
  let satir: string[] = [];
  let tirnakIcinde = false;

  for (let i = 0; i < metin.length; i++) {
    const k = metin[i];

    if (tirnakIcinde) {
      if (k === '"') {
        // Çift tırnak, kaçırılmış tırnak demektir.
        if (metin[i + 1] === '"') {
          hucre += '"';
          i++;
        } else {
          tirnakIcinde = false;
        }
      } else {
        hucre += k;
      }
      continue;
    }

    if (k === '"') tirnakIcinde = true;
    else if (k === ayirici) {
      satir.push(hucre);
      hucre = "";
    } else if (k === "\n") {
      satir.push(hucre);
      satirlar.push(satir);
      satir = [];
      hucre = "";
    } else if (k !== "\r") {
      hucre += k;
    }
  }

  if (hucre !== "" || satir.length > 0) {
    satir.push(hucre);
    satirlar.push(satir);
  }

  return satirlar;
}

/**
 * Dosya başlıklarını hedef sütunlarla otomatik eşleştirir.
 *
 * Türkçe karakterler ve büyük/küçük harf normalize edilerek karşılaştırılır;
 * "FİRMA ADI" ile "Firma Adı" aynı sayılmalıdır. Eşleşmeyen sütunu kullanıcı
 * elle seçer — otomatik eşleştirme bir kolaylıktır, karar değil.
 */
export function otomatikEslestir(
  basliklar: string[],
  kume: VeriKumesi
): Record<string, string> {
  const sadelestir = (m: string) =>
    m
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]/g, "");

  const eslesme: Record<string, string> = {};
  const kullanilan = new Set<string>();

  for (const sutun of kume.sutunlar) {
    const hedefler = [sadelestir(sutun.etiket), sadelestir(sutun.anahtar)];
    const bulunan = basliklar.find(
      (b) => !kullanilan.has(b) && hedefler.includes(sadelestir(b))
    );
    if (bulunan) {
      eslesme[sutun.anahtar] = bulunan;
      kullanilan.add(bulunan);
    }
  }

  return eslesme;
}

/** Satırları eşleştirmeye göre doğrular — HİÇBİR ŞEY YAZMAZ. */
export function onIzlemeUret(
  dosya: OkunanDosya,
  kume: VeriKumesi,
  eslesme: Record<string, string>
): OnIzleme {
  const indeksOf = (baslik: string) => dosya.basliklar.indexOf(baslik);

  const satirlar: SatirSonucu[] = dosya.satirlar.map((ham, i) => {
    const veri: Record<string, string> = {};
    for (const sutun of kume.sutunlar) {
      const baslik = eslesme[sutun.anahtar];
      const idx = baslik ? indeksOf(baslik) : -1;
      veri[sutun.anahtar] = idx >= 0 ? (ham[idx] ?? "").trim() : "";
    }

    const eksik = kume.sutunlar
      .filter((s) => s.zorunlu && !veri[s.anahtar])
      .map((s) => s.etiket);

    if (eksik.length > 0) {
      return {
        satirNo: i + 2, // +2: başlık satırı ve 1 tabanlı sayım
        durum: "hata",
        hata: `Zorunlu alan boş: ${eksik.join(", ")}`,
        veri,
      };
    }

    // Sayı alanları gerçekten sayı mı?
    for (const s of kume.sutunlar) {
      if (s.tur === "sayi" && veri[s.anahtar]) {
        const sayi = Number(veri[s.anahtar].replace(/\./g, "").replace(",", "."));
        if (Number.isNaN(sayi)) {
          return {
            satirNo: i + 2,
            durum: "hata",
            hata: `"${s.etiket}" sayı olmalı: "${veri[s.anahtar]}"`,
            veri,
          };
        }
      }
    }

    return { satirNo: i + 2, durum: "gecerli", veri };
  });

  return {
    kume: kume.deger,
    gecerli: satirlar.filter((s) => s.durum === "gecerli").length,
    hatali: satirlar.filter((s) => s.durum === "hata").length,
    satirlar,
  };
}

export function sayiya(deger: string): number {
  if (!deger) return 0;
  // "1.234,56" (TR) ve "1234.56" (EN) biçimlerinin ikisi de kabul edilir.
  const temiz = deger.includes(",")
    ? deger.replace(/\./g, "").replace(",", ".")
    : deger;
  const sayi = Number(temiz);
  return Number.isNaN(sayi) ? 0 : sayi;
}

export function tariheCevir(deger: string): Date | null {
  if (!deger) return null;
  // "01.02.2026" (TR) biçimini de tanı.
  const tr = deger.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  const d = tr
    ? new Date(Number(tr[3]), Number(tr[2]) - 1, Number(tr[1]))
    : new Date(deger);
  return Number.isNaN(d.getTime()) ? null : d;
}

