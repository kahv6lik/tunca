import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  firmaninPaketleri,
  paketiKalemlereAc,
  paketBirimFiyati,
  type KapsamliPaket,
  paketDamgasiGecerliMi,
  paketGrubuHesapla,
  kotaKullanimlari,
  type FiyatKampanyasi,
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

describe("Kampanya kapsamında çoklu seçim (v1.25.1)", () => {
  /*
    ORTAĞIN BULGUSU: "ürünler / paketler / firmalar kısmında çoklu seçme
    yaparken karışıklık oluyor." Sebebi `<select multiple>` idi: seçim
    yalnızca arka plan rengiyle görünüyor, Ctrl basılı tutulmadan tıklamak
    önceki seçimleri sessizce siliyor ve sayı hiçbir yerde yazmıyordu.
  */
  const SECIM = readFileSync("src/components/ui/CokluSecim.tsx", "utf8");
  const PANEL = readFileSync(
    "src/components/urunler/KampanyaPanel.tsx",
    "utf8"
  );

  it("kampanya paneli artık `select multiple` KULLANMIYOR", () => {
    expect(PANEL).not.toContain("multiple");
    expect(PANEL).toContain("CokluSecim");
  });

  it("üç kapsam alanının hepsi yeni bileşene bağlı", () => {
    expect(PANEL.match(/<CokluSecim/g) ?? []).toHaveLength(3);
    for (const alan of ["urunIdler", "paketIdler", "firmaIdler"]) {
      expect(PANEL, `${alan} bağlanmamış`).toContain(alan);
    }
  });

  it("seçim RENK değil İŞARETTİR: onay kutusu çiziliyor", () => {
    expect(SECIM).toContain('type="checkbox"');
    expect(SECIM).toContain("Check");
  });

  it("sayaç ve 'Tümünü seç' var", () => {
    expect(SECIM).toContain("seçili");
    expect(SECIM).toContain("Tümünü seç");
    expect(SECIM).toContain("Temizle");
  });

  it("form alanı ADI korundu — sunucu tarafı değişmedi", () => {
    /*
      `<select multiple>` de onay kutuları da aynı ada birden çok değer
      gönderir; action `formData.getAll(alan)` ile okur. Alan adı bileşene
      `ad` olarak geçer ve doğrudan `name` olur.
    */
    expect(SECIM).toContain("name={ad}");
    const action = readFileSync(
      "src/app/(app)/kampanyalar/actions.ts",
      "utf8"
    );
    expect(action).toContain("formData.getAll");
  });

  it("uzun listede arama alanı çıkar", () => {
    // Yüzlerce firma arasında aranan kaydı bulmak kaydırma işine dönerdi.
    expect(SECIM).toContain("ARAMA_ESIGI");
    expect(SECIM).toContain('toLocaleLowerCase("tr")');
  });
});

describe("PAKET BİR BÜTÜNDÜR (v1.27.0)", () => {
  /*
    ORTAĞIN BULGUSU: "Kampanyada paket fiyatı 1000 TL atandı; paketteki
    ürünlerden biri 4000, biri 5000 TL. Kampanya ÜRÜN BAZINDA uygulandığı
    için ikisi de 1000'er TL'den hesaplanıyor ve paket 1000 yerine 2000 TL
    oluyor."

    v1.25.0 paketi satırlara açtı (stok için doğruydu) ama fiyatı da satır
    satır hesapladı; paket, ürünlerin toplamına indi.
  */
  const TELEFON = [
    { urunId: "t001", birimMiktar: 1, birimFiyat: 4000, kdvOrani: 20 },
    { urunId: "k001", birimMiktar: 1, birimFiyat: 5000, kdvOrani: 20 },
  ];

  const PAKET_FIYAT: FiyatKampanyasi = {
    kampanyaId: "k1",
    kod: "TELEFON-KAMPANYA",
    ad: "Telefon Kampanya",
    tip: "paketfiyat",
    deger: 1000, // BİR PAKETİN fiyatı
    alN: 0,
    odeM: 0,
    kalanKota: 0,
  };

  it("paket fiyatı kampanyası PAKETİN TAMAMINA uygulanır", () => {
    const s = paketGrubuHesapla(TELEFON, 1, PAKET_FIYAT);
    // Ortağın ekranındaki hata: net 2000 çıkıyordu. Doğrusu 1000.
    expect(s.paketBirimFiyati).toBe(9000);
    expect(s.brut).toBe(9000);
    expect(s.netTutar).toBe(1000);
    expect(s.indirimTutari).toBe(8000);
  });

  it("indirim satırlara BRÜT PAYIYLA dağıtılır", () => {
    const s = paketGrubuHesapla(TELEFON, 1, PAKET_FIYAT);
    // 4000/9000 ve 5000/9000 payları; toplamları grubun indirimini tutar.
    expect(s.satirlar[0].indirimTutari + s.satirlar[1].indirimTutari).toBe(8000);
    expect(s.satirlar[0].indirimTutari).toBeCloseTo(3555.56, 2);
    // Satır netleri de grubun netini tutar (kuruş artığı son satırda).
    expect(s.satirlar[0].tutar + s.satirlar[1].tutar).toBe(s.netTutar);
  });

  it("4 paket sipariş edilince miktarlar ve fiyat paket cinsinden büyür", () => {
    const s = paketGrubuHesapla(TELEFON, 4, PAKET_FIYAT);
    expect(s.brut).toBe(36000);
    expect(s.netTutar).toBe(4000); // 4 × 1000
    for (const c of s.satirlar) expect(c.miktar).toBe(4);
  });

  it("pakette 2 adet olan ürün, 4 pakette 8 adet olur", () => {
    const ikiserli = [{ urunId: "u1", birimMiktar: 2, birimFiyat: 100, kdvOrani: 20 }];
    const s = paketGrubuHesapla(ikiserli, 4, null);
    expect(s.satirlar[0].miktar).toBe(8);
    expect(s.brut).toBe(800);
  });

  it("yüzde kampanyası da paketin tamamına uygulanır", () => {
    const s = paketGrubuHesapla(TELEFON, 2, {
      ...PAKET_FIYAT,
      tip: "yuzde",
      deger: 10,
    });
    expect(s.brut).toBe(18000);
    expect(s.indirimTutari).toBe(1800);
  });

  it("'3 paket al 2 öde' PAKET sayar", () => {
    const s = paketGrubuHesapla(TELEFON, 3, {
      ...PAKET_FIYAT,
      tip: "alnodem",
      alN: 3,
      odeM: 2,
    });
    // Bir paket bedava: 9000
    expect(s.indirimTutari).toBe(9000);
    expect(s.kullanilanPaket).toBe(3);
  });

  it("kampanya yoksa paket brütten satılır", () => {
    const s = paketGrubuHesapla(TELEFON, 2, null);
    expect(s.netTutar).toBe(18000);
    expect(s.indirimTutari).toBe(0);
    expect(s.kampanya).toBeNull();
  });

  it("indirim brütü AŞAMAZ (negatif fiyat üretilmez)", () => {
    const s = paketGrubuHesapla(TELEFON, 1, {
      ...PAKET_FIYAT,
      tip: "tutar",
      deger: 999999,
    });
    expect(s.indirimTutari).toBe(9000);
    expect(s.netTutar).toBe(0);
  });

  it("kullanıcı satır fiyatını değiştirirse paket bedeli de değişir", () => {
    const ucuz = [
      { ...TELEFON[0], birimFiyat: 1000 },
      { ...TELEFON[1], birimFiyat: 1000 },
    ];
    const s = paketGrubuHesapla(ucuz, 1, PAKET_FIYAT);
    expect(s.paketBirimFiyati).toBe(2000);
    expect(s.netTutar).toBe(1000);
  });
});

describe("Kota PAKET sayar (v1.27.0)", () => {
  /*
    İki ürünlü bir paketten 1 adet satmak eskiden 2 hak düşürüyordu; oysa
    kotanın anlamı "bu kampanyadan kaç PAKET verilebilir"dir.
  */
  it("aynı paketin satırları TEK kullanım yazar", () => {
    const kullanim = kotaKullanimlari([
      { kampanyaId: "k1", paketId: "p1", paketAdedi: 4, miktar: 4, indirimTutari: 100 },
      { kampanyaId: "k1", paketId: "p1", paketAdedi: 4, miktar: 4, indirimTutari: 200 },
    ]);
    expect(kullanim).toHaveLength(1);
    expect(kullanim[0].adet).toBe(4); // ürün adedi 8 DEĞİL
    expect(kullanim[0].indirimTutari).toBe(300);
  });

  it("pakete ait olmayan satır kendi miktarıyla düşer", () => {
    const kullanim = kotaKullanimlari([
      { kampanyaId: "k1", miktar: 7, indirimTutari: 50 },
    ]);
    expect(kullanim[0].adet).toBe(7);
  });

  it("farklı paketler AYRI kullanım yazar", () => {
    const kullanim = kotaKullanimlari([
      { kampanyaId: "k1", paketId: "p1", paketAdedi: 1, miktar: 1 },
      { kampanyaId: "k1", paketId: "p2", paketAdedi: 2, miktar: 2 },
    ]);
    expect(kullanim).toHaveLength(2);
    expect(kullanim.map((u) => u.adet).sort()).toEqual([1, 2]);
  });

  it("kampanyasız satır kota düşürmez", () => {
    expect(kotaKullanimlari([{ kampanyaId: null, miktar: 5 }])).toHaveLength(0);
  });

  it("onay ve iptal AYNI fonksiyonu kullanır — kota kaymaz", () => {
    const kaynak = readFileSync("src/lib/siparis.ts", "utf8");
    expect(kaynak.match(/kotaKullanimlari\(/g) ?? []).toHaveLength(2);
  });
});

describe("Onay bekleyen kampanya hakkı GÖRÜNÜR (v1.27.1)", () => {
  /*
    ORTAĞIN BULGUSU: "Kampanya kullanarak bir sipariş oluşturdum ama
    kampanyada kullanım durumu ilerlemiyor, hiç kullanılmamış gibi."

    GERÇEK TARAYICIYLA DOĞRULANDI: sipariş oluşturmak kampanyayı satıra
    YAZIYOR (kampanyaId + indirim) ama kota ONAYDA düşüyor (Faz 15 kararı —
    reddedilen sipariş kotayı boşuna tüketmemeli). Mekanizma doğruydu;
    EKRAN bunu hiçbir yerde söylemiyordu.

    Kural DEĞİŞMEDİ. Bekleyen haklar ayrıca sayılıp gösteriliyor.
  */
  const SAYFA = readFileSync("src/app/(app)/kampanyalar/page.tsx", "utf8");
  const KMP = readFileSync("src/lib/kampanya.ts", "utf8");

  it("kampanya ekranı onay bekleyen hakları sayıyor", () => {
    expect(KMP).toContain("bekleyenKotalar");
    expect(SAYFA).toContain("bekleyenKotalar(db)");
    expect(SAYFA).toContain("onay bekliyor");
  });

  it("bekleyen sayımı yalnızca ONAY BEKLEYEN siparişlere bakar", () => {
    const bas = KMP.indexOf("export async function bekleyenKotalar");
    const govde = KMP.slice(bas, bas + 1200);
    expect(govde).toContain('durum: "onaybekliyor"');
    // Onayda hangi kural işleyecekse bekleyen de onunla sayılır.
    expect(govde).toContain("kotaKullanimlari");
  });

  it("bekleyen sayımı SİPARİŞ bazında gruplanır", () => {
    /*
      Aynı paketin satırları tek hak sayılır ama İKİ AYRI siparişteki aynı
      paket iki haktır. Sipariş id'si anahtara girmezse iki sipariş tek
      kullanım gibi görünürdü.
    */
    const bas = KMP.indexOf("export async function bekleyenKotalar");
    expect(KMP.slice(bas, bas + 2000)).toContain("siparisId");
  });

  it("KOTA SAYACI DEĞİŞMEDİ — bekleyen ayrı gösterilir", () => {
    // Sayaç hâlâ gerçekten düşülmüş hakkı anlatmalı.
    expect(SAYFA).toContain("Kota: {k.kullanilan} / {k.kota}");
  });

  it("sipariş formu kotanın NE ZAMAN düşeceğini söylüyor", () => {
    const form = readFileSync(
      "src/components/siparisler/SiparisForm.tsx",
      "utf8"
    );
    expect(form).toContain("onaylandığında");
  });
});

describe("Form, sunucunun okuduğu HER alanı gönderir (v1.27.2)", () => {
  /*
    ORTAĞIN BULGUSU: paketten oluşturulan sipariş ₺0 kaydedildi.

    SEBEP: v1.27.0'da paket grubunu yazarken birim fiyat girdisine `name`
    KOYMAYI UNUTTUM. Grubun diğer alanları gizli girdilerle gidiyor, bu tek
    alan görünür olduğu için gözden kaçtı; `name`i olmayan bir girdi forma
    HİÇ gönderilmez ve sunucu 0 okur.

    Bu test o sınıfın tamamını kapatır: action'ın okuduğu her alan adı formda
    bir `name` olarak bulunmalıdır. Yeni bir alan eklenip form tarafı
    unutulursa burada yakalanır.
  */
  const SIPARIS_ACTION = readFileSync(
    "src/app/(app)/siparisler/actions.ts",
    "utf8"
  );
  const SIPARIS_FORM = readFileSync(
    "src/components/siparisler/SiparisForm.tsx",
    "utf8"
  );
  const TEKLIF_FORM = readFileSync(
    "src/components/teklifler/TeklifForm.tsx",
    "utf8"
  );

  /** Action'ın `formData.get("kalem-${i}-X")` ile okuduğu alan adları. */
  const okunanlar = [
    ...new Set(
      [...SIPARIS_ACTION.matchAll(/kalem-\$\{i\}-([A-Za-zÇĞİÖŞÜçğıöşü]+)/g)].map(
        (m) => m[1]
      )
    ),
  ];

  it("sipariş action'ı en az bir alan okuyor (test kendini sınıyor)", () => {
    expect(okunanlar.length).toBeGreaterThan(5);
    expect(okunanlar).toContain("birimFiyat");
  });

  it("sipariş formu okunan HER alanı `name` ile gönderiyor", () => {
    for (const alan of okunanlar) {
      expect(
        SIPARIS_FORM,
        `SiparisForm '${alan}' alanını göndermiyor — sunucu 0/boş okur`
      ).toContain(`kalem-\${i}-${alan}\`}`);
    }
  });

  it("PAKET GRUBU da bütün alanları gönderiyor", () => {
    // Grup kendi bileşeninde; satır alanları oraya ayrıca yazılmalı.
    const bas = SIPARIS_FORM.indexOf("function PaketGrubu(");
    const son = SIPARIS_FORM.indexOf("function UrunSatiri(", bas);
    const govde = SIPARIS_FORM.slice(bas, son);
    for (const alan of okunanlar) {
      expect(
        govde,
        `PaketGrubu '${alan}' alanını göndermiyor`
      ).toContain(`kalem-\${i}-${alan}\`}`);
    }
  });

  it("teklif formu da kendi alanlarını gönderiyor", () => {
    for (const alan of ["aciklama", "miktar", "birim", "birimFiyat", "urunId", "paketId", "paketAdedi", "kampanyaId"]) {
      expect(TEKLIF_FORM, `TeklifForm '${alan}' göndermiyor`).toContain(
        `kalem-\${i}-${alan}\`}`
      );
    }
  });
});
