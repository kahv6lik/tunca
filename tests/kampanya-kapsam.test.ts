import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { satirinKampanyalari, type KapsamliKampanya } from "../src/lib/fiyat-saf";

/**
 * Kampanya kapsam süzgeci — v1.23.0.
 *
 * ORTAĞIN BULGUSU: "Kampanyalar ekranından oluşturulan kampanya sipariş veya
 * teklif aşamasında aktif olmuyor; kampanya kısmı hiç gözükmüyor."
 *
 * SEBEP: `/siparisler/yeni` kampanyaları SUNUCUDA bir kez süzüyordu ve
 * bağlamı `{ firmaId }` idi — `urunId` HİÇ verilmiyordu. `kampanyaGecerliMi`
 * ürün kapsamı dolu bir kampanyayı, bağlamda ürün yoksa REDDEDER; dolayısıyla
 * belirli ürünlere tanımlı her kampanya listeden düşüyordu. Firma seçilmeden
 * önce firma kapsamlılar da aynı şekilde düşüyordu.
 *
 * ÇÖZÜM: katalog kapsamıyla istemciye verilir, süzme satır satır yapılır.
 * Buradaki testler o süzgecin sözünü tutar.
 */

function kampanya(ek: Partial<KapsamliKampanya> = {}): KapsamliKampanya {
  return {
    kampanyaId: "k1",
    kod: "KMP1",
    ad: "Kampanya",
    tip: "yuzde",
    deger: 10,
    alN: 0,
    odeM: 0,
    kalanKota: 0,
    tukendi: false,
    baslangic: "2020-01-01T00:00:00.000Z",
    bitis: "2999-01-01T00:00:00.000Z",
    urunIdler: [],
    paketIdler: [],
    firmaIdler: [],
    ...ek,
  };
}

describe("Satırın kampanyaları", () => {
  it("kapsamsız kampanya HER satırda görünür", () => {
    const katalog = [kampanya()];
    expect(satirinKampanyalari(katalog, {})).toHaveLength(1);
    expect(
      satirinKampanyalari(katalog, { firmaId: "f1", urunId: "u1" })
    ).toHaveLength(1);
  });

  it("ÜRÜN kapsamlı kampanya, o ürün seçilince görünür (asıl hata)", () => {
    const katalog = [kampanya({ urunIdler: ["u1"] })];
    // Eski davranış: ürün verilmediği için kampanya HİÇ görünmüyordu.
    expect(satirinKampanyalari(katalog, { firmaId: "f1" })).toHaveLength(0);
    expect(satirinKampanyalari(katalog, { firmaId: "f1", urunId: "u1" })).toHaveLength(1);
    expect(satirinKampanyalari(katalog, { firmaId: "f1", urunId: "u9" })).toHaveLength(0);
  });

  it("FİRMA kapsamlı kampanya yalnızca o firmada görünür", () => {
    const katalog = [kampanya({ firmaIdler: ["f1"] })];
    expect(satirinKampanyalari(katalog, {})).toHaveLength(0);
    expect(satirinKampanyalari(katalog, { firmaId: "f1" })).toHaveLength(1);
    expect(satirinKampanyalari(katalog, { firmaId: "f2" })).toHaveLength(0);
  });

  it("firma VE ürün kapsamı birlikte aranır", () => {
    const katalog = [kampanya({ firmaIdler: ["f1"], urunIdler: ["u1"] })];
    expect(satirinKampanyalari(katalog, { firmaId: "f1", urunId: "u2" })).toHaveLength(0);
    expect(satirinKampanyalari(katalog, { firmaId: "f2", urunId: "u1" })).toHaveLength(0);
    expect(satirinKampanyalari(katalog, { firmaId: "f1", urunId: "u1" })).toHaveLength(1);
  });

  it("tarihi geçmiş kampanya görünmez", () => {
    const katalog = [
      kampanya({
        baslangic: "2020-01-01T00:00:00.000Z",
        bitis: "2020-12-31T00:00:00.000Z",
      }),
    ];
    expect(satirinKampanyalari(katalog, { an: new Date("2026-08-10") })).toHaveLength(0);
    expect(satirinKampanyalari(katalog, { an: new Date("2020-06-01") })).toHaveLength(1);
  });

  it("kotası dolmuş kampanya görünmez", () => {
    expect(satirinKampanyalari([kampanya({ tukendi: true })], {})).toHaveLength(0);
  });

  it("kota 'sınırsız' ile 'bitti' karışmaz", () => {
    // kalanKota 0 tek başına belirsizdir; karar `tukendi` ile verilir.
    expect(satirinKampanyalari([kampanya({ kalanKota: 0, tukendi: false })], {})).toHaveLength(1);
    expect(satirinKampanyalari([kampanya({ kalanKota: 0, tukendi: true })], {})).toHaveLength(0);
  });
});

describe("Kaynak sözleşmeleri", () => {
  it("sipariş sayfaları kampanya KATALOĞUNU kullanıyor (bir kez süzülmüş liste DEĞİL)", () => {
    for (const dosya of [
      "src/app/(app)/siparisler/yeni/page.tsx",
      "src/app/(app)/siparisler/[id]/duzenle/page.tsx",
    ]) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} katalog kullanmıyor`).toContain("kampanyaKatalogu");
      expect(kaynak).not.toContain("gecerliKampanyalar(");
    }
  });

  it("teklif sayfaları da katalogla besleniyor", () => {
    for (const dosya of [
      "src/app/(app)/teklifler/yeni/page.tsx",
      "src/app/(app)/teklifler/[id]/page.tsx",
    ]) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} kampanya kataloğu almıyor`).toContain("kampanyaKatalogu");
      expect(kaynak).toContain("kampanyalar={kampanyalar}");
    }
  });

  it("sunucu, kampanyayı TAM KAPSAMLA doğruluyor (yalnızca durum=aktif DEĞİL)", () => {
    for (const dosya of [
      "src/app/(app)/siparisler/actions.ts",
      "src/app/(app)/teklifler/actions.ts",
    ]) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} kapsam doğrulaması yapmıyor`).toContain(
        "gecerliKampanyalar"
      );
      // Eski, yetersiz kontrolün geri gelmediğini denetler.
      expect(kaynak).not.toContain('where: { id: k.kampanyaId, durum: "aktif" }');
    }
  });

  it("formlar süzgeç için AYNI saf fonksiyonu çağırıyor", () => {
    for (const dosya of [
      "src/components/siparisler/SiparisForm.tsx",
      "src/components/teklifler/TeklifForm.tsx",
    ]) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} satirinKampanyalari kullanmıyor`).toContain(
        "satirinKampanyalari"
      );
    }
  });

  it("tekliften siparişe geçişte ürün ve kampanya TAŞINIR", () => {
    const kaynak = readFileSync("src/app/(app)/siparisler/yeni/page.tsx", "utf8");
    expect(kaynak).toContain("urunId: k.urunId ?? \"\"");
    expect(kaynak).toContain("kampanyaId: k.kampanyaId ?? \"\"");
  });
});

describe("Rapor PDF çıktısı", () => {
  const RAPORLAR = [
    "src/app/(app)/raporlar/genel/page.tsx",
    "src/app/(app)/raporlar/mali/page.tsx",
    "src/app/(app)/raporlar/satis/page.tsx",
    "src/app/(app)/raporlar/urun/page.tsx",
    "src/app/(app)/raporlar/aktivite/page.tsx",
    "src/app/(app)/destek/rapor/page.tsx",
  ];

  it("her rapor ekranında yazdır/PDF başlığı var", () => {
    for (const dosya of RAPORLAR) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} RaporBasligi kullanmıyor`).toContain("RaporBasligi");
    }
  });

  it("baskı künyesi kuruluş adını ve dönemi taşır", () => {
    const kaynak = readFileSync("src/components/raporlar/RaporBasligi.tsx", "utf8");
    expect(kaynak).toContain("kiraciAyari");
    expect(kaynak).toContain("Dönem:");
    expect(kaynak).toContain("Çıktı tarihi:");
    // Künye YALNIZCA baskıda görünür.
    expect(kaynak).toContain("print:block");
  });

  it("baskıda kabuk ve süzgeç formu gizleniyor", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const baski = css.slice(css.indexOf("@media print"));
    for (const secici of ["aside", "header", "nav", "button", "form"]) {
      expect(baski, `${secici} baskıda gizlenmiyor`).toContain(secici);
    }
  });
});

describe("Paket kapsamı artık DEĞERLENDİRİLİYOR (v1.26.1)", () => {
  /*
    ORTAĞIN BULGUSU: "kampanya modülünden test ettiğimde sipariş ve sevk
    ettiğimde kampanya tanımından düşmüyor."

    KÖK SEBEP: `paketIdler` toplanıyor, forma taşınıyor ve veritabanında
    saklanıyordu ama KARAR VEREN fonksiyon (`kampanyaGecerliMi`) onu HİÇ
    OKUMUYORDU. İki sonucu vardı:

      1. Yalnızca pakete tanımlı kampanya "tüm ürünler" gibi davranıyor,
         kapsam dışı satışlara indirim veriyordu.
      2. Ürün + paket birlikte seçildiğinde paketten açılan satırlar kapsam
         dışı kalıyor, kampanya uygulanmıyor ve bu yüzden ONAYDA KOTA DA
         DÜŞMÜYORDU — kota yalnızca UYGULANAN kampanya için düşer.

    Paket kapsamı ancak v1.25.0'dan sonra sorulabilir hâle geldi: satır artık
    hangi paketten açıldığını `paketId` damgasıyla taşıyor.
  */
  const PAKETLI: KapsamliKampanya = {
    kampanyaId: "k-paket",
    kod: "PKT100",
    ad: "Paket kampanyası",
    tip: "yuzde",
    deger: 10,
    alN: 0,
    odeM: 0,
    kalanKota: 0,
    baslangic: "2026-01-01",
    bitis: "2030-12-31",
    tukendi: false,
    urunIdler: [],
    paketIdler: ["p1"],
    firmaIdler: [],
  };

  const AN = new Date("2026-08-13");

  it("yalnızca PAKETE tanımlı kampanya, kapsam dışı satıra UYGULANMAZ", () => {
    // Eski davranış: paketIdler okunmadığı için bu satır kampanyayı görürdü.
    const liste = satirinKampanyalari([PAKETLI], {
      firmaId: "f1",
      urunId: "baska-urun",
      paketId: null,
      an: AN,
    });
    expect(liste).toHaveLength(0);
  });

  it("paketten AÇILAN satır kampanyayı görür", () => {
    const liste = satirinKampanyalari([PAKETLI], {
      firmaId: "f1",
      urunId: "u1",
      paketId: "p1",
      an: AN,
    });
    expect(liste.map((k) => k.kod)).toEqual(["PKT100"]);
  });

  it("başka paketten açılan satır görmez", () => {
    const liste = satirinKampanyalari([PAKETLI], {
      firmaId: "f1",
      urunId: "u1",
      paketId: "p-baska",
      an: AN,
    });
    expect(liste).toHaveLength(0);
  });

  it("ürün VE paket kapsamı TEK kapsamdır — biri yeterlidir", () => {
    /*
      Ortağın ekranındaki durum: hem CV-01 ürünü hem "deneme paketi"
      işaretliydi. Eskiden yalnızca ürün eşleşmesi sayılıyordu; paketten
      açılan satırlar kapsam dışı kalıp kotayı hiç düşürmüyordu.
    */
    const ikisi: KapsamliKampanya = {
      ...PAKETLI,
      urunIdler: ["cv-01"],
      paketIdler: ["p1"],
    };

    // Ürünle eşleşen satır
    expect(
      satirinKampanyalari([ikisi], { firmaId: "f1", urunId: "cv-01", an: AN })
    ).toHaveLength(1);

    // Paketten açılan satır (ürünü kapsamda DEĞİL)
    expect(
      satirinKampanyalari([ikisi], {
        firmaId: "f1",
        urunId: "baska",
        paketId: "p1",
        an: AN,
      })
    ).toHaveLength(1);

    // İkisi de tutmuyorsa uygulanmaz
    expect(
      satirinKampanyalari([ikisi], {
        firmaId: "f1",
        urunId: "baska",
        paketId: "p-baska",
        an: AN,
      })
    ).toHaveLength(0);
  });

  it("iki kapsam da boşsa kampanya HER kaleme açıktır", () => {
    const serbest: KapsamliKampanya = {
      ...PAKETLI,
      urunIdler: [],
      paketIdler: [],
    };
    expect(
      satirinKampanyalari([serbest], { firmaId: "f1", urunId: "her-urun", an: AN })
    ).toHaveLength(1);
  });

  it("paket damgası sunucu ve istemci süzgecine BAĞLANDI", () => {
    // Kural saf katmanda; iki taraf da onu aynı bağlamla çağırmalı.
    const kmp = readFileSync("src/lib/kampanya.ts", "utf8");
    expect(kmp, "sunucu süzgeci paketId almıyor").toContain("paketId: secenekler.paketId");

    for (const yol of [
      "src/app/(app)/siparisler/actions.ts",
      "src/app/(app)/teklifler/actions.ts",
      "src/components/siparisler/SiparisForm.tsx",
      "src/components/teklifler/TeklifForm.tsx",
    ]) {
      expect(readFileSync(yol, "utf8"), `${yol} paketId'yi taşımıyor`).toMatch(
        /paketId: k\.paketId/
      );
    }
  });
});
