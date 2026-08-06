import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";

/**
 * Çapraz kiracı sızıntı testleri (Faz 3 / A5).
 *
 * Projenin temel güvenlik sözü: "farklı müşteriler asla birbirini göremez."
 * Bu dosya o sözü her modül ve her işlem için tek tek sınar.
 */

let a: Kiraci;
let b: Kiraci;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());
});

afterAll(async () => {
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Okuma — A, B'nin kayıtlarını göremez", () => {
  it("firma", async () => {
    expect(await a.db.firma.findFirst({ where: { id: b.firmaId } })).toBeNull();
    expect(await b.db.firma.findFirst({ where: { id: a.firmaId } })).toBeNull();
  });

  it("yatırım desteği", async () => {
    expect(await a.db.yatirimDestegi.findFirst({ where: { id: b.yatirimId } })).toBeNull();
  });

  it("eğitim", async () => {
    expect(await a.db.egitim.findFirst({ where: { id: b.egitimId } })).toBeNull();
  });

  it("hizmet", async () => {
    expect(await a.db.hizmet.findFirst({ where: { id: b.hizmetId } })).toBeNull();
  });

  it("kullanıcı", async () => {
    expect(await a.db.user.findFirst({ where: { id: b.kullaniciId } })).toBeNull();
  });

  it("kiracının kendisi — B'nin varlığı A'ya görünmez", async () => {
    expect(await a.db.tenant.findFirst({ where: { id: b.id } })).toBeNull();
    expect(await a.db.tenant.count()).toBe(1);
  });
});

describe("Listeler — yalnızca kendi kayıtları", () => {
  it("firma listesi B'nin firmasını içermez", async () => {
    const liste = await a.db.firma.findMany();
    expect(liste.map((f) => f.id)).toContain(a.firmaId);
    expect(liste.map((f) => f.id)).not.toContain(b.firmaId);
  });

  it("yatırım listesi ayrışıyor", async () => {
    const liste = await a.db.yatirimDestegi.findMany();
    expect(liste.every((y) => y.tenantId === a.id)).toBe(true);
  });

  it("eğitim ve hizmet listeleri ayrışıyor", async () => {
    expect((await a.db.egitim.findMany()).every((e) => e.tenantId === a.id)).toBe(true);
    expect((await a.db.hizmet.findMany()).every((h) => h.tenantId === a.id)).toBe(true);
  });
});

describe("Yazma — A, B'nin kaydını değiştiremez", () => {
  it("güncelleme hiçbir satırı etkilemez", async () => {
    const sonuc = await a.db.firma.updateMany({
      where: { id: b.firmaId },
      data: { ad: "SIZINTI" },
    });
    expect(sonuc.count).toBe(0);

    const bFirma = await yonetim.firma.findFirst({ where: { id: b.firmaId } });
    expect(bFirma?.ad).not.toBe("SIZINTI");
  });

  it("silme hiçbir satırı etkilemez", async () => {
    const sonuc = await a.db.firma.deleteMany({ where: { id: b.firmaId } });
    expect(sonuc.count).toBe(0);
    expect(await yonetim.firma.findFirst({ where: { id: b.firmaId } })).not.toBeNull();
  });

  it("alt kayıtlar için de geçerli", async () => {
    expect((await a.db.yatirimDestegi.deleteMany({ where: { id: b.yatirimId } })).count).toBe(0);
    expect((await a.db.egitim.deleteMany({ where: { id: b.egitimId } })).count).toBe(0);
    expect((await a.db.hizmet.deleteMany({ where: { id: b.hizmetId } })).count).toBe(0);
  });
});

describe("Oluşturma — kiracı damgası", () => {
  it("yeni kayıt oluşturan kiracıya damgalanır", async () => {
    const yeni = await a.db.firma.create({
      data: { ad: "Damga Testi", tenantId: a.id },
    });
    const kayit = await yonetim.firma.findFirst({ where: { id: yeni.id } });
    expect(kayit?.tenantId).toBe(a.id);
    expect(await b.db.firma.findFirst({ where: { id: yeni.id } })).toBeNull();
    await yonetim.firma.deleteMany({ where: { id: yeni.id } });
  });

  it("A, B kiracısı adına kayıt oluşturamaz (RLS WITH CHECK)", async () => {
    await expect(
      a.db.firma.create({ data: { ad: "Sahte", tenantId: b.id } })
    ).rejects.toThrow();
  });
});

describe("Toplamlar ve gruplamalar", () => {
  it("aggregate kiracı dışını saymaz", async () => {
    const aggA = await a.db.yatirimDestegi.aggregate({ _sum: { tutar: true } });
    const aggB = await b.db.yatirimDestegi.aggregate({ _sum: { tutar: true } });
    expect(aggA._sum.tutar).toBe(100_000);
    expect(aggB._sum.tutar).toBe(100_000);
  });

  it("groupBy kiracı dışını saymaz", async () => {
    const gruplar = await a.db.firma.groupBy({ by: ["durum"], _count: { _all: true } });
    const toplam = gruplar.reduce((s, g) => s + g._count._all, 0);
    expect(toplam).toBe(await a.db.firma.count());
  });

  it("count kiracı dışını saymaz", async () => {
    expect(await a.db.firma.count()).toBe(1);
    expect(await b.db.firma.count()).toBe(1);
  });
});
