import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { kiraciCifti, temizle, yonetim, baglantiyiKapat, type Kiraci } from "./fixture";
import {
  OZEL_ALAN_VARLIKLARI,
  degerDogrula,
  formdanDegerler,
  degerBicimle,
  secenekleriAyristir,
  alanFieldTanimi,
  ozelAlanGirdiAdi,
  type OzelAlanTanimi,
} from "../src/lib/ozel-alan-tanimlar";
import { sorguTemizle } from "../src/lib/gorunum-tanimlar";
import { IZIN, ROL, ROL_IZINLERI } from "../src/lib/yetki-tanimlar";
import { PAKET_MODULLERI, modulKapaliMi } from "../src/lib/constants";

/**
 * Kiracıya özel alanlar (Faz 11 / E6).
 *
 * Saf katman: tip doğrulama, form ayrıştırma, biçimleme, seçenek ayrıştırma.
 * Veritabanı katmanı: kiracı sınırı, tekillik ve FK cascade sözleşmesi.
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

function alan(kismi: Partial<OzelAlanTanimi>): OzelAlanTanimi {
  return {
    id: "alan1",
    varlik: "firma",
    ad: "Test Alanı",
    tip: "metin",
    secenekler: [],
    zorunlu: false,
    sira: 1,
    ...kismi,
  };
}

describe("Değer doğrulama (saf)", () => {
  it("sayı: TR virgülü noktaya çevrilir, sayı olmayan reddedilir", () => {
    expect(degerDogrula(alan({ tip: "sayi" }), "12,5")).toEqual({ ok: true, deger: "12.5" });
    expect(degerDogrula(alan({ tip: "sayi" }), "-3")).toEqual({ ok: true, deger: "-3" });
    expect(degerDogrula(alan({ tip: "sayi" }), "abc").ok).toBe(false);
    expect(degerDogrula(alan({ tip: "sayi" }), "1.2.3").ok).toBe(false);
  });

  it("tarih: yalnızca geçerli YYYY-AA-GG kabul edilir", () => {
    expect(degerDogrula(alan({ tip: "tarih" }), "2026-08-07")).toEqual({
      ok: true,
      deger: "2026-08-07",
    });
    expect(degerDogrula(alan({ tip: "tarih" }), "07.08.2026").ok).toBe(false);
    expect(degerDogrula(alan({ tip: "tarih" }), "2026-13-45").ok).toBe(false);
  });

  it("seçim: sunucu tanımdaki seçeneklerden başkasını kabul etmez", () => {
    const secim = alan({ tip: "secim", secenekler: ["Altın", "Gümüş"] });
    expect(degerDogrula(secim, "Altın")).toEqual({ ok: true, deger: "Altın" });
    // İstemci listeye "Platin" ekleyemez — tanımda yok.
    expect(degerDogrula(secim, "Platin").ok).toBe(false);
  });

  it("zorunlu alan boş bırakılamaz; opsiyonel boş geçer", () => {
    expect(degerDogrula(alan({ zorunlu: true }), " ").ok).toBe(false);
    expect(degerDogrula(alan({ zorunlu: false }), "")).toEqual({ ok: true, deger: "" });
  });

  it("500 karakter sınırı uygulanır", () => {
    expect(degerDogrula(alan({}), "x".repeat(501)).ok).toBe(false);
  });

  it("onay: yalnızca '1' işaretli sayılır", () => {
    expect(degerDogrula(alan({ tip: "onay" }), "1")).toEqual({ ok: true, deger: "1" });
    expect(degerDogrula(alan({ tip: "onay" }), "evet")).toEqual({ ok: true, deger: "" });
  });
});

describe("Form ayrıştırma (saf)", () => {
  it("tanımda olmayan oa_* anahtarları sessizce yok sayılır", () => {
    const fd = new FormData();
    fd.set("oa_alan1", "merhaba");
    fd.set("oa_baskaKiracininAlani", "sızma-denemesi");

    const sonuc = formdanDegerler([alan({ id: "alan1" })], fd);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) {
      expect(sonuc.degerler.get("alan1")).toBe("merhaba");
      expect(sonuc.degerler.has("baskaKiracininAlani")).toBe(false);
    }
  });

  it("ilk hata bütün kaydı durdurur", () => {
    const fd = new FormData();
    fd.set("oa_a1", "abc"); // sayı değil
    const sonuc = formdanDegerler([alan({ id: "a1", tip: "sayi", ad: "Puan" })], fd);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.hata).toContain("Puan");
  });
});

describe("Gösterim ve tanım yardımcıları (saf)", () => {
  it("değerler okunur biçimlenir", () => {
    expect(degerBicimle(alan({ tip: "onay" }), "1")).toBe("Evet");
    expect(degerBicimle(alan({ tip: "tarih" }), "2026-08-07")).toBe("07.08.2026");
    expect(degerBicimle(alan({ tip: "sayi" }), "12.5")).toBe("12,5");
    expect(degerBicimle(alan({}), "")).toBe("");
  });

  it("seçenek listesi ayrıştırılır: boşlar ve kopyalar düşer", () => {
    expect(secenekleriAyristir("Altın\n\n Gümüş \nAltın")).toEqual(["Altın", "Gümüş"]);
    const cok = Array.from({ length: 40 }, (_, i) => `s${i}`).join("\n");
    expect(secenekleriAyristir(cok)).toHaveLength(30);
  });

  it("RecordForm alanına çevrim tipleri doğru eşler", () => {
    expect(alanFieldTanimi(alan({ tip: "sayi" })).type).toBe("number");
    expect(alanFieldTanimi(alan({ tip: "tarih" })).type).toBe("date");
    const secim = alanFieldTanimi(alan({ tip: "secim", secenekler: ["X"] }));
    expect(secim.type).toBe("select");
    expect(secim.options?.[0]?.value).toBe(""); // "Seçiniz…" başta
  });

  it("kayıtlı görünüm sorgusu özel alan filtresini taşır", () => {
    // Faz 10'daki sorguTemizle yalnızca harf anahtarlara izin veriyordu;
    // Faz 11 "oa_<alanId>" biçimini de kabul etmeli — yoksa görünüm, özel
    // alan filtresini sessizce düşürürdü.
    expect(sorguTemizle("durum=aktif&oa_clx123abc=Altın")).toBe(
      "durum=aktif&oa_clx123abc=Alt%C4%B1n"
    );
    expect(sorguTemizle("oa_../etc=1&ara=x")).toBe("ara=x");
  });
});

describe("Yetki ve paket", () => {
  it("alan tanımlama kuruluş yöneticisine aittir", () => {
    expect(ROL_IZINLERI[ROL.tenantAdmin]).toContain(IZIN.ozelAlanYonet);
    expect(ROL_IZINLERI[ROL.uye]).not.toContain(IZIN.ozelAlanYonet);
    expect(ROL_IZINLERI[ROL.saltOkunur]).not.toContain(IZIN.ozelAlanYonet);
  });

  it("'ozelalan' bir paket modülüdür ve kapatılınca izni düşürür", () => {
    expect(PAKET_MODULLERI.some((m) => m.deger === "ozelalan")).toBe(true);
    expect(modulKapaliMi(IZIN.ozelAlanYonet, new Set(["ozelalan"]))).toBe(true);
  });
});

describe("Veritabanı katmanı", () => {
  it("alan tanımı kiracı sınırına tabidir", async () => {
    await yonetim.ozelAlan.create({
      data: { tenantId: b.id, varlik: "firma", ad: "B'nin Gizli Alanı", tip: "metin" },
    });

    const aGorunum = await a.db.ozelAlan.findMany({});
    expect(aGorunum.some((x) => x.ad === "B'nin Gizli Alanı")).toBe(false);
  });

  it("aynı varlıkta aynı alan adı iki kez tanımlanamaz", async () => {
    await yonetim.ozelAlan.create({
      data: { tenantId: a.id, varlik: "firma", ad: "Müşteri No", tip: "metin" },
    });
    await expect(
      yonetim.ozelAlan.create({
        data: { tenantId: a.id, varlik: "firma", ad: "Müşteri No", tip: "sayi" },
      })
    ).rejects.toThrow();
  });

  it("kayıt başına alan başına tek değer yazılabilir", async () => {
    const alanKaydi = await yonetim.ozelAlan.create({
      data: { tenantId: a.id, varlik: "firma", ad: "Tekil Deneme", tip: "metin" },
    });
    await yonetim.ozelAlanDeger.create({
      data: { tenantId: a.id, alanId: alanKaydi.id, firmaId: a.firmaId, deger: "bir" },
    });
    await expect(
      yonetim.ozelAlanDeger.create({
        data: { tenantId: a.id, alanId: alanKaydi.id, firmaId: a.firmaId, deger: "iki" },
      })
    ).rejects.toThrow();
  });

  it("kayıt silinince değerleri de silinir (FK cascade)", async () => {
    const firma = await yonetim.firma.create({
      data: { tenantId: a.id, ad: "Silinecek Firma", durum: "aktif" },
    });
    const alanKaydi = await yonetim.ozelAlan.create({
      data: { tenantId: a.id, varlik: "firma", ad: "Cascade Deneme", tip: "metin" },
    });
    const deger = await yonetim.ozelAlanDeger.create({
      data: { tenantId: a.id, alanId: alanKaydi.id, firmaId: firma.id, deger: "kalmasın" },
    });

    await yonetim.firma.delete({ where: { id: firma.id } });

    const kalan = await yonetim.ozelAlanDeger.findUnique({ where: { id: deger.id } });
    expect(kalan).toBeNull();
  });

  it("alan silinince bütün değerleri silinir (FK cascade)", async () => {
    const alanKaydi = await yonetim.ozelAlan.create({
      data: { tenantId: a.id, varlik: "firma", ad: "Silinecek Alan", tip: "metin" },
    });
    await yonetim.ozelAlanDeger.create({
      data: { tenantId: a.id, alanId: alanKaydi.id, firmaId: a.firmaId, deger: "x" },
    });

    await yonetim.ozelAlan.delete({ where: { id: alanKaydi.id } });

    const kalan = await yonetim.ozelAlanDeger.findMany({ where: { alanId: alanKaydi.id } });
    expect(kalan).toHaveLength(0);
  });

  it("özel alanlar yedeğe girer ve dosyada tenantId taşımaz", async () => {
    const { yedekOlustur, yedekAc, yedekIstemcisi } = await import("../src/lib/yedek-saf");

    const alanKaydi = await yonetim.ozelAlan.create({
      data: { tenantId: a.id, varlik: "firma", ad: "Yedeklenen Alan", tip: "metin" },
    });
    await yonetim.ozelAlanDeger.create({
      data: { tenantId: a.id, alanId: alanKaydi.id, firmaId: a.firmaId, deger: "yedekte" },
    });

    const ozet = await yedekOlustur(yedekIstemcisi(a.db), a.id, "elle");
    const yedek = await a.db.yedek.findFirst({ where: { id: ozet.id } });
    const icerik = yedekAc(Buffer.from(yedek!.icerik))!;

    const alanSatirlari = icerik.veriler.ozelAlan ?? [];
    const degerSatirlari = icerik.veriler.ozelAlanDeger ?? [];
    expect(alanSatirlari.some((s) => (s as { ad?: string }).ad === "Yedeklenen Alan")).toBe(true);
    expect(degerSatirlari.length).toBeGreaterThan(0);
    for (const satir of [...alanSatirlari, ...degerSatirlari]) {
      expect(satir).not.toHaveProperty("tenantId");
    }
  });

  it("varlık listesi ile şemadaki FK sütunları tutarlıdır", () => {
    // OZEL_ALAN_VARLIKLARI'na varlık eklemek şemaya FK eklemeyi gerektirir;
    // bu test yeni varlık eklerken kontrat hatırlatıcısıdır.
    expect([...OZEL_ALAN_VARLIKLARI]).toEqual(["firma", "kisi", "firsat"]);
    expect(ozelAlanGirdiAdi("abc")).toBe("oa_abc");
  });
});
