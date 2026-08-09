import { describe, it, expect } from "vitest";
import {
  durumDamgalari,
  cozumSuresiSaat,
  sureMetni,
  destekOzeti,
  acikMi,
  oncelikSirasi,
  durumGecerliMi,
} from "../src/lib/destek-tanimlar";

/**
 * Destek kaydı kuralları — Faz 16 / P2, P3.
 *
 * Buradaki asıl söz: çözüm süresi raporu, kullanıcıya tarih girdirmeden
 * DOĞRU çalışmalıdır. Damgalar durum değişiminde kendiliğinden atılır.
 */

const SAAT = 3_600_000;

describe("Durum damgaları", () => {
  const bos = { cozumTarihi: null, kapanisTarihi: null };
  const an = new Date("2026-08-10T12:00:00");

  it("çözüldü durumunda çözüm tarihi damgalanır", () => {
    expect(durumDamgalari("cozuldu", bos, an)).toEqual({ cozumTarihi: an });
  });

  it("çözüm damgası bir kez atılır, ikinci kez EZİLMEZ", () => {
    const eski = new Date("2026-08-01T09:00:00");
    const damga = durumDamgalari("cozuldu", { cozumTarihi: eski, kapanisTarihi: null }, an);
    expect(damga.cozumTarihi).toBeUndefined();
  });

  it("doğrudan kapatılan kayıt da çözülmüş sayılır", () => {
    // Aksi halde bu kayıtlar çözüm süresi raporunda hiç görünmezdi.
    const damga = durumDamgalari("kapandi", bos, an);
    expect(damga.cozumTarihi).toEqual(an);
    expect(damga.kapanisTarihi).toEqual(an);
  });

  it("kayıt yeniden açılınca kapanış damgası TEMİZLENİR", () => {
    const damga = durumDamgalari(
      "islemde",
      { cozumTarihi: an, kapanisTarihi: an },
      an
    );
    expect(damga.kapanisTarihi).toBeNull();
    // Çözüm anı gerçekti; geri alınmaz.
    expect(damga.cozumTarihi).toBeUndefined();
  });

  it("açık durumlar iş listesinde kalır", () => {
    expect(acikMi("acik")).toBe(true);
    expect(acikMi("islemde")).toBe(true);
    expect(acikMi("beklemede")).toBe(true);
    expect(acikMi("cozuldu")).toBe(false);
    expect(acikMi("kapandi")).toBe(false);
  });

  it("geçersiz durum reddedilir", () => {
    expect(durumGecerliMi("acik")).toBe(true);
    expect(durumGecerliMi("uydurma")).toBe(false);
  });
});

describe("Çözüm süresi", () => {
  it("saat cinsinden hesaplanır", () => {
    const t0 = new Date("2026-08-10T09:00:00");
    expect(
      cozumSuresiSaat({ createdAt: t0, cozumTarihi: new Date(t0.getTime() + 3 * SAAT) })
    ).toBe(3);
  });

  it("çözülmemiş kayıtta null döner", () => {
    expect(cozumSuresiSaat({ createdAt: new Date(), cozumTarihi: null })).toBeNull();
  });

  it("negatif süre üretilmez (saat ayarı bozuksa)", () => {
    const t0 = new Date("2026-08-10T09:00:00");
    expect(
      cozumSuresiSaat({ createdAt: t0, cozumTarihi: new Date(t0.getTime() - SAAT) })
    ).toBe(0);
  });

  it("süre okunur metne çevrilir", () => {
    expect(sureMetni(null)).toBe("—");
    expect(sureMetni(3.5)).toContain("saat");
    expect(sureMetni(48)).toContain("gün");
  });
});

describe("Destek raporu özeti", () => {
  const t0 = new Date("2026-08-01T09:00:00");
  const kayitlar = [
    { kanal: "telefon", oncelik: "kritik", durum: "acik", atananId: "u1", createdAt: t0, cozumTarihi: null },
    { kanal: "telefon", oncelik: "orta", durum: "islemde", atananId: "u1", createdAt: t0, cozumTarihi: null },
    { kanal: "eposta", oncelik: "dusuk", durum: "cozuldu", atananId: "u2", createdAt: t0, cozumTarihi: new Date(t0.getTime() + 2 * SAAT) },
    { kanal: "web", oncelik: "yuksek", durum: "kapandi", atananId: "u2", createdAt: t0, cozumTarihi: new Date(t0.getTime() + 4 * SAAT) },
    { kanal: "telefon", oncelik: "orta", durum: "beklemede", atananId: null, createdAt: t0, cozumTarihi: null },
  ];

  const ozet = destekOzeti(kayitlar);

  it("açık ve çözülen sayıları ayrı tutulur", () => {
    expect(ozet.toplam).toBe(5);
    expect(ozet.acik).toBe(3);
    expect(ozet.cozulen).toBe(2);
  });

  it("ortalama çözüm süresi yalnızca ÇÖZÜLENLER üzerinden hesaplanır", () => {
    // (2 + 4) / 2 = 3 — çözülmemiş üç kayıt ortalamayı bozmaz.
    expect(ozet.ortalamaCozumSaat).toBe(3);
  });

  it("kanal kırılımı çoktan aza sıralanır", () => {
    expect(ozet.kanalDagilimi[0]).toEqual({ kanal: "telefon", adet: 3 });
  });

  it("öncelik dağılımı kritikten düşüğe sıralanır", () => {
    expect(ozet.oncelikDagilimi.map((o) => o.oncelik)).toEqual([
      "kritik",
      "yuksek",
      "orta",
      "dusuk",
    ]);
  });

  it("kişi yükü YALNIZCA açık kayıtları sayar", () => {
    // u2'nin iki kaydı da kapanmış; yükü yok.
    const u1 = ozet.kisiYuku.find((k) => k.kullaniciId === "u1");
    const u2 = ozet.kisiYuku.find((k) => k.kullaniciId === "u2");
    expect(u1?.adet).toBe(2);
    expect(u2).toBeUndefined();
    // Atanmamış açık kayıt da görünür (null anahtarla).
    expect(ozet.kisiYuku.find((k) => k.kullaniciId === null)?.adet).toBe(1);
  });

  it("boş listede ortalama null döner (sıfıra bölme yok)", () => {
    const bos = destekOzeti([]);
    expect(bos.toplam).toBe(0);
    expect(bos.ortalamaCozumSaat).toBeNull();
  });

  it("öncelik sırası tanımdan okunur", () => {
    expect(oncelikSirasi("kritik")).toBeGreaterThan(oncelikSirasi("dusuk"));
    expect(oncelikSirasi("bilinmeyen")).toBe(0);
  });
});
