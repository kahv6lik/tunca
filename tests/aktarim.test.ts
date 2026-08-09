import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { csvOku, otomatikEslestir, onIzlemeUret } from "../src/lib/ice-aktar-saf";
import {
  VERI_KUMELERI,
  veriKumesiBul,
  ICE_AKTARILABILIR,
  BICIMLER,
} from "../src/lib/disa-aktar-tanimlar";
import { csvUret } from "../src/lib/disa-aktar-saf";

/**
 * Dışa/içe aktarım testleri (Faz 9 / E1, E2).
 *
 * Bu katmanın kritik yerleri saf fonksiyonlardır: CSV ayrıştırma, sütun
 * eşleştirme ve satır doğrulama. Veritabanı gerektirmedikleri için doğrudan
 * sınanabilirler — ve asıl hataların çıktığı yer burasıdır (tırnak kaçırma,
 * Türkçe karakter, ayırıcı seçimi).
 */

const FIRMALAR = veriKumesiBul("firmalar")!;

describe("CSV ayrıştırma (E2)", () => {
  it("noktalı virgülle ayrılmış Türkçe dosyayı okur", () => {
    const csv = "Firma Adı;İl;Sektör\r\nÖzgür Tekstil;İstanbul;Tekstil\r\n";
    const satirlar = csvOku(Buffer.from(csv, "utf8"));

    expect(satirlar[0]).toEqual(["Firma Adı", "İl", "Sektör"]);
    expect(satirlar[1]).toEqual(["Özgür Tekstil", "İstanbul", "Tekstil"]);
  });

  it("virgülle ayrılmış dosyayı da okur (ayırıcıyı kendisi seçer)", () => {
    const csv = "ad,il\nAcme,Ankara\n";
    const satirlar = csvOku(Buffer.from(csv, "utf8"));
    expect(satirlar[1]).toEqual(["Acme", "Ankara"]);
  });

  it("BOM'u atar — Excel'in kaydettiği dosyada ilk sütun bozulmaz", () => {
    const csv = "﻿ad;il\nAcme;Ankara\n";
    const satirlar = csvOku(Buffer.from(csv, "utf8"));
    expect(satirlar[0][0]).toBe("ad");
  });

  it("tırnak içindeki ayırıcı ve satır sonunu bozmaz", () => {
    const csv = 'ad;adres\n"Acme A.Ş.";"Sanayi Cad; No:5\nKat 2"\n';
    const satirlar = csvOku(Buffer.from(csv, "utf8"));

    expect(satirlar[1][0]).toBe("Acme A.Ş.");
    expect(satirlar[1][1]).toBe("Sanayi Cad; No:5\nKat 2");
  });

  it("kaçırılmış çift tırnağı tek tırnağa çevirir", () => {
    const csv = 'ad\n"12"" ekran"\n';
    const satirlar = csvOku(Buffer.from(csv, "utf8"));
    expect(satirlar[1][0]).toBe('12" ekran');
  });
});

describe("Sütun eşleştirme (E2)", () => {
  it("Türkçe karakter ve büyük/küçük harf farkını yok sayar", () => {
    const eslesme = otomatikEslestir(["FİRMA ADI", "vergi no", "İl"], FIRMALAR);

    expect(eslesme.ad).toBe("FİRMA ADI");
    expect(eslesme.vergiNo).toBe("vergi no");
    expect(eslesme.il).toBe("İl");
  });

  it("alan adıyla da eşleşir (dosya CRM'den çıkmışsa)", () => {
    const eslesme = otomatikEslestir(["ad", "vergiNo", "sektor"], FIRMALAR);
    expect(eslesme.ad).toBe("ad");
    expect(eslesme.vergiNo).toBe("vergiNo");
    expect(eslesme.sektor).toBe("sektor");
  });

  it("aynı başlığı iki alana atamaz", () => {
    const eslesme = otomatikEslestir(["Ad"], FIRMALAR);
    const kullanilan = Object.values(eslesme);
    expect(new Set(kullanilan).size).toBe(kullanilan.length);
  });

  it("eşleşmeyen alanı boş bırakır — kullanıcı elle seçer", () => {
    const eslesme = otomatikEslestir(["bilinmeyen sütun"], FIRMALAR);
    expect(Object.keys(eslesme)).toHaveLength(0);
  });
});

describe("Ön izleme doğrulaması (E2)", () => {
  const dosya = {
    basliklar: ["Firma Adı", "İl", "Vergi No"],
    satirlar: [
      ["Acme A.Ş.", "Ankara", "1234567890"],
      ["", "İzmir", "9999999999"], // zorunlu alan boş
      ["Beta Ltd.", "Bursa", ""],
    ],
    toplamSatir: 3,
  };
  const eslesme = { ad: "Firma Adı", il: "İl", vergiNo: "Vergi No" };

  it("zorunlu alanı boş olan satırı HATA olarak işaretler", () => {
    const onIzleme = onIzlemeUret(dosya, FIRMALAR, eslesme);

    expect(onIzleme.gecerli).toBe(2);
    expect(onIzleme.hatali).toBe(1);

    const hatali = onIzleme.satirlar.find((s) => s.durum === "hata");
    expect(hatali?.hata).toContain("Firma Adı");
    // Satır numarası başlık satırını sayar: 2. veri satırı → 3
    expect(hatali?.satirNo).toBe(3);
  });

  it("hiçbir şey yazmaz — yalnızca rapor üretir", () => {
    const onIzleme = onIzlemeUret(dosya, FIRMALAR, eslesme);
    expect(onIzleme.satirlar.every((s) => "veri" in s)).toBe(true);
    expect(onIzleme.satirlar[0].veri.ad).toBe("Acme A.Ş.");
  });

  it("eşleştirilmeyen sütunlar boş gelir, hata üretmez", () => {
    const onIzleme = onIzlemeUret(dosya, FIRMALAR, { ad: "Firma Adı" });
    expect(onIzleme.gecerli).toBe(2);
    expect(onIzleme.satirlar[0].veri.il).toBe("");
  });

  it("sayı alanına metin geldiğinde hata verir", () => {
    const egitimler = veriKumesiBul("egitimler")!;
    const onIzleme = onIzlemeUret(
      {
        basliklar: ["Firma", "Başlık", "Katılımcı"],
        satirlar: [["Acme", "ISG Eğitimi", "yirmi"]],
        toplamSatir: 1,
      },
      egitimler,
      { firmaAd: "Firma", baslik: "Başlık", katilimci: "Katılımcı" }
    );

    expect(onIzleme.hatali).toBe(1);
    expect(onIzleme.satirlar[0].hata).toContain("Katılımcı");
  });
});

describe("CSV üretimi (E1)", () => {
  it("BOM ile başlar — Excel Türkçe karakterleri doğru açar", () => {
    const csv = csvUret(FIRMALAR, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("noktalı virgülle ayırır (Türkçe Excel'in beklediği)", () => {
    const csv = csvUret(FIRMALAR, []);
    const ilkSatir = csv.slice(1).split("\r\n")[0];
    expect(ilkSatir).toContain("Firma Adı;Vergi No");
  });

  it("ayırıcı içeren değeri tırnağa alır", () => {
    const csv = csvUret(FIRMALAR, [{ ad: "Acme; Beta", il: "Ankara" }]);
    expect(csv).toContain('"Acme; Beta"');
  });

  it("değerdeki çift tırnağı kaçırır", () => {
    const csv = csvUret(FIRMALAR, [{ ad: '12" Ekran A.Ş.' }]);
    expect(csv).toContain('"12"" Ekran A.Ş."');
  });

  it("durum değerleri Türkçe etikete çevrilir", () => {
    const csv = csvUret(FIRMALAR, [{ ad: "Acme", durum: "aktif" }]);
    expect(csv).toContain("Aktif");
  });

  it("boş değerler boş hücre olur, 'null' yazmaz", () => {
    const csv = csvUret(FIRMALAR, [{ ad: "Acme", il: null, sektor: undefined }]);
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });
});

describe("Veri kümesi tanımları", () => {
  it("her kümenin izni ve en az bir sütunu var", () => {
    expect(VERI_KUMELERI.length).toBeGreaterThanOrEqual(8);
    for (const k of VERI_KUMELERI) {
      expect(k.izin).toMatch(/^[a-z]+\.goruntule$/);
      expect(k.sutunlar.length).toBeGreaterThan(0);
      // Sütun anahtarları küme içinde benzersiz olmalı.
      const anahtarlar = k.sutunlar.map((s) => s.anahtar);
      expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    }
  });

  it("tanımlı her veri kümesinin dışa aktarım sorgusu var", () => {
    /**
     * Tanım eklemek yetmez: `disa-aktar.ts` içinde o kümenin `case`'i yoksa
     * indirme düğmesi görünür ama boş dosya üretir. Faz 16'da üç küme
     * (proje, destek, sss) birden eklendiği için bu kapı yazıldı.
     */
    const kaynak = readFileSync("src/lib/disa-aktar.ts", "utf8");
    const eksik = VERI_KUMELERI.filter((k) => !kaynak.includes(`case "${k.deger}":`));
    expect(eksik.map((k) => k.deger), "sorgusu olmayan küme").toEqual([]);
  });

  it("içe aktarılabilen her kümede en az bir zorunlu sütun var", () => {
    expect(ICE_AKTARILABILIR.length).toBeGreaterThanOrEqual(5);
    for (const k of ICE_AKTARILABILIR) {
      expect(k.sutunlar.some((s) => s.zorunlu)).toBe(true);
    }
  });

  it("fırsat ve teklif içe aktarıma KAPALI", () => {
    // Aşama/kişi bağları gerektirirler; düz bir tablodan güvenilir biçimde
    // kurulamazlar.
    expect(veriKumesiBul("firsatlar")?.iceAktarilir).toBe(false);
    expect(veriKumesiBul("teklifler")?.iceAktarilir).toBe(false);
  });

  it("desteklenen biçimler xlsx ve csv", () => {
    expect(BICIMLER).toEqual(["xlsx", "csv"]);
  });
});
