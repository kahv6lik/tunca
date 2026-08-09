import { describe, it, expect } from "vitest";
import {
  etiketleriAyristir,
  etiketMetni,
  kategorileriTopla,
  etiketleriTopla,
} from "../src/lib/sss-tanimlar";

/**
 * SSS bilgi bankası — Faz 16 / P4.
 *
 * Buradaki asıl söz: aynı etiket farklı yazımlarla iki kutuya bölünmez.
 */

describe("Etiket ayrıştırma", () => {
  it("virgül, noktalı virgül ve satır sonuyla ayrılır", () => {
    expect(etiketleriAyristir("fatura, iade; kargo\nteslimat")).toEqual([
      "fatura",
      "iade",
      "kargo",
      "teslimat",
    ]);
  });

  it("Türkçe kurallarıyla küçültülür ve TEKİLLEŞTİRİLİR", () => {
    // "İADE" ve "iade" tek etikettir; ASCII küçültme "İ" harfini bozardı.
    expect(etiketleriAyristir("İADE, iade, İade")).toEqual(["iade"]);
  });

  it("boş girdi boş liste döner", () => {
    expect(etiketleriAyristir("")).toEqual([]);
    expect(etiketleriAyristir(undefined)).toEqual([]);
    expect(etiketleriAyristir(" , ; ")).toEqual([]);
  });

  it("metne çevrilip forma geri yazılabilir", () => {
    const liste = etiketleriAyristir("fatura, iade");
    expect(etiketleriAyristir(etiketMetni(liste))).toEqual(liste);
  });
});

describe("Kategori ve etiket toplama", () => {
  const kayitlar = [
    { kategori: "Faturalama", etiketler: ["fatura", "iade"] },
    { kategori: "Hesap", etiketler: ["şifre"] },
    { kategori: null, etiketler: ["fatura"] },
    { kategori: "Faturalama", etiketler: [] },
  ];

  it("kategoriler tekilleşir ve Türkçe sıralanır", () => {
    expect(kategorileriTopla(kayitlar)).toEqual(["Faturalama", "Hesap"]);
  });

  it("etiketler kullanım sayısıyla, çoktan aza sıralanır", () => {
    const etiketler = etiketleriTopla(kayitlar);
    expect(etiketler[0]).toEqual({ etiket: "fatura", adet: 2 });
    expect(etiketler).toHaveLength(3);
  });

  it("boş listede boş sonuç döner", () => {
    expect(kategorileriTopla([])).toEqual([]);
    expect(etiketleriTopla([])).toEqual([]);
  });
});
