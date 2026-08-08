import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, type Kiraci } from "./fixture";
import {
  kampanyaIstemcisi,
  kotaDus,
  kotaIade,
  kampanyaKullan,
  gecerliKampanyalar,
  sureniDolduranlariKapat,
} from "../src/lib/kampanya";

/**
 * Kampanya kotası — Faz 14 / T4.
 *
 * Buradaki asıl test yarış koşuludur: iki satış temsilcisi aynı anda son
 * adedi satmaya çalıştığında YALNIZCA BİRİ başarılı olmalıdır. Bu, kotanın
 * uygulama katmanında değil veritabanında düşürülmesinin tek gerekçesidir.
 */

const GUN = 24 * 60 * 60 * 1000;

async function kampanyaKur(
  tenantId: string,
  over: Record<string, unknown> = {}
): Promise<string> {
  const k = await yonetim.kampanya.create({
    data: {
      tenantId,
      kod: `K-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ad: "Test Kampanyası",
      tip: "yuzde",
      durum: "aktif",
      baslangic: new Date(Date.now() - GUN),
      bitis: new Date(Date.now() + GUN),
      deger: 10,
      kota: 0,
      kullanilan: 0,
      ...over,
    },
  });
  return k.id;
}

describe("Kampanya kotası — atomik düşüm", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("kota düştükçe kalan azalır", async () => {
    const id = await kampanyaKur(a.id, { kota: 10 });
    const db = kampanyaIstemcisi(a.db);

    const ilk = await kotaDus(db, a.id, id, 3);
    expect(ilk).toEqual({ ok: true, kalanKota: 7 });

    const ikinci = await kotaDus(db, a.id, id, 5);
    expect(ikinci).toEqual({ ok: true, kalanKota: 2 });
  });

  it("kotayı AŞAN istek reddedilir ve sayaç DEĞİŞMEZ", async () => {
    const id = await kampanyaKur(a.id, { kota: 5 });
    const db = kampanyaIstemcisi(a.db);

    const sonuc = await kotaDus(db, a.id, id, 8);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("kotası yetersiz");

    const kayit = await a.db.kampanya.findFirst({ where: { id } });
    expect(kayit!.kullanilan).toBe(0);
  });

  it("EŞZAMANLI iki satış son adedi birlikte satamaz (yarış koşulu)", async () => {
    // Kota 1: iki istek aynı anda gider, biri kazanır.
    const id = await kampanyaKur(a.id, { kota: 1 });
    const db = kampanyaIstemcisi(a.db);

    const [x, y] = await Promise.all([
      kotaDus(db, a.id, id, 1),
      kotaDus(db, a.id, id, 1),
    ]);

    const basarili = [x, y].filter((s) => s.ok).length;
    expect(basarili).toBe(1);

    const kayit = await a.db.kampanya.findFirst({ where: { id } });
    expect(kayit!.kullanilan).toBe(1); // 2 DEĞİL
  });

  it("on eşzamanlı istekte kota tam olarak tükenir, aşılmaz", async () => {
    const id = await kampanyaKur(a.id, { kota: 4 });
    const db = kampanyaIstemcisi(a.db);

    const sonuclar = await Promise.all(
      Array.from({ length: 10 }, () => kotaDus(db, a.id, id, 1))
    );

    expect(sonuclar.filter((s) => s.ok).length).toBe(4);
    const kayit = await a.db.kampanya.findFirst({ where: { id } });
    expect(kayit!.kullanilan).toBe(4);
  });

  it("kota 0 sınırsızdır", async () => {
    const id = await kampanyaKur(a.id, { kota: 0 });
    const db = kampanyaIstemcisi(a.db);

    const sonuc = await kotaDus(db, a.id, id, 9999);
    expect(sonuc).toEqual({ ok: true, kalanKota: 0 });
  });

  it("aktif olmayan kampanyadan düşülemez", async () => {
    const id = await kampanyaKur(a.id, { durum: "duraklatildi", kota: 10 });
    const sonuc = await kotaDus(kampanyaIstemcisi(a.db), a.id, id, 1);

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("aktif değil");
  });

  it("BAŞKA kiracının kampanyasından kota düşülemez", async () => {
    // Kiracı sınırı: b'nin kampanyası a'nın bağlamından güncellenemez.
    const bKampanya = await kampanyaKur(b.id, { kota: 10 });

    const sonuc = await kotaDus(kampanyaIstemcisi(a.db), a.id, bKampanya, 1);
    expect(sonuc.ok).toBe(false);

    const kayit = await b.db.kampanya.findFirst({ where: { id: bKampanya } });
    expect(kayit!.kullanilan).toBe(0);
  });

  it("iade kotayı geri verir ama sıfırın altına düşmez", async () => {
    const id = await kampanyaKur(a.id, { kota: 10 });
    const db = kampanyaIstemcisi(a.db);

    await kotaDus(db, a.id, id, 3);
    await kotaIade(db, a.id, id, 3);
    expect((await a.db.kampanya.findFirst({ where: { id } }))!.kullanilan).toBe(0);

    // İkinci iade sayacı negatife çekmemeli.
    await kotaIade(db, a.id, id, 5);
    expect((await a.db.kampanya.findFirst({ where: { id } }))!.kullanilan).toBe(0);
  });
});

describe("Kampanya kullanım defteri", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("kullanım kaydı kotayla birlikte yazılır", async () => {
    const id = await kampanyaKur(a.id, { kota: 5 });

    const sonuc = await kampanyaKullan(kampanyaIstemcisi(a.db), a.id, {
      kampanyaId: id,
      firmaId: a.firmaId,
      adet: 2,
      indirimTutari: 150,
      referans: "SIP-001",
    });

    expect(sonuc.ok).toBe(true);
    const kayitlar = await a.db.kampanyaKullanim.findMany({ where: { kampanyaId: id } });
    expect(kayitlar).toHaveLength(1);
    expect(kayitlar[0].indirimTutari).toBe(150);
  });

  it("kota yetmezse defter kaydı da OLUŞMAZ", async () => {
    const id = await kampanyaKur(a.id, { kota: 1 });

    const sonuc = await kampanyaKullan(kampanyaIstemcisi(a.db), a.id, {
      kampanyaId: id,
      firmaId: a.firmaId,
      adet: 5,
      indirimTutari: 500,
    });

    expect(sonuc.ok).toBe(false);
    const kayitlar = await a.db.kampanyaKullanim.findMany({ where: { kampanyaId: id } });
    expect(kayitlar).toHaveLength(0);
  });
});

describe("Geçerli kampanya seçimi ve süre sonu", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("kapsamı boş kampanya her firma ve üründe geçerlidir", async () => {
    await kampanyaKur(a.id, { kod: "GENEL", ad: "Genel" });

    const liste = await gecerliKampanyalar(kampanyaIstemcisi(a.db), {
      firmaId: a.firmaId,
      urunId: "herhangi",
    });
    expect(liste.some((k) => k.kod === "GENEL")).toBe(true);
  });

  it("firma kapsamı olan kampanya yalnızca o firmada çıkar", async () => {
    const id = await kampanyaKur(a.id, { kod: "OZEL", ad: "Firmaya özel" });
    await yonetim.kampanyaFirma.create({
      data: { tenantId: a.id, kampanyaId: id, firmaId: a.firmaId },
    });

    const dogruFirma = await gecerliKampanyalar(kampanyaIstemcisi(a.db), {
      firmaId: a.firmaId,
    });
    expect(dogruFirma.some((k) => k.kod === "OZEL")).toBe(true);

    const baskaFirma = await gecerliKampanyalar(kampanyaIstemcisi(a.db), {
      firmaId: "baska-firma-id",
    });
    expect(baskaFirma.some((k) => k.kod === "OZEL")).toBe(false);
  });

  it("kiracı sınırı: komşunun kampanyası hiç görünmez", async () => {
    await kampanyaKur(b.id, { kod: "KOMSU", ad: "Komşu kampanyası" });

    const liste = await gecerliKampanyalar(kampanyaIstemcisi(a.db), {
      firmaId: a.firmaId,
    });
    expect(liste.some((k) => k.kod === "KOMSU")).toBe(false);
  });

  it("süresi dolan kampanya zamanlanmış işle 'sona erdi'ye çekilir", async () => {
    const id = await kampanyaKur(a.id, {
      kod: "ESKI",
      baslangic: new Date(Date.now() - 10 * GUN),
      bitis: new Date(Date.now() - GUN),
    });

    const etkilenen = await sureniDolduranlariKapat(kampanyaIstemcisi(a.db), a.id);
    expect(etkilenen).toBeGreaterThanOrEqual(1);

    const kayit = await a.db.kampanya.findFirst({ where: { id } });
    expect(kayit!.durum).toBe("sonaerdi");
  });
});
