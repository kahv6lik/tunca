import { describe, it, expect } from "vitest";
import {
  npsHesapla,
  olcekAraligi,
  soruOzeti,
  soruTipi,
  yanitDogrula,
  yanitlanabilirMi,
  yanitOrani,
  SORU_TIPLERI,
} from "../src/lib/anket-tanimlar";

/**
 * Anket kuralları — Faz 19.
 *
 * Buradaki asıl sözler:
 *   1. Çoktan seçmeli yanıt TANIMDAKİ seçeneklerle doğrulanır.
 *   2. Bağlantı tek kullanımlıktır ve anketin bitiş tarihine bağlıdır.
 *   3. NPS standart eşiklerle hesaplanır (9-10 / 7-8 / 0-6).
 */

const metinSoru = {
  id: "s1",
  tip: "metin",
  metin: "Görüşünüz",
  secenekler: [],
  zorunlu: false,
};
const zorunluSoru = { ...metinSoru, id: "s2", zorunlu: true };
const coktan = {
  id: "s3",
  tip: "coktan",
  metin: "Memnuniyet",
  secenekler: ["İyi", "Orta", "Kötü"],
  zorunlu: false,
};
const olcek10 = { ...metinSoru, id: "s4", tip: "olcek10" };
const evetHayir = { ...metinSoru, id: "s5", tip: "evethayir" };

describe("Yanıt doğrulama", () => {
  it("zorunlu soru boş bırakılamaz, isteğe bağlı bırakılabilir", () => {
    expect(yanitDogrula(zorunluSoru, "  ").ok).toBe(false);
    expect(yanitDogrula(metinSoru, "")).toEqual({ ok: true, deger: "" });
  });

  it("ÇOKTAN SEÇMELİ yanıt tanımdaki seçeneklerle karşılaştırılır", () => {
    // İstemciden gelen uydurma bir seçenek kabul edilirse rapor kırılımı
    // kimsenin sormadığı değerlerle dolardı.
    expect(yanitDogrula(coktan, "İyi")).toEqual({ ok: true, deger: "İyi" });
    expect(yanitDogrula(coktan, "Mükemmel").ok).toBe(false);
  });

  it("ölçek yanıtı aralık dışında olamaz", () => {
    expect(yanitDogrula(olcek10, "0")).toEqual({ ok: true, deger: "0" });
    expect(yanitDogrula(olcek10, "10")).toEqual({ ok: true, deger: "10" });
    expect(yanitDogrula(olcek10, "11").ok).toBe(false);
    expect(yanitDogrula(olcek10, "-1").ok).toBe(false);
    expect(yanitDogrula(olcek10, "5.5").ok).toBe(false);
    expect(yanitDogrula({ ...olcek10, tip: "olcek5" }, "0").ok).toBe(false);
  });

  it("evet/hayır yalnızca iki değer kabul eder", () => {
    expect(yanitDogrula(evetHayir, "evet").ok).toBe(true);
    expect(yanitDogrula(evetHayir, "belki").ok).toBe(false);
  });

  it("serbest metin kırpılır (tek yanıt veritabanını şişirmesin)", () => {
    const sonuc = yanitDogrula(metinSoru, "a".repeat(5000));
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.deger.length).toBe(2000);
  });

  it("ölçek aralıkları tanımdan okunur", () => {
    expect(olcekAraligi("olcek5")).toEqual({ min: 1, max: 5 });
    expect(olcekAraligi("olcek10")).toEqual({ min: 0, max: 10 });
    expect(olcekAraligi("metin")).toBeNull();
  });
});

describe("Yanıtlanabilirlik", () => {
  const bos = { yanitTarihi: null };
  const an = new Date("2026-08-10T12:00:00");

  it("yayındaki ve süresi dolmamış anket yanıtlanabilir", () => {
    expect(
      yanitlanabilirMi({ durum: "yayinda", bitisTarihi: null }, bos, an).ok
    ).toBe(true);
  });

  it("taslak ve kapanmış anket AYRI mesaj verir", () => {
    const taslak = yanitlanabilirMi({ durum: "taslak", bitisTarihi: null }, bos, an);
    const kapali = yanitlanabilirMi({ durum: "kapandi", bitisTarihi: null }, bos, an);
    expect(taslak.ok).toBe(false);
    expect(kapali.ok).toBe(false);
    if (!taslak.ok && !kapali.ok) {
      expect(taslak.sebep).toBe("taslak");
      expect(kapali.sebep).toBe("kapandi");
      expect(taslak.mesaj).not.toBe(kapali.mesaj);
    }
  });

  it("BİTİŞ TARİHİ geçmişse yanıtlanamaz", () => {
    const sonuc = yanitlanabilirMi(
      { durum: "yayinda", bitisTarihi: new Date("2026-08-01") },
      bos,
      an
    );
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.sebep).toBe("suredoldu");
  });

  it("bağlantı TEK KULLANIMLIKTIR", () => {
    const sonuc = yanitlanabilirMi(
      { durum: "yayinda", bitisTarihi: null },
      { yanitTarihi: new Date("2026-08-05") },
      an
    );
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.sebep).toBe("yanitlandi");
  });
});

describe("NPS", () => {
  it("standart eşiklerle hesaplanır", () => {
    // 4 destekçi (9,9,10,10), 2 nötr (7,8), 4 kötüleyen (0,3,5,6)
    const nps = npsHesapla([9, 9, 10, 10, 7, 8, 0, 3, 5, 6]);
    expect(nps.destekci).toBe(4);
    expect(nps.notr).toBe(2);
    expect(nps.kotuleyen).toBe(4);
    // (%40 − %40) = 0
    expect(nps.skor).toBe(0);
  });

  it("nötrler skoru doğrudan etkilemez ama paydaya girer", () => {
    // 1 destekçi, 1 nötr, 0 kötüleyen → %50 − %0 = 50
    expect(npsHesapla([10, 7]).skor).toBe(50);
  });

  it("yanıt yoksa skor null (sıfıra bölme yok)", () => {
    expect(npsHesapla([]).skor).toBeNull();
  });

  it("tümü kötüleyense −100", () => {
    expect(npsHesapla([0, 1, 2]).skor).toBe(-100);
  });
});

describe("Soru özeti", () => {
  const yanitlar = [
    { soruId: "s4", deger: "10" },
    { soruId: "s4", deger: "8" },
    { soruId: "s4", deger: "2" },
    { soruId: "s3", deger: "İyi" },
    { soruId: "s3", deger: "İyi" },
    { soruId: "s3", deger: "Kötü" },
    { soruId: "s4", deger: "" }, // boş yanıt sayılmaz
  ];

  it("ölçek sorusunda ortalama hesaplanır", () => {
    const o = soruOzeti({ id: "s4", metin: "NPS", tip: "olcek10" }, yanitlar);
    expect(o.yanitSayisi).toBe(3);
    expect(o.ortalama).toBeCloseTo(6.7, 1);
  });

  it("ÖLÇEK dağılımı SAYISAL sıralanır", () => {
    // Metin sıralaması "10"u "2"den önce koyar ve grafik anlamsız çıkardı.
    const o = soruOzeti({ id: "s4", metin: "NPS", tip: "olcek10" }, yanitlar);
    expect(o.dagilim.map((d) => d.deger)).toEqual(["2", "8", "10"]);
  });

  it("seçmeli soruda dağılım çoktan aza sıralanır, ortalama yok", () => {
    const o = soruOzeti({ id: "s3", metin: "Memnuniyet", tip: "coktan" }, yanitlar);
    expect(o.dagilim[0]).toEqual({ deger: "İyi", adet: 2 });
    expect(o.ortalama).toBeNull();
  });

  it("yanıtsız soruda sıfır döner", () => {
    const o = soruOzeti({ id: "yok", metin: "?", tip: "metin" }, yanitlar);
    expect(o.yanitSayisi).toBe(0);
    expect(o.ortalama).toBeNull();
  });
});

describe("Yanıtlama oranı", () => {
  it("gönderim yoksa null döner", () => {
    expect(yanitOrani(0, 0)).toBeNull();
  });

  it("yüzde bir ondalıkla hesaplanır", () => {
    expect(yanitOrani(8, 3)).toBe(37.5);
    expect(yanitOrani(10, 10)).toBe(100);
  });
});

describe("Soru tipleri", () => {
  it("her tipin etiketi ve açıklaması var; anahtarlar benzersiz", () => {
    const degerler = SORU_TIPLERI.map((t) => t.deger);
    expect(new Set(degerler).size).toBe(degerler.length);
    for (const t of SORU_TIPLERI) {
      expect(t.etiket.length).toBeGreaterThan(0);
      expect(t.aciklama.length).toBeGreaterThan(0);
    }
  });

  it("yalnızca ölçek tipleri sayısaldır", () => {
    expect(soruTipi("olcek5")?.sayisal).toBe(true);
    expect(soruTipi("olcek10")?.sayisal).toBe(true);
    expect(soruTipi("coktan")?.sayisal).toBe(false);
    expect(soruTipi("coktan")?.secenekli).toBe(true);
    expect(soruTipi("metin")?.secenekli).toBe(false);
  });
});
