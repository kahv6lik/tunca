import "server-only";
import { koordinatGecerliMi } from "./konum-saf";

// Saf yardımcılar `konum-saf.ts` içindedir (Vitest `server-only` çözemiyor);
// buradan yeniden dışa verilir ki çağrı yerleri tek yerden alsın.
export { adresMetni, yenidenGerekliMi } from "./konum-saf";

/**
 * Adresten koordinat üretimi — Faz 17 / A3.
 *
 * ANAHTAR TANIMSIZSA ÖZELLİK KAPALIDIR. "Anahtar yoksa yine de dene"
 * davranışı, sessizce ücretli bir servise istek atmak ya da her seferinde
 * hata basmak demektir; ikisi de kötüdür. Kapalıyken koordinat elle girilir
 * ve arayüz bunu açıkça söyler (karar 3, v1.17.0).
 *
 * MALİYET KORUMASI iki katmanlıdır:
 *   1. Koordinat firma kaydında SAKLANIR; her görüntülemede istek gitmez.
 *   2. `konumAdres` alanı koordinatın üretildiği adresi tutar — adres
 *      değişmedikçe yeni istek gönderilmez (`yenidenGerekliMi`).
 * Tipik kullanımda çağrı sayısı firma sayısı kadardır.
 */

export function geocodingAcikMi(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export type GeocodeSonucu =
  | { ok: true; enlem: number; boylam: number; adres: string }
  | { ok: false; hata: string };

/**
 * Adresi koordinata çevirir.
 *
 * Zaman aşımı vardır: harita servisi yanıt vermediğinde firma kaydetme
 * işlemi süresiz beklememelidir — konum ikincil bir alandır, kaydın kendisi
 * onun yüzünden düşmemeli.
 */
export async function adrestenKoordinat(adres: string): Promise<GeocodeSonucu> {
  const anahtar = process.env.GOOGLE_MAPS_API_KEY;
  if (!anahtar) {
    return { ok: false, hata: "Harita anahtarı tanımlı değil; koordinatı elle girin." };
  }
  const temiz = adres.trim();
  if (!temiz) return { ok: false, hata: "Adres boş." };

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(temiz)}&region=tr&language=tr&key=${anahtar}`;

  try {
    const yanit = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!yanit.ok) return { ok: false, hata: "Harita servisine ulaşılamadı." };

    const veri = (await yanit.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };

    if (veri.status !== "OK" || !veri.results?.length) {
      return { ok: false, hata: "Adres haritada bulunamadı." };
    }

    const konum = veri.results[0]?.geometry?.location;
    if (!koordinatGecerliMi(konum?.lat, konum?.lng)) {
      return { ok: false, hata: "Harita servisi geçersiz koordinat döndürdü." };
    }

    return { ok: true, enlem: konum!.lat!, boylam: konum!.lng!, adres: temiz };
  } catch {
    return { ok: false, hata: "Harita servisi yanıt vermedi." };
  }
}
