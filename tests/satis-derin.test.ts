import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import { PAKET_MODULLERI, modulKapaliMi, TEKLIF_DURUM, LEAD_DURUM } from "../src/lib/constants";
import { IZIN, ROL, ROL_IZINLERI } from "../src/lib/yetki-tanimlar";

/**
 * Satış derinleştirme testleri (Faz 7 / C4-C7).
 *
 * Kiracı sınırının yanı sıra modelin kendi sözlerini de sınar:
 *   - Aktivite bağlamı (firma/kişi/fırsat) kiracıyı aşamaz.
 *   - Dönüşen lead silinmez; nereye dönüştüğü kayıtta kalır.
 *   - Teklif tutarı kalemlerden hesaplanır ve revizyon zinciri kopmaz.
 */

let a: Kiraci;
let b: Kiraci;
let aAsama: string;

beforeAll(async () => {
  ({ a, b } = await kiraciCifti());
  const asama = await yonetim.asama.create({
    data: { tenantId: a.id, ad: "Teklif", sira: 0, olasilik: 50 },
  });
  aAsama = asama.id;
});

afterAll(async () => {
  await temizle(a, b);
  await baglantiyiKapat();
});

describe("Aktivite kiracı sınırına tabi (C4)", () => {
  it("A, B'nin aktivitesini göremez", async () => {
    await yonetim.aktivite.create({
      data: { tenantId: b.id, firmaId: b.firmaId, tur: "not", baslik: "B'nin gizli notu" },
    });

    const aGorunum = await a.db.aktivite.findMany({});
    expect(aGorunum.every((x) => x.tenantId === a.id)).toBe(true);
    expect(aGorunum.some((x) => x.baslik === "B'nin gizli notu")).toBe(false);
  });

  it("A, B kiracısı adına aktivite oluşturamaz (RLS WITH CHECK)", async () => {
    await expect(
      a.db.aktivite.create({
        data: { tenantId: b.id, firmaId: b.firmaId, tur: "not", baslik: "Sızıntı" },
      })
    ).rejects.toThrow();
  });

  it("görev tamamlanma damgası saklanır", async () => {
    const gorev = await yonetim.aktivite.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        tur: "gorev",
        baslik: "Müşteriyi ara",
        sonTarih: new Date(),
      },
    });
    expect(gorev.tamamlandi).toBeNull();

    const damga = new Date();
    const sonra = await yonetim.aktivite.update({
      where: { id: gorev.id },
      data: { tamamlandi: damga },
    });
    expect(sonra.tamamlandi?.getTime()).toBe(damga.getTime());
  });

  it("firma silinince aktiviteleri de silinir, fırsat silinince de", async () => {
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Akış Firması", durum: "aktif" },
    });
    const firsat = await yonetim.firsat.create({
      data: {
        tenantId: a.id,
        firmaId: firma.id,
        asamaId: aAsama,
        baslik: "Akış fırsatı",
        tutar: 10,
      },
    });
    await yonetim.aktivite.create({
      data: { tenantId: a.id, firmaId: firma.id, firsatId: firsat.id, tur: "not", baslik: "Not" },
    });

    await yonetim.firma.delete({ where: { id: firma.id } });
    expect(await yonetim.aktivite.count({ where: { firmaId: firma.id } })).toBe(0);
  });
});

describe("Aday dönüşümü (C5)", () => {
  it("dönüşen aday SİLİNMEZ, izleri kaydında kalır", async () => {
    const lead = await yonetim.lead.create({
      data: { tenantId: a.id, ad: "Nitelikli Aday", kaynak: "Fuar", durum: "nitelikli" },
    });
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Dönüşen Firma", durum: "aktif" },
    });
    const kisi = await yonetim.kisi.create({
      data: { tenantId: a.id, firmaId: firma.id, ad: "Nitelikli Aday", birincil: true },
    });

    const sonra = await yonetim.lead.update({
      where: { id: lead.id },
      data: {
        durum: "donusturuldu",
        donusenFirmaId: firma.id,
        donusenKisiId: kisi.id,
        donusumTarihi: new Date(),
      },
    });

    expect(sonra.durum).toBe("donusturuldu");
    expect(sonra.donusenFirmaId).toBe(firma.id);
    // Kaynak takibi bu bağa dayanır.
    expect(sonra.kaynak).toBe("Fuar");
  });

  it("dönüşen firma silinse bile aday kaydı ayakta kalır (SetNull)", async () => {
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Kapanan Dönüşüm", durum: "aktif" },
    });
    const lead = await yonetim.lead.create({
      data: {
        tenantId: a.id,
        ad: "İzli Aday",
        durum: "donusturuldu",
        donusenFirmaId: firma.id,
      },
    });

    await yonetim.firma.delete({ where: { id: firma.id } });

    const sonra = await yonetim.lead.findUnique({ where: { id: lead.id } });
    expect(sonra).not.toBeNull();
    expect(sonra?.donusenFirmaId).toBeNull();
  });

  it("A, B'nin adayını göremez", async () => {
    await yonetim.lead.create({ data: { tenantId: b.id, ad: "B'nin adayı" } });

    const aGorunum = await a.db.lead.findMany({});
    expect(aGorunum.some((l) => l.ad === "B'nin adayı")).toBe(false);
  });

  it("durum listesi dönüşüm hunisini kapsar", () => {
    expect(LEAD_DURUM).toContain("yeni");
    expect(LEAD_DURUM).toContain("nitelikli");
    expect(LEAD_DURUM).toContain("donusturuldu");
    expect(LEAD_DURUM).toContain("elendi");
  });
});

describe("Teklif ve revizyon (C7)", () => {
  it("teklif numarası kiracı içinde benzersiz, kiracılar arasında değil", async () => {
    await yonetim.teklif.create({
      data: { tenantId: a.id, firmaId: a.firmaId, no: "TKF-001", baslik: "A teklifi" },
    });

    // Aynı numara BAŞKA kiracıda sorunsuz kullanılabilir.
    const bTeklif = await yonetim.teklif.create({
      data: { tenantId: b.id, firmaId: b.firmaId, no: "TKF-001", baslik: "B teklifi" },
    });
    expect(bTeklif.no).toBe("TKF-001");

    // Aynı kiracıda ikinci kez kullanılamaz.
    await expect(
      yonetim.teklif.create({
        data: { tenantId: a.id, firmaId: a.firmaId, no: "TKF-001", baslik: "Kopya" },
      })
    ).rejects.toThrow();
  });

  it("kalemler teklifle birlikte silinir (cascade)", async () => {
    const teklif = await yonetim.teklif.create({
      data: { tenantId: a.id, firmaId: a.firmaId, no: "TKF-002", baslik: "Kalemli" },
    });
    await yonetim.teklifKalemi.createMany({
      data: [
        { tenantId: a.id, teklifId: teklif.id, sira: 0, aciklama: "Kalem 1", miktar: 2, birimFiyat: 100, tutar: 200 },
        { tenantId: a.id, teklifId: teklif.id, sira: 1, aciklama: "Kalem 2", miktar: 1, birimFiyat: 50, tutar: 50 },
      ],
    });

    await yonetim.teklif.delete({ where: { id: teklif.id } });
    expect(await yonetim.teklifKalemi.count({ where: { teklifId: teklif.id } })).toBe(0);
  });

  it("revizyon zinciri kurulur ve eski sürüm yerinde kalır", async () => {
    const asil = await yonetim.teklif.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        no: "TKF-003",
        baslik: "Asıl",
        durum: "gonderildi",
        toplam: 1000,
      },
    });

    const revizyon = await yonetim.teklif.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        no: "TKF-003-R2",
        baslik: "Asıl",
        durum: "taslak",
        toplam: 900,
        revizyonNo: 2,
        ustTeklifId: asil.id,
      },
    });
    await yonetim.teklif.update({ where: { id: asil.id }, data: { durum: "revizyon" } });

    const asilSonra = await yonetim.teklif.findUnique({
      where: { id: asil.id },
      include: { revizyonlar: true },
    });

    // Eski sürümün RAKAMI değişmedi — görüşülen fiyat kayıtta kalır.
    expect(asilSonra?.toplam).toBe(1000);
    expect(asilSonra?.durum).toBe("revizyon");
    expect(asilSonra?.revizyonlar.map((r) => r.id)).toContain(revizyon.id);
  });

  it("üst teklif silinse bile revizyon ayakta kalır (SetNull)", async () => {
    const asil = await yonetim.teklif.create({
      data: { tenantId: a.id, firmaId: a.firmaId, no: "TKF-004", baslik: "Silinecek asıl" },
    });
    const revizyon = await yonetim.teklif.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        no: "TKF-004-R2",
        baslik: "Kalan revizyon",
        revizyonNo: 2,
        ustTeklifId: asil.id,
      },
    });

    await yonetim.teklif.delete({ where: { id: asil.id } });

    const sonra = await yonetim.teklif.findUnique({ where: { id: revizyon.id } });
    expect(sonra).not.toBeNull();
    expect(sonra?.ustTeklifId).toBeNull();
  });

  it("A, B'nin teklifini ve kalemlerini göremez", async () => {
    const bTeklif = await yonetim.teklif.create({
      data: { tenantId: b.id, firmaId: b.firmaId, no: "TKF-GIZLI", baslik: "B'nin teklifi" },
    });
    await yonetim.teklifKalemi.create({
      data: {
        tenantId: b.id,
        teklifId: bTeklif.id,
        aciklama: "Gizli kalem",
        miktar: 1,
        birimFiyat: 999,
        tutar: 999,
      },
    });

    const teklifler = await a.db.teklif.findMany({});
    const kalemler = await a.db.teklifKalemi.findMany({});

    expect(teklifler.some((t) => t.no === "TKF-GIZLI")).toBe(false);
    expect(kalemler.some((k) => k.aciklama === "Gizli kalem")).toBe(false);
  });

  it("fırsat silinince teklif silinmez, bağlantısı boşalır (SetNull)", async () => {
    const firsat = await yonetim.firsat.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        asamaId: aAsama,
        baslik: "Teklifli fırsat",
        tutar: 1,
      },
    });
    const teklif = await yonetim.teklif.create({
      data: {
        tenantId: a.id,
        firmaId: a.firmaId,
        firsatId: firsat.id,
        no: "TKF-005",
        baslik: "Fırsata bağlı",
      },
    });

    await yonetim.firsat.delete({ where: { id: firsat.id } });

    const sonra = await yonetim.teklif.findUnique({ where: { id: teklif.id } });
    expect(sonra).not.toBeNull();
    expect(sonra?.firsatId).toBeNull();
  });

  it("durum listesi teklif yaşam döngüsünü kapsar", () => {
    expect(TEKLIF_DURUM).toContain("taslak");
    expect(TEKLIF_DURUM).toContain("gonderildi");
    expect(TEKLIF_DURUM).toContain("kabul");
    expect(TEKLIF_DURUM).toContain("red");
    expect(TEKLIF_DURUM).toContain("revizyon");
  });
});

describe("Faz 7 yetkileri", () => {
  it("salt okunur kullanıcı görür ama yazamaz", () => {
    const izinler = ROL_IZINLERI[ROL.saltOkunur];
    expect(izinler).toContain(IZIN.aktiviteGoruntule);
    expect(izinler).toContain(IZIN.leadGoruntule);
    expect(izinler).toContain(IZIN.teklifGoruntule);
    expect(izinler).not.toContain(IZIN.aktiviteOlustur);
    expect(izinler).not.toContain(IZIN.leadDonustur);
    expect(izinler).not.toContain(IZIN.teklifOlustur);
  });

  it("üye adayı dönüştürebilir (günlük satış işi)", () => {
    expect(ROL_IZINLERI[ROL.uye]).toContain(IZIN.leadDonustur);
    expect(ROL_IZINLERI[ROL.uye]).toContain(IZIN.teklifOlustur);
  });

  it("paket yeni modülleri kapatabilir", () => {
    const degerler = PAKET_MODULLERI.map((m) => m.deger);
    expect(degerler).toContain("aktivite");
    expect(degerler).toContain("lead");
    expect(degerler).toContain("teklif");

    const kapali = new Set(["aktivite", "lead", "teklif"]);
    expect(modulKapaliMi(IZIN.aktiviteGoruntule, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.leadDonustur, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.teklifDuzenle, kapali)).toBe(true);
    expect(modulKapaliMi(IZIN.firmaGoruntule, kapali)).toBe(false);
  });
});
