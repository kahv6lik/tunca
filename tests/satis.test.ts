import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import { PAKET_MODULLERI, modulKapaliMi } from "../src/lib/constants";
import { IZIN, ROL, ROL_IZINLERI } from "../src/lib/yetki-tanimlar";

/**
 * Satış çekirdeği testleri (Faz 6 / C1, C2, C3).
 *
 * İki soruya bakılır:
 *   1. Yeni tablolar (Kisi, Asama, Firsat) kiracı sınırına gerçekten tabi mi?
 *   2. Modelin kendi kuralları tutuyor mu? (birincil kişi, aşama silme kısıtı,
 *      kişi silinince fırsatın ayakta kalması, cascade)
 */

let a: Kiraci;
let b: Kiraci;
let aAsama: string;
let bAsama: string;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());

  const [x, y] = await Promise.all([
    yonetim.asama.create({
      data: { tenantId: a.id, ad: "Teklif", sira: 0, olasilik: 50 },
    }),
    yonetim.asama.create({
      data: { tenantId: b.id, ad: "Teklif", sira: 0, olasilik: 50 },
    }),
  ]);
  aAsama = x.id;
  bAsama = y.id;
});

afterAll(async () => {
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Kişi kiracı sınırına tabi (C1)", () => {
  it("A, B'nin kişisini göremez", async () => {
    await yonetim.kisi.create({
      data: { tenantId: b.id, firmaId: b.firmaId, ad: "B Muhatabı" },
    });

    const aGorunum = await a.db.kisi.findMany({});
    expect(aGorunum.every((k) => k.tenantId === a.id)).toBe(true);
    expect(aGorunum.some((k) => k.ad === "B Muhatabı")).toBe(false);
  });

  it("A, B'nin kişisini güncelleyemez ve silemez", async () => {
    const kisi = await yonetim.kisi.create({
      data: { tenantId: b.id, firmaId: b.firmaId, ad: "Dokunulmaz" },
    });

    const guncelleme = await a.db.kisi.updateMany({
      where: { id: kisi.id },
      data: { ad: "Ele geçirildi" },
    });
    const silme = await a.db.kisi.deleteMany({ where: { id: kisi.id } });

    expect(guncelleme.count).toBe(0);
    expect(silme.count).toBe(0);

    const sonra = await yonetim.kisi.findUnique({ where: { id: kisi.id } });
    expect(sonra?.ad).toBe("Dokunulmaz");
  });

  it("A, B kiracısı adına kişi oluşturamaz (RLS WITH CHECK)", async () => {
    await expect(
      a.db.kisi.create({
        data: { tenantId: b.id, firmaId: b.firmaId, ad: "Sızıntı" },
      })
    ).rejects.toThrow();
  });

  it("kişi silinince fırsat SİLİNMEZ, yalnızca bağlantısı boşalır", async () => {
    const kisi = await yonetim.kisi.create({
      data: { tenantId: a.id, firmaId: a.firmaId, ad: "Ayrılan Muhatap" },
    });
    const firsat = await yonetim.firsat.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        kisiId: kisi.id,
        asamaId: aAsama,
        baslik: "Muhatabı değişen iş",
        tutar: 1000,
      },
    });

    await yonetim.kisi.delete({ where: { id: kisi.id } });

    const sonra = await yonetim.firsat.findUnique({ where: { id: firsat.id } });
    expect(sonra).not.toBeNull();
    expect(sonra?.kisiId).toBeNull();
  });

  it("firma silinince kişileri de silinir (cascade)", async () => {
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Kapanan Firma", durum: "aktif" },
    });
    await yonetim.kisi.create({
      data: { tenantId: a.id, firmaId: firma.id, ad: "Kapanan Firmanın Kişisi" },
    });

    await yonetim.firma.delete({ where: { id: firma.id } });

    expect(await yonetim.kisi.count({ where: { firmaId: firma.id } })).toBe(0);
  });
});

describe("Aşamalar kiracıya özeldir (C2)", () => {
  it("aynı aşama adı farklı kiracılarda ayrı kayıtlardır", async () => {
    expect(aAsama).not.toBe(bAsama);

    const aGorunum = await a.db.asama.findMany({ where: { ad: "Teklif" } });
    expect(aGorunum).toHaveLength(1);
    expect(aGorunum[0].id).toBe(aAsama);
  });

  it("aynı kiracıda aynı ad iki kez kullanılamaz", async () => {
    await expect(
      yonetim.asama.create({ data: { tenantId: a.id, ad: "Teklif", sira: 9 } })
    ).rejects.toThrow();
  });

  it("A, B'nin aşamasını göremez", async () => {
    const aGorunum = await a.db.asama.findMany({});
    expect(aGorunum.some((x) => x.id === bAsama)).toBe(false);
  });

  it("içinde fırsat olan aşama silinemez (onDelete: Restrict)", async () => {
    const asama = await yonetim.asama.create({
      data: { tenantId: a.id, ad: "Silinemez Aşama", sira: 8 },
    });
    await yonetim.firsat.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        asamaId: asama.id,
        baslik: "Aşamayı tutan iş",
        tutar: 5000,
      },
    });

    await expect(yonetim.asama.delete({ where: { id: asama.id } })).rejects.toThrow();
  });
});

describe("Fırsat kiracı sınırına tabi (C2)", () => {
  it("A, B'nin fırsatını göremez", async () => {
    await yonetim.firsat.create({
      data: {
        tenantId: b.id,
        firmaId: b.firmaId,
        asamaId: bAsama,
        baslik: "B'nin gizli anlaşması",
        tutar: 999_999,
      },
    });

    const aGorunum = await a.db.firsat.findMany({});
    expect(aGorunum.every((f) => f.tenantId === a.id)).toBe(true);
    expect(aGorunum.some((f) => f.baslik === "B'nin gizli anlaşması")).toBe(false);
  });

  it("toplamlar kiracı dışını saymaz", async () => {
    const aToplam = await a.db.firsat.aggregate({ _sum: { tutar: true } });
    const bToplam = await b.db.firsat.aggregate({ _sum: { tutar: true } });

    // B'nin 999.999'luk kaydı A'nın toplamına karışmamalı.
    expect(aToplam._sum.tutar ?? 0).toBeLessThan(999_999);
    expect(bToplam._sum.tutar ?? 0).toBeGreaterThanOrEqual(999_999);
  });

  it("A, B'nin aşamasına fırsat bağlayamaz", async () => {
    await expect(
      a.db.firsat.create({
        data: {
          firmaId: a.firmaId,
          asamaId: bAsama, // başka kiracının aşaması
          baslik: "Çapraz bağlama denemesi",
          tutar: 1,
        } as never,
      })
    ).rejects.toThrow();
  });

  it("firma silinince fırsatları da silinir (cascade)", async () => {
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Fırsatlı Firma", durum: "aktif" },
    });
    await yonetim.firsat.create({
      data: {
        tenantId: a.id,
        firmaId: firma.id,
        asamaId: aAsama,
        baslik: "Firmayla giden iş",
        tutar: 100,
      },
    });

    await yonetim.firma.delete({ where: { id: firma.id } });

    expect(await yonetim.firsat.count({ where: { firmaId: firma.id } })).toBe(0);
  });
});

describe("Satış modülü yetkileri (C1-C3)", () => {
  it("salt okunur kullanıcı kişi ve fırsat GÖRÜR ama yazamaz", () => {
    const izinler = ROL_IZINLERI[ROL.saltOkunur];
    expect(izinler).toContain(IZIN.kisiGoruntule);
    expect(izinler).toContain(IZIN.firsatGoruntule);
    expect(izinler).not.toContain(IZIN.kisiOlustur);
    expect(izinler).not.toContain(IZIN.firsatOlustur);
    expect(izinler).not.toContain(IZIN.firsatDuzenle);
  });

  it("aşama yönetimi üyede değil, kuruluş yöneticisindedir", () => {
    // Hattın biçimi kuruluş çapında bir karardır.
    expect(ROL_IZINLERI[ROL.uye]).not.toContain(IZIN.asamaYonet);
    expect(ROL_IZINLERI[ROL.tenantAdmin]).toContain(IZIN.asamaYonet);
    expect(ROL_IZINLERI[ROL.uye]).toContain(IZIN.firsatDuzenle);
  });

  it("paket satış modüllerini kapatabilir", () => {
    expect(PAKET_MODULLERI.map((m) => m.deger)).toContain("kisi");
    expect(PAKET_MODULLERI.map((m) => m.deger)).toContain("firsat");

    const kapali = new Set(["kisi", "firsat"]);
    expect(modulKapaliMi(IZIN.kisiGoruntule, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.firsatDuzenle, kapali)).toBe(true);
    // Aşama izni "firsat." ön ekiyle tanımlandığı için paketle birlikte düşer.
    expect(modulKapaliMi(IZIN.asamaYonet, kapali)).toBe(true);
    // Diğer modüller etkilenmez.
    expect(modulKapaliMi(IZIN.firmaGoruntule, kapali)).toBe(false);
  });
});
