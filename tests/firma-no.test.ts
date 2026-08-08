import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, type Kiraci } from "./fixture";
import {
  firmaNoUret,
  firmaNoSira,
  firmaNoMu,
  AZAMI_FIRMA_NO,
} from "../src/lib/firma-no-saf";

/**
 * Firma numarası — Faz 13 / H1.
 *
 * Ortağın bulgusu: "tüm müşterilere A0001'den başlayan, artan, 4 haneli,
 * DEĞİŞTİRİLEMEZ bir numara verilsin". Buradaki testler üç sözü sınar:
 * biçim doğru, numara kiracı içinde tekil, ve geri yükleme numarayı bozmuyor.
 */

describe("Firma numarası — saf dönüşüm", () => {
  it("A0001'den başlar ve harf 9999'da ilerler", () => {
    expect(firmaNoUret(1)).toBe("A0001");
    expect(firmaNoUret(2)).toBe("A0002");
    expect(firmaNoUret(9999)).toBe("A9999");
    expect(firmaNoUret(10000)).toBe("B0001");
    expect(firmaNoUret(AZAMI_FIRMA_NO)).toBe("Z9999");
  });

  it("kapasite dışı sıra numarasız bırakılır (sessiz taşma yok)", () => {
    expect(firmaNoUret(0)).toBeNull();
    expect(firmaNoUret(-3)).toBeNull();
    expect(firmaNoUret(1.5)).toBeNull();
    expect(firmaNoUret(AZAMI_FIRMA_NO + 1)).toBeNull();
  });

  it("dönüşüm iki yönde de tutarlıdır", () => {
    for (const sira of [1, 2, 9998, 9999, 10000, 123456, AZAMI_FIRMA_NO]) {
      expect(firmaNoSira(firmaNoUret(sira)!)).toBe(sira);
    }
    expect(firmaNoSira("A0000")).toBeNull(); // 0 numara verilmez
    expect(firmaNoSira("AA01")).toBeNull();
  });

  it("arama kutusu numara ile metni ayırt eder", () => {
    expect(firmaNoMu("A0001")).toBe(true);
    expect(firmaNoMu(" b1234 ")).toBe(true);
    expect(firmaNoMu("A001")).toBe(false);
    expect(firmaNoMu("Arçelik")).toBe(false);
  });
});

describe("Firma numarası — sayaç ve kiracı sınırı", () => {
  let a: Kiraci;
  let b: Kiraci;

  beforeAll(async () => {
    ({ a, b } = await kiraciCifti());
  });

  afterAll(async () => {
    await temizle(a, b);
  });

  it("sayaç ardışık ve çakışmasız numara üretir", async () => {
    const { siradakiFirmaNo, sayacIstemcisi } = await import("../src/lib/firma-no-saf");

    // Fixture'daki firma A0001'i kullanıyor; sayaç oradan devam etmeli.
    await yonetim.firmaNoSayac.upsert({
      where: { tenantId: a.id },
      create: { tenantId: a.id, sonSira: 1 },
      update: { sonSira: 1 },
    });

    const numaralar: string[] = [];
    for (let i = 0; i < 3; i++) {
      numaralar.push(await siradakiFirmaNo(sayacIstemcisi(a.db), a.id));
    }

    expect(numaralar).toEqual(["A0002", "A0003", "A0004"]);
    expect(new Set(numaralar).size).toBe(3);
  });

  it("numara kiracı İÇİNDE tekildir — iki kiracı aynı numarayı taşıyabilir", async () => {
    // Her kuruluş kendi A0001'ine sahiptir; numara kiracılar arası bir
    // kimlik DEĞİLDİR ve olmamalıdır (kiracılar birbirini görmez).
    const aFirma = await a.db.firma.findFirst({ where: { firmaNo: "A0001" } });
    const bFirma = await b.db.firma.findFirst({ where: { firmaNo: "A0001" } });

    expect(aFirma).not.toBeNull();
    expect(bFirma).not.toBeNull();
    expect(aFirma!.id).not.toBe(bFirma!.id);

    // Aynı kiracıda ikinci kez aynı numara yazılamaz.
    await expect(
      yonetim.firma.create({
        data: { tenantId: a.id, ad: "Çakışan", firmaNo: "A0001", durum: "aktif" },
      })
    ).rejects.toThrow();
  });

  it("geri yükleme numarayı korur ve sayacı gerçek duruma çeker", async () => {
    const { yedekOlustur, yedekAc, geriYukle, yedekIstemcisi } = await import(
      "../src/lib/yedek-saf"
    );
    const db = yedekIstemcisi(b.db);

    const ozet = await yedekOlustur(db, b.id, "elle");
    const oncekiNo = (await b.db.firma.findFirst({ where: { id: b.firmaId } }))!.firmaNo;

    await yonetim.firma.delete({ where: { id: b.firmaId } });

    const yedek = await b.db.yedek.findFirst({ where: { id: ozet.id } });
    await geriYukle(db, b.id, yedekAc(Buffer.from(yedek!.icerik))!);

    const geri = await b.db.firma.findFirst({ where: { id: b.firmaId } });
    expect(geri!.firmaNo).toBe(oncekiNo);

    // Sayaç en büyük kullanılmış sıraya çekildi: sıradaki numara çakışmaz.
    const { siradakiFirmaNo, sayacIstemcisi } = await import("../src/lib/firma-no-saf");
    const yeniNo = await siradakiFirmaNo(sayacIstemcisi(b.db), b.id);
    expect(await b.db.firma.findFirst({ where: { firmaNo: yeniNo } })).toBeNull();
  });
});
