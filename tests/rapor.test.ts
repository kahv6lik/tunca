import { existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  aktiviteYuku,
  donemKarsilastir,
  hatOzeti,
  kirilim,
  maliOzet,
  oncekiDonem,
  oran,
  oranMetni,
} from "../src/lib/rapor-saf";
import { RAPORLAR, raporBul, raporSorgusu, IC_RAPORLAR } from "../src/lib/rapor-tanimlar";

/**
 * Rapor hesapları — Faz 18 / R1-R3.
 *
 * Buradaki asıl sözler:
 *   1. Ciro yalnızca ONAYLANMIŞ siparişten gelir.
 *   2. Dönüşüm oranı KAPANMIŞ işler üzerinden hesaplanır.
 *   3. Önceki dönem sıfırsa yüzde ÜRETİLMEZ.
 */

describe("Dönem karşılaştırması", () => {
  it("artış ve azalış doğru işaretlenir", () => {
    expect(donemKarsilastir(150, 100)).toMatchObject({ fark: 50, yuzde: 50, yon: "artis" });
    expect(donemKarsilastir(80, 100)).toMatchObject({ fark: -20, yuzde: -20, yon: "azalis" });
    expect(donemKarsilastir(100, 100).yon).toBe("sabit");
  });

  it("önceki dönem SIFIRSA yüzde üretilmez", () => {
    // "0'dan 5'e %500 artış" tanımsızdır ve kullanıcıyı yanıltır.
    expect(donemKarsilastir(5, 0).yuzde).toBeNull();
  });

  it("önceki dönem AYNI UZUNLUKTA üretilir", () => {
    const aralik = {
      gte: new Date("2026-08-01T00:00:00"),
      lte: new Date("2026-08-31T23:59:59.999"),
    };
    const onceki = oncekiDonem(aralik)!;
    const uzunluk = (a: { gte: Date; lte: Date }) => a.lte.getTime() - a.gte.getTime();
    expect(Math.abs(uzunluk(onceki as { gte: Date; lte: Date }) - uzunluk(aralik))).toBeLessThan(2);
    expect(onceki.lte!.getTime()).toBeLessThan(aralik.gte.getTime());
  });

  it("açık uçlu aralıkta karşılaştırma YAPILMAZ", () => {
    // Uydurma bir dönem üretmek, yanlış bir oran göstermekten kötüdür.
    expect(oncekiDonem({ gte: new Date("2026-08-01") })).toBeNull();
    expect(oncekiDonem({ lte: new Date("2026-08-31") })).toBeNull();
    expect(oncekiDonem(undefined)).toBeNull();
  });
});

describe("Oran", () => {
  it("payda sıfırsa null döner (sıfıra bölme yok)", () => {
    expect(oran(5, 0)).toBeNull();
    expect(oranMetni(null)).toBe("—");
  });

  it("bir ondalık basamağa yuvarlanır", () => {
    expect(oran(1, 3)).toBe(33.3);
    expect(oranMetni(33.3)).toBe("%33,3");
  });
});

describe("Satış hattı özeti", () => {
  const firsatlar = [
    { durum: "acik", tutar: 100_000, olasilik: 50 },
    { durum: "acik", tutar: 40_000, olasilik: 25 },
    { durum: "kazanildi", tutar: 60_000, olasilik: 100 },
    { durum: "kaybedildi", tutar: 90_000, olasilik: 0 },
  ];

  it("açık, kazanılan ve kaybedilen ayrı sayılır", () => {
    const o = hatOzeti(firsatlar);
    expect(o.toplam).toBe(4);
    expect(o.acik).toBe(2);
    expect(o.kazanilan).toBe(1);
    expect(o.kaybedilen).toBe(1);
  });

  it("DÖNÜŞÜM ORANI kapanmış işler üzerinden hesaplanır", () => {
    // 1 kazanılan / 2 kapanan = %50. Açıklar paydaya girseydi %25 çıkardı ve
    // "hattı doldurdukça başarın düşüyor" gibi yanlış bir okuma olurdu.
    expect(hatOzeti(firsatlar).donusumOrani).toBe(50);
  });

  it("beklenen ciro YALNIZCA açık fırsatlardan ve olasılıkla ağırlıklı", () => {
    // 100.000×%50 + 40.000×%25 = 60.000. Kazanılan fırsat buraya girmez.
    expect(hatOzeti(firsatlar).beklenenCiro).toBe(60_000);
  });

  it("hiç kapanmış iş yoksa oran null olur", () => {
    const o = hatOzeti([{ durum: "acik", tutar: 10, olasilik: 10 }]);
    expect(o.donusumOrani).toBeNull();
  });

  it("boş listede sıfırlar döner", () => {
    expect(hatOzeti([])).toMatchObject({ toplam: 0, beklenenCiro: 0, donusumOrani: null });
  });
});

describe("Mali özet", () => {
  const veri = {
    onayliSiparisler: [
      { toplam: 12_000, araToplam: 10_000, indirimTutari: 1_000 },
      { toplam: 24_000, araToplam: 22_000, indirimTutari: 2_000 },
    ],
    bekleyenSiparisler: [{ toplam: 5_000 }],
    kabulEdilenTeklifler: [{ toplam: 8_000 }],
    acikFirsatlar: [{ tutar: 100_000, olasilik: 40 }],
  };

  it("CİRO yalnızca onaylanmış siparişlerden gelir", () => {
    // Bekleyen sipariş, teklif ve fırsat ciroya GİRMEZ.
    expect(maliOzet(veri).ciro).toBe(36_000);
    expect(maliOzet(veri).siparisAdedi).toBe(2);
  });

  it("beklenen tahsilat üç kalemin toplamıdır", () => {
    // 5.000 (bekleyen) + 8.000 (kabul edilen teklif) + 40.000 (ağırlıklı)
    const o = maliOzet(veri);
    expect(o.agirlikliFirsat).toBe(40_000);
    expect(o.beklenenTahsilat).toBe(53_000);
  });

  it("indirim oranı BRÜT üzerinden hesaplanır", () => {
    // 3.000 / 32.000 ≈ %9,4
    expect(maliOzet(veri).indirimOrani).toBe(9.4);
  });

  it("ortalama sepet sipariş sayısına bölünür; sipariş yoksa sıfır", () => {
    expect(maliOzet(veri).ortalamaSepet).toBe(18_000);
    const bos = maliOzet({
      onayliSiparisler: [],
      bekleyenSiparisler: [],
      kabulEdilenTeklifler: [],
      acikFirsatlar: [],
    });
    expect(bos.ortalamaSepet).toBe(0);
    expect(bos.indirimOrani).toBeNull();
  });
});

describe("Aktivite yükü", () => {
  const an = new Date("2026-08-10T12:00:00");
  const kayitlar = [
    { atananId: "u1", sonTarih: new Date("2026-08-01"), tamamlandi: null }, // geciken
    { atananId: "u1", sonTarih: new Date("2026-08-20"), tamamlandi: null }, // açık
    { atananId: "u1", sonTarih: new Date("2026-08-05"), tamamlandi: new Date("2026-08-06") },
    { atananId: "u2", sonTarih: null, tamamlandi: null }, // not — görev değil
    { atananId: null, sonTarih: new Date("2026-08-02"), tamamlandi: null },
  ];

  const yuk = aktiviteYuku(kayitlar, an);

  it("kişi başına toplam, açık ve geciken sayılır", () => {
    const u1 = yuk.find((k) => k.kullaniciId === "u1")!;
    expect(u1.toplam).toBe(3);
    expect(u1.acikGorev).toBe(2);
    expect(u1.tamamlanan).toBe(1);
  });

  it("GECİKEN, açık görevlerin ALT KÜMESİDİR", () => {
    const u1 = yuk.find((k) => k.kullaniciId === "u1")!;
    expect(u1.geciken).toBe(1);
    expect(u1.geciken).toBeLessThanOrEqual(u1.acikGorev);
  });

  it("son tarihi olmayan kayıt görev sayılmaz", () => {
    const u2 = yuk.find((k) => k.kullaniciId === "u2")!;
    expect(u2.toplam).toBe(1);
    expect(u2.acikGorev).toBe(0);
  });

  it("atanmamış kayıtlar da görünür ve çoktan aza sıralanır", () => {
    expect(yuk[0].kullaniciId).toBe("u1");
    expect(yuk.find((k) => k.kullaniciId === null)?.acikGorev).toBe(1);
  });
});

describe("Kırılım", () => {
  it("anahtar başına toplar, çoktan aza sıralar, limiti uygular", () => {
    const veri = [
      { ad: "A", tutar: 10 },
      { ad: "B", tutar: 30 },
      { ad: "A", tutar: 5 },
      { ad: "C", tutar: 1 },
    ];
    const sonuc = kirilim(veri, (v) => v.ad, (v) => v.tutar, 2);
    expect(sonuc).toEqual([
      { label: "B", value: 30 },
      { label: "A", value: 15 },
    ]);
  });
});

describe("Rapor kayıt defteri", () => {
  it("her raporun izni, grubu ve en az bir süzgeci var", () => {
    expect(RAPORLAR.length).toBeGreaterThanOrEqual(6);
    for (const r of RAPORLAR) {
      expect(r.izin, `${r.anahtar} izinsiz`).toMatch(/^[a-z]+\.goruntule$/);
      expect(r.suzgecler.length, `${r.anahtar} süzgeçsiz`).toBeGreaterThan(0);
      expect(r.etiket.length).toBeGreaterThan(0);
    }
  });

  it("anahtarlar benzersiz", () => {
    const anahtarlar = RAPORLAR.map((r) => r.anahtar);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("dış rotalı raporlar merkezin kendi sayfası SAYILMAZ", () => {
    expect(IC_RAPORLAR.every((r) => !r.disRota)).toBe(true);
    expect(raporBul("destek")?.disRota).toBe("/destek/rapor");
  });

  it("kayıt defterindeki her iç raporun SAYFASI var", () => {
    /**
     * Tanım eklemek yetmez: sayfası olmayan bir rapor hub'da görünür ve
     * tıklanınca 404 verir. Dışa aktarım kümelerinde aynı kapı yazılmıştı
     * (Faz 16); rapor merkezi de aynı tuzağa açık.
     */
    for (const r of IC_RAPORLAR) {
      const yol = `src/app/(app)/raporlar/${r.anahtar}/page.tsx`;
      expect(existsSync(yol), `${r.anahtar} raporunun sayfası yok: ${yol}`).toBe(true);
    }
  });

  it("süzgeç querystring'e çevrilir, boş değerler atılır", () => {
    expect(raporSorgusu({ bas: "2026-08-01", bit: "", firma: "f1" })).toBe(
      "?bas=2026-08-01&firma=f1"
    );
    expect(raporSorgusu({})).toBe("");
  });
});
