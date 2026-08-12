import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  firmaninPaketleri,
  paketiKalemlereAc,
  paketBirimFiyati,
  type KapsamliPaket,
  paketDamgasiGecerliMi,
} from "../src/lib/fiyat-saf";

/**
 * Sipariş ve teklifte paket seçimi — v1.25.0.
 *
 * Bulgu (ortak): "ürün paketi oluşturduğumda sipariş oluştururken ürün
 * seçebiliyorum ama paket seçemiyorum."
 *
 * Kök sebep: paket Faz 14'te tanımlanabiliyordu ama HİÇBİR SATIŞA BAĞLI
 * DEĞİLDİ. Bu testler bağın kurulduğunu ve verilen sözleri sınar:
 *
 *   1. Paket TEK SATIR DEĞİL, kalemlerine açılır (stok düşümü çalışsın).
 *   2. Fiyat paketten gelir (sabit fiyat orantılı dağıtılır).
 *   3. Kapsam süzgeci: genel paket herkese, özel paket yalnızca firmasına.
 *   4. Damga SUNUCUDA doğrulanır — uydurma paketId indirim/iddia getirmez.
 */

const GENEL: KapsamliPaket = {
  paketId: "p-genel",
  kod: "PKT-1",
  ad: "Başlangıç Paketi",
  firmaId: null,
  sabitFiyat: false,
  fiyat: 0,
  iskontoOrani: 20,
  kalemler: [
    { urunId: "u1", miktar: 2, listeFiyat: 100, ad: "Ürün Bir", birim: "adet", kdvOrani: 20 },
    { urunId: "u2", miktar: 1, listeFiyat: 300, ad: "Ürün İki", birim: "adet", kdvOrani: 10 },
  ],
};

const OZEL: KapsamliPaket = {
  ...GENEL,
  paketId: "p-ozel",
  kod: "PKT-2",
  ad: "Anadolu Anlaşması",
  firmaId: "f-anadolu",
  sabitFiyat: true,
  fiyat: 400,
  iskontoOrani: 0,
};

const KATALOG = [GENEL, OZEL];

describe("Paket kapsamı", () => {
  it("genel paket HER firmada görünür", () => {
    expect(firmaninPaketleri(KATALOG, "f-baska").map((p) => p.paketId)).toContain(
      "p-genel"
    );
  });

  it("firmaya özel paket YALNIZCA o firmada görünür", () => {
    const baska = firmaninPaketleri(KATALOG, "f-baska").map((p) => p.paketId);
    expect(baska).not.toContain("p-ozel");

    const kendi = firmaninPaketleri(KATALOG, "f-anadolu").map((p) => p.paketId);
    expect(kendi).toContain("p-ozel");
  });

  it("firma seçilmemişken yalnızca genel paketler listelenir", () => {
    /*
      Başka bir müşterinin anlaşmalı fiyatını, henüz firma seçilmediği için,
      herkese göstermek olurdu.
    */
    const liste = firmaninPaketleri(KATALOG, null).map((p) => p.paketId);
    expect(liste).toEqual(["p-genel"]);
  });
});

describe("Paket satırlara açılır", () => {
  it("her kalem KENDİ satırı olur — tek opak satır DEĞİL", () => {
    /*
      Tek satır olsaydı satırın urunId'si boş kalırdı ve onay anındaki stok
      düşümü (satırın ürününe bakar) sessizce hiç çalışmazdı.
    */
    const satirlar = paketiKalemlereAc(GENEL);
    expect(satirlar).toHaveLength(2);
    for (const s of satirlar) {
      expect(s.urunId, "satırın ürünü yok — stok düşmez").toBeTruthy();
      expect(s.paketId).toBe("p-genel");
    }
  });

  it("iskontolu pakette birim fiyat liste fiyatının indirimlisidir", () => {
    const [bir, iki] = paketiKalemlereAc(GENEL);
    expect(bir.birimFiyat).toBe(80); // 100 − %20
    expect(iki.birimFiyat).toBe(240); // 300 − %20
  });

  it("sabit paket fiyatı liste değerine ORANTILI dağıtılır", () => {
    /*
      Eşit bölmek yanlış olurdu: 100 TL'lik ürünle 300 TL'lik ürün aynı payı
      almamalı — iade ve kısmi sevkiyatta rakam saçmalardı.
      Liste toplamı: 100×2 + 300×1 = 500. Sabit fiyat 400.
    */
    const [bir, iki] = paketiKalemlereAc(OZEL);
    expect(bir.birimFiyat).toBe(80); // (400 × 200/500) / 2
    expect(iki.birimFiyat).toBe(240); // (400 × 300/500) / 1

    // Dağıtım toplamı sabit fiyatı korur.
    expect(bir.birimFiyat * 2 + iki.birimFiyat * 1).toBe(400);
  });

  it("miktar ve birim paketten gelir, açıklama paketin adını taşır", () => {
    const [bir] = paketiKalemlereAc(GENEL);
    expect(bir.miktar).toBe(2);
    expect(bir.birim).toBe("adet");
    expect(bir.aciklama).toContain("Başlangıç Paketi");
    expect(bir.aciklama).toContain("Ürün Bir");
  });

  it("kalemi olmayan pakette birim fiyat üretilmez (null döner)", () => {
    expect(paketBirimFiyati(GENEL, "yok-boyle-urun", 500)).toBeNull();
  });
});

describe("Paket damgası SUNUCUDA doğrulanır", () => {
  it("geçerli damga kabul edilir", () => {
    expect(
      paketDamgasiGecerliMi(KATALOG, "p-genel", { firmaId: "f-x", urunId: "u1" })
    ).toBe(true);
  });

  it("BAŞKA firmaya özel paketin damgası reddedilir", () => {
    /*
      Aksi hâlde bir müşterinin belgesinde başka bir müşterinin anlaşma adı
      görünürdü — kampanya doğrulamasındaki kuralın aynısı (v1.23.0).
    */
    expect(
      paketDamgasiGecerliMi(KATALOG, "p-ozel", { firmaId: "f-x", urunId: "u1" })
    ).toBe(false);
    expect(
      paketDamgasiGecerliMi(KATALOG, "p-ozel", {
        firmaId: "f-anadolu",
        urunId: "u1",
      })
    ).toBe(true);
  });

  it("pakette OLMAYAN ürünün damgası reddedilir", () => {
    expect(
      paketDamgasiGecerliMi(KATALOG, "p-genel", {
        firmaId: "f-x",
        urunId: "baska-urun",
      })
    ).toBe(false);
  });

  it("ürünsüz (serbest metin) satıra paket damgası basılamaz", () => {
    expect(
      paketDamgasiGecerliMi(KATALOG, "p-genel", { firmaId: "f-x", urunId: null })
    ).toBe(false);
  });

  it("uydurma paket id'si reddedilir", () => {
    expect(
      paketDamgasiGecerliMi(KATALOG, "yok-boyle-paket", {
        firmaId: "f-x",
        urunId: "u1",
      })
    ).toBe(false);
  });
});

describe("Bağın gerçekten kurulduğu", () => {
  /*
    Bu bölüm bir REGRESYON kilididir: paket bir kez daha "tanımlanabilen ama
    hiçbir yere bağlı olmayan" bir özelliğe dönüşmesin.
  */
  const SIPARIS_FORM = readFileSync(
    "src/components/siparisler/SiparisForm.tsx",
    "utf8"
  );
  const TEKLIF_FORM = readFileSync(
    "src/components/teklifler/TeklifForm.tsx",
    "utf8"
  );

  it("her iki form da paket seçicisini çiziyor", () => {
    for (const [ad, kaynak] of [
      ["SiparisForm", SIPARIS_FORM],
      ["TeklifForm", TEKLIF_FORM],
    ] as const) {
      expect(kaynak, `${ad} paket seçicisini çizmiyor`).toContain("PaketSecici");
      expect(kaynak, `${ad} paketi satırlara açmıyor`).toContain(
        "paketiKalemlereAc"
      );
      expect(kaynak, `${ad} paketId'yi forma yazmıyor`).toContain("-paketId");
    }
  });

  it("paket seçici liste BOŞKEN de sebebini yazar", () => {
    // v1.23.0'ın dersi: alanı gizlemek "böyle bir şey yok" dedirtiyordu.
    const secici = readFileSync(
      "src/components/urunler/PaketSecici.tsx",
      "utf8"
    );
    expect(secici).toContain("önce firma seçin");
    expect(secici).toContain("aktif paket yok");
  });

  it("her iki action da damgayı sunucuda doğruluyor", () => {
    for (const yol of [
      "src/app/(app)/siparisler/actions.ts",
      "src/app/(app)/teklifler/actions.ts",
    ]) {
      const kaynak = readFileSync(yol, "utf8");
      expect(kaynak, `${yol} damgayı doğrulamıyor`).toContain(
        "paketDamgasiGecerliMi"
      );
    }
  });

  it("yedekte teklif kalemi ticari çekirdekten SONRA geri yüklenir", () => {
    /*
      TeklifKalemi artık urun/kampanya/paket satırlarını bekler; eski sırada
      (teklifin hemen ardında) geri yükleme FK hatasıyla düşerdi.
    */
    const yedek = readFileSync("src/lib/yedek-saf.ts", "utf8");
    expect(yedek.indexOf('"teklifKalemi"')).toBeGreaterThan(
      yedek.indexOf('"paket"')
    );
    expect(yedek.indexOf('"teklifKalemi"')).toBeGreaterThan(
      yedek.indexOf('"kampanya"')
    );
  });
});
