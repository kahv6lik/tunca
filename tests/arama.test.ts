import { describe, it, expect } from "vitest";

/**
 * Liste aramaları — Faz 13 / H2.
 *
 * Ortağın bulgusu: "filtreler büyük/küçük harfe duyarlı." Kritik kısım
 * PostgreSQL'in ILIKE'ının Türkçe İ/ı çiftini bilmemesidir; testler bunu
 * veritabanı olmadan, koşul üretiminin kendisinde sınar.
 */
describe("Arama — Türkçe büyük/küçük harf duyarsızlığı (H2)", () => {
  it("terimi Türkçe büyük ve küçük hâlleriyle birlikte arar", async () => {
    const { aramaVaryantlari } = await import("../src/lib/arama");

    // ILIKE'ın çözemediği durum: küçük "ı"nın ASCII karşılığı yoktur, bu
    // yüzden "ısparta" yazan kullanıcı "ISPARTA" kaydını bulamazdı.
    expect(aramaVaryantlari("ısparta")).toContain("ISPARTA");
    expect(aramaVaryantlari("IŞIK")).toContain("ışık");
    // Zaten aynı olan varyant iki kez aranmaz.
    expect(aramaVaryantlari("1234")).toEqual(["1234"]);
    expect(aramaVaryantlari("   ")).toEqual([]);
  });

  it("iç içe alan yolunu Prisma nesnesine çevirir", async () => {
    const { metinArama } = await import("../src/lib/arama");

    const kosullar = metinArama<Record<string, unknown>>("abc", ["baslik", "firma.ad"]);
    expect(kosullar).toContainEqual({
      baslik: { contains: "abc", mode: "insensitive" },
    });
    expect(kosullar).toContainEqual({
      firma: { ad: { contains: "ABC", mode: "insensitive" } },
    });
  });

  it("arama boşsa hiç koşul üretmez (boş OR tüm kayıtları düşürürdü)", async () => {
    const { metinArama } = await import("../src/lib/arama");
    expect(metinArama("", ["ad"])).toEqual([]);
  });
});
