import { describe, it, expect } from "vitest";
import {
  AZAMI_DOSYA_BAYT,
  boyutMetni,
  depoYolu,
  guvenliAd,
  kotaDurumu,
  metinMi,
  turBul,
  turTespit,
  uzantiAl,
  yuklemeKontrol,
} from "../src/lib/dosya-tanimlar";

/**
 * Dosya eki kuralları — Faz 17 / A1.
 *
 * Buradaki asıl söz: dosyanın türü UZANTIDAN DEĞİL İÇERİKTEN belirlenir.
 */

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const calistirilabilir = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]); // MZ (exe)

describe("İçerik türü tespiti", () => {
  it("imzadan JPEG, PNG, WebP ve PDF tanınır", () => {
    expect(turTespit(jpeg)).toBe("image/jpeg");
    expect(turTespit(png)).toBe("image/png");
    expect(turTespit(webp)).toBe("image/webp");
    expect(turTespit(pdf)).toBe("application/pdf");
  });

  it("UZANTI YALAN SÖYLESE BİLE içerik kazanır", () => {
    // ".jpg" adıyla gelen bir çalıştırılabilir dosya reddedilmeli.
    expect(turTespit(calistirilabilir, "jpg")).toBeNull();
    // PDF içerikli dosya ".txt" denilse de PDF'tir.
    expect(turTespit(pdf, "txt")).toBe("application/pdf");
  });

  it("zip tabanlı Office belgeleri uzantıyla ayrışır", () => {
    // İmza üçünde de aynıdır; ayrım GÜVENLİK kararı değil gösterim kararıdır.
    expect(turTespit(zip, "docx")).toContain("wordprocessingml");
    expect(turTespit(zip, "xlsx")).toContain("spreadsheetml");
    // Beyaz listede olmayan bir zip uzantısı kabul edilmez.
    expect(turTespit(zip, "jar")).toBeNull();
  });

  it("metin dosyası tanınır, NUL baytlı içerik metin sayılmaz", () => {
    const metin = new TextEncoder().encode("firma;il\nAcme;Ankara\n");
    expect(turTespit(metin, "csv")).toBe("text/csv");
    expect(turTespit(metin, "txt")).toBe("text/plain");
    expect(metinMi(new Uint8Array([65, 0, 66]))).toBe(false);
    expect(metinMi(new Uint8Array())).toBe(false);
  });

  it("tanınmayan içerik null döner", () => {
    expect(turTespit(calistirilabilir)).toBeNull();
    expect(turTespit(new Uint8Array())).toBeNull();
  });
});

describe("Yükleme kontrolü", () => {
  const kota = 100; // MB

  it("geçerli dosya kabul edilir", () => {
    expect(yuklemeKontrol(1024, "image/jpeg", 0, kota)).toEqual({ ok: true });
  });

  it("sınırın üstündeki dosya reddedilir", () => {
    const sonuc = yuklemeKontrol(AZAMI_DOSYA_BAYT + 1, "image/jpeg", 0, kota);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("çok büyük");
  });

  it("beyaz listede olmayan tür reddedilir", () => {
    const sonuc = yuklemeKontrol(10, null, 0, kota);
    expect(sonuc.ok).toBe(false);
  });

  it("boş dosya reddedilir", () => {
    expect(yuklemeKontrol(0, "image/jpeg", 0, kota).ok).toBe(false);
  });

  it("kotayı AŞACAK yükleme, yazmadan önce reddedilir", () => {
    const dolu = 100 * 1024 * 1024; // kotanın tamamı kullanılmış
    const sonuc = yuklemeKontrol(1024, "application/pdf", dolu, kota);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("kotası dolu");
  });

  it("kota 0 ise sınırsızdır", () => {
    expect(yuklemeKontrol(1024, "application/pdf", 999_999_999, 0).ok).toBe(true);
  });
});

describe("Kota durumu", () => {
  it("yüzde hesaplanır ve 100'ü aşmaz", () => {
    const d = kotaDurumu(512 * 1024 * 1024, 1024);
    expect(d.yuzde).toBe(50);
    expect(d.doluMu).toBe(false);
    expect(kotaDurumu(2048 * 1024 * 1024, 1024).yuzde).toBe(100);
    expect(kotaDurumu(2048 * 1024 * 1024, 1024).doluMu).toBe(true);
  });
});

describe("Adlandırma ve yol", () => {
  it("dizin gezinme denemesi ada yansımaz", () => {
    expect(guvenliAd("../../etc/passwd")).not.toContain("/");
    expect(guvenliAd("a\\b/c.png")).toBe("a-b-c.png");
  });

  it("boş ad varsayılana düşer, uzun ad kırpılır", () => {
    expect(guvenliAd("   ")).toBe("dosya");
    expect(guvenliAd("a".repeat(400)).length).toBe(180);
  });

  it("uzantı küçültülür ve temizlenir", () => {
    expect(uzantiAl("Rapor.PDF")).toBe("pdf");
    expect(uzantiAl("uzantisiz")).toBe("");
    expect(uzantiAl("bitmemis.")).toBe("");
  });

  it("depo yolu kiracı ve aya göre bölünür", () => {
    const yol = depoYolu("t1", "abc", "jpg", new Date("2026-03-09T10:00:00"));
    expect(yol).toBe("t1/2026-03/abc.jpg");
  });

  it("boyut okunur metne çevrilir", () => {
    expect(boyutMetni(512)).toBe("512 B");
    expect(boyutMetni(2048)).toBe("2 KB");
    expect(boyutMetni(10 * 1024 * 1024)).toContain("MB");
  });

  it("beyaz listedeki her türün uzantısı ve etiketi var", () => {
    expect(turBul("image/jpeg")?.gorsel).toBe(true);
    expect(turBul("application/pdf")?.gorsel).toBe(false);
    expect(turBul("application/x-msdownload")).toBeUndefined();
  });
});
