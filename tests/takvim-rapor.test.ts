import { describe, it, expect } from "vitest";
import {
  TAKVIM_TURLERI,
  turleriCoz,
  turSuzgeciEtkin,
} from "../src/lib/takvim-tanimlar";
import { tarihAraligi, araliktanEtiket } from "../src/lib/tarih-araligi";

/**
 * Faz 13 / H8 ve H9 — takvim kategori süzgeci ve rapor tarih aralığı.
 *
 * İkisinin de ortak kuralı: HATALI GİRDİ EKRANI BOŞALTMAZ. Bir süzgeç
 * kısıtlama aracıdır; yanlış yazılmış bir parametre yüzünden kullanıcının
 * "veri yok" görmesi, sorunu veriye yıkan bir hata olurdu.
 */

describe("Takvim kategori süzgeci (H8)", () => {
  it("boş ya da geçersiz parametre TÜM kategorileri getirir", () => {
    expect(turleriCoz(undefined).size).toBe(TAKVIM_TURLERI.length);
    expect(turleriCoz("").size).toBe(TAKVIM_TURLERI.length);
    expect(turleriCoz("uydurma,başka").size).toBe(TAKVIM_TURLERI.length);
  });

  it("seçilen kategorileri ayrıştırır, tanımadıklarını atar", () => {
    const secim = turleriCoz("gorev, firsat ,uydurma");
    expect([...secim].sort()).toEqual(["firsat", "gorev"]);
  });

  it("hepsi seçiliyken süzgeç etkin sayılmaz", () => {
    expect(turSuzgeciEtkin(TAKVIM_TURLERI.join(","))).toBe(false);
    expect(turSuzgeciEtkin("gorev")).toBe(true);
    expect(turSuzgeciEtkin("")).toBe(false);
  });
});

describe("Rapor tarih aralığı (H9)", () => {
  it("bitiş tarihi GÜN SONUNA çekilir — son günün kayıtları düşmez", () => {
    const aralik = tarihAraligi("2026-08-01", "2026-08-31")!;
    expect(aralik.gte?.getDate()).toBe(1);
    expect(aralik.lte?.getDate()).toBe(31);
    expect(aralik.lte?.getHours()).toBe(23);
    expect(aralik.lte?.getMinutes()).toBe(59);
  });

  it("tek sınır da geçerlidir", () => {
    expect(tarihAraligi("2026-08-01", null)).toEqual({
      gte: new Date("2026-08-01T00:00:00"),
    });
    expect(tarihAraligi(null, "2026-08-01")?.gte).toBeUndefined();
  });

  it("sınır yoksa ya da aralık tersse süzgeç uygulanmaz", () => {
    expect(tarihAraligi(null, null)).toBeUndefined();
    expect(tarihAraligi("bozuk", "veri")).toBeUndefined();
    // Ters aralık: boş rapor yerine süzgeçsiz rapor gösterilir.
    expect(tarihAraligi("2026-09-01", "2026-08-01")).toBeUndefined();
  });

  it("ekran etiketi aralığı okunur biçimde anlatır", () => {
    expect(araliktanEtiket(undefined)).toBeNull();
    expect(araliktanEtiket(tarihAraligi("2026-08-01", "2026-08-31"))).toContain("–");
    expect(araliktanEtiket(tarihAraligi("2026-08-01", null))).toContain("sonrası");
    expect(araliktanEtiket(tarihAraligi(null, "2026-08-31"))).toContain("öncesi");
  });
});
