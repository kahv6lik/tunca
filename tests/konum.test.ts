import { readFileSync } from "node:fs";
import { paketStokKapasitesi } from "../src/lib/urun-tanimlar";
import {
  firmaninKampanyalari,
  type KapsamliKampanya,
} from "../src/lib/fiyat-saf";
import { describe, it, expect } from "vitest";
import {
  koordinatAyristir,
  koordinatGecerliMi,
  konumDogrula,
  mesafeMetre,
  sureDakika,
  sureMetniDakika,
  adresMetni,
  yenidenGerekliMi,
} from "../src/lib/konum-saf";

/**
 * Konum ve ziyaret kuralları — Faz 17 / A3, A4, A5.
 *
 * Buradaki asıl söz: konum ALINAMADIĞINDA ziyaret "uzak" sayılmaz. Teknik
 * bir aksaklık, personeli suçlu duruma düşürmemelidir (karar 4, v1.17.0).
 */

// Ankara Kızılay ve yakın çevresi
const KIZILAY = { enlem: 39.920777, boylam: 32.854108 };

describe("Mesafe hesabı", () => {
  it("aynı nokta 0 metre", () => {
    expect(mesafeMetre(KIZILAY.enlem, KIZILAY.boylam, KIZILAY.enlem, KIZILAY.boylam)).toBe(0);
  });

  it("bir derece enlem ~111 km", () => {
    const m = mesafeMetre(39, 32, 40, 32);
    expect(m).toBeGreaterThan(110_000);
    expect(m).toBeLessThan(112_000);
  });

  it("KÜRESEL hesap kullanılır — boylam farkı enleme göre kısalır", () => {
    // 39. enlemde bir derece boylam ≈ 86 km; düz Öklid hesabı 111 km derdi.
    const m = mesafeMetre(39, 32, 39, 33);
    expect(m).toBeGreaterThan(84_000);
    expect(m).toBeLessThan(88_000);
  });

  it("yakın mesafeler metre hassasiyetinde", () => {
    // ~0.001 derece enlem ≈ 111 m
    const m = mesafeMetre(KIZILAY.enlem, KIZILAY.boylam, KIZILAY.enlem + 0.001, KIZILAY.boylam);
    expect(m).toBeGreaterThan(105);
    expect(m).toBeLessThan(118);
  });
});

describe("Koordinat doğrulama ve ayrıştırma", () => {
  it("sınırlar dışındaki değerler reddedilir", () => {
    expect(koordinatGecerliMi(39.9, 32.8)).toBe(true);
    expect(koordinatGecerliMi(91, 32.8)).toBe(false);
    expect(koordinatGecerliMi(39.9, 181)).toBe(false);
    expect(koordinatGecerliMi(NaN, 32.8)).toBe(false);
    expect(koordinatGecerliMi("39.9", 32.8)).toBe(false);
  });

  it("yapıştırılan metin ayrıştırılır", () => {
    expect(koordinatAyristir("39.920777, 32.854108")).toEqual({
      enlem: 39.920777,
      boylam: 32.854108,
    });
    expect(koordinatAyristir("39.920777 32.854108")).not.toBeNull();
    expect(koordinatAyristir("bilinmeyen")).toBeNull();
    expect(koordinatAyristir("39.9")).toBeNull();
  });
});

describe("Ziyaret konum doğrulaması", () => {
  const yaricap = 300;

  it("yarıçap içindeki ziyaret DOĞRULANIR", () => {
    const sonuc = konumDogrula(
      KIZILAY,
      { enlem: KIZILAY.enlem + 0.001, boylam: KIZILAY.boylam },
      yaricap
    );
    expect(sonuc.durum).toBe("dogrulandi");
    expect(sonuc.mesafeM).toBeLessThan(yaricap);
  });

  it("yarıçap dışındaki ziyaret UZAK işaretlenir", () => {
    const sonuc = konumDogrula(
      KIZILAY,
      { enlem: KIZILAY.enlem + 0.05, boylam: KIZILAY.boylam },
      yaricap
    );
    expect(sonuc.durum).toBe("uzak");
    expect(sonuc.aciklama).toContain("uzakta");
  });

  it("konum alınamadıysa UZAK DEĞİL, 'alinamadi' olur", () => {
    // Teknik aksaklık suç değildir; ziyaret yine de açılır.
    const sonuc = konumDogrula(KIZILAY, { enlem: null, boylam: null }, yaricap);
    expect(sonuc.durum).toBe("alinamadi");
    expect(sonuc.mesafeM).toBeNull();
  });

  it("firmanın koordinatı yoksa karşılaştırma yapılmaz", () => {
    const sonuc = konumDogrula({ enlem: null, boylam: null }, KIZILAY, yaricap);
    expect(sonuc.durum).toBe("alinamadi");
    expect(sonuc.aciklama).toContain("kayıtlı konumu yok");
  });

  it("sınırdaki mesafe İÇERİDE sayılır", () => {
    const sonuc = konumDogrula(KIZILAY, KIZILAY, 0);
    expect(sonuc.durum).toBe("dogrulandi");
  });
});

describe("Ziyaret süresi", () => {
  it("dakika olarak hesaplanır", () => {
    const t0 = new Date("2026-08-10T09:00:00");
    expect(sureDakika(t0, new Date("2026-08-10T10:25:00"))).toBe(85);
  });

  it("ters damgada negatif üretilmez", () => {
    const t0 = new Date("2026-08-10T09:00:00");
    expect(sureDakika(t0, new Date("2026-08-10T08:00:00"))).toBe(0);
  });

  it("okunur metne çevrilir", () => {
    expect(sureMetniDakika(null)).toBe("—");
    expect(sureMetniDakika(45)).toBe("45 dk");
    expect(sureMetniDakika(120)).toBe("2 sa");
    expect(sureMetniDakika(85)).toBe("1 sa 25 dk");
  });
});

describe("Geocoding maliyet koruması", () => {
  const firma = { adres: "Atatürk Bulvarı 1", ilce: "Çankaya", il: "Ankara" };

  it("adres tek satıra toplanır", () => {
    expect(adresMetni(firma)).toBe("Atatürk Bulvarı 1, Çankaya, Ankara, Türkiye");
    expect(adresMetni({})).toBe("Türkiye");
  });

  it("koordinat VARSA ve adres DEĞİŞMEDİYSE yeni istek gitmez", () => {
    const adres = adresMetni(firma);
    const kayitli = { enlem: 39.9, boylam: 32.8, konumAdres: adres };
    expect(yenidenGerekliMi(kayitli, adres)).toBe(false);
  });

  it("adres değişince yeniden sorulur", () => {
    const kayitli = { enlem: 39.9, boylam: 32.8, konumAdres: "Eski adres" };
    expect(yenidenGerekliMi(kayitli, adresMetni(firma))).toBe(true);
  });

  it("koordinat yoksa sorulur; adres boşsa sorulmaz", () => {
    const bos = { enlem: null, boylam: null, konumAdres: null };
    expect(yenidenGerekliMi(bos, adresMetni(firma))).toBe(true);
    expect(yenidenGerekliMi(bos, "")).toBe(false);
  });
});

describe("Ziyaret başlatma tek adımdır (v1.26.1)", () => {
  /*
    ORTAĞIN İSTEĞİ: "Ziyarete başla dediğimizde konum alsın, ayrıca 'konum
    al' basmasın; ziyareti bitirince konum bitsin."

    Eskiden iki düğme vardı ve "Konumumu al"a basmadan başlatan kullanıcı
    ziyareti KONUMSUZ açıyordu — kayıt sessizce "doğrulanamadı" oluyor,
    doğrulamanın dayandığı tek veri kaybediliyordu.
  */
  const BASLAT = readFileSync(
    "src/components/ziyaretler/ZiyaretBaslat.tsx",
    "utf8"
  );
  const BITIR = readFileSync(
    "src/components/ziyaretler/ZiyaretBitir.tsx",
    "utf8"
  );

  it("ayrı 'konum al' düğmesi KALMADI", () => {
    expect(BASLAT).not.toContain("Konumumu al");
    expect(BASLAT).not.toContain("Konumu yenile");
  });

  it("başlatma konumu alır, SONRA formu gönderir", () => {
    expect(BASLAT).toContain("getCurrentPosition");
    // Tarayıcının kendi gönderimi konumu beklemezdi.
    expect(BASLAT).toContain("requestSubmit");
    expect(BASLAT).toContain("await konumIste()");
  });

  it("konum alınamazsa ziyaret YİNE açılır", () => {
    // Teknik aksaklık personeli işini yapamaz hâle getirmemeli (v1.17.0/4).
    expect(BASLAT).toContain("doğrulanamadı");
    expect(BASLAT).not.toContain("throw");
  });

  it("ziyaret BİTERKEN konum sorulmaz — sürekli takip yoktur", () => {
    /*
      KVKK aydınlatma metninin (v1.12.2) verdiği söz: konum yalnızca
      ziyaretin başında alınır. Bitişte konum istemek o sözü bozardı.
    */
    expect(BITIR).not.toContain("geolocation");
    expect(BASLAT).toContain("ziyaret boyunca takip");
    // Tek seferlik okuma: sürekli dinleyici (watchPosition) kurulmaz.
    expect(BASLAT).not.toContain("watchPosition");
  });
});

describe("Firmanın paketleri görünür (v1.26.1)", () => {
  /*
    ORTAĞIN İSTEĞİ: "ziyaret anında veya müşteri kartında bu paketi görmek
    gerekiyor." Paket v1.25.0'da satışa bağlandı ama yalnızca sipariş/teklif
    FORMUNDA görünüyordu.
  */
  it("firma çalışma ekranının Satış sekmesinde paket bölümü var", () => {
    const sayfa = readFileSync("src/app/(app)/firmalar/[id]/page.tsx", "utf8");
    expect(sayfa).toContain("Firmaya Açık Paketler");
    // Sekme bir SORGU KAPISIDIR (Faz 20): seçilmeyen sekme sorgulanmaz.
    expect(sayfa).toContain('sekme === "satis" && urunGorur');
  });

  it("ziyaret ekranında AÇIK ziyaretin firmasının paketleri listelenir", () => {
    const sayfa = readFileSync("src/app/(app)/ziyaretler/page.tsx", "utf8");
    expect(sayfa).toContain("Bu firmaya açık paketler");
    // Açık ziyaret yoksa sorgu hiç çalışmaz.
    expect(sayfa).toContain("acikZiyaret && urunGorur");
  });

  it("her iki ekran da GENEL paketleri de gösterir", () => {
    for (const yol of [
      "src/app/(app)/firmalar/[id]/page.tsx",
      "src/app/(app)/ziyaretler/page.tsx",
    ]) {
      expect(readFileSync(yol, "utf8"), `${yol} genel paketleri atlıyor`).toContain(
        "{ firmaId: null }"
      );
    }
  });
});

describe("Ziyaret ekranında stok ve kampanya (v1.27.3)", () => {
  /*
    ORTAĞIN İSTEĞİ: "Ziyarete başladığımızda paket tanımı görünüyor ancak
    kalan paket stok durumu görünmüyor; onun da görünmesi gerek. Ayrıca o
    firmayı kapsayan kampanyalar ve ne kadar kaldığı da görünmeli."
  */
  const SAYFA = readFileSync("src/app/(app)/ziyaretler/page.tsx", "utf8");

  it("paketin stoktan kaç adet çıkacağı gösteriliyor", () => {
    expect(SAYFA).toContain("paketStokKapasitesi");
    expect(SAYFA).toContain("paket");
    expect(SAYFA).toContain("stokta yok");
  });

  it("firmayı kapsayan kampanyalar ve kalan hak gösteriliyor", () => {
    expect(SAYFA).toContain("firmaninKampanyalari");
    expect(SAYFA).toContain("Bu firmada geçerli kampanyalar");
    expect(SAYFA).toContain("hak kaldı");
  });

  it("ikisi de İZNE bağlı ve açık ziyaret yoksa SORGULANMAZ", () => {
    // Sekme/koşul bir sorgu kapısıdır (Faz 20): göstermeyeceğimizi çekmeyiz.
    expect(SAYFA).toContain("acikZiyaret && urunGorur");
    expect(SAYFA).toContain("acikZiyaret && kampanyaGorur");
  });
});

describe("Paket stok kapasitesi — saf (v1.27.3)", () => {
  it("kapasite EN DAR kaleme bağlıdır", () => {
    /*
      Pakette 2 adet geçen bir üründen elde 5 varsa o üründen 2 paket çıkar;
      bol olan kalem kapasiteyi büyütmez.
    */
    const s = paketStokKapasitesi([
      { miktar: 2, urun: { ad: "Dar", stokTakibi: true, stokMiktar: 5, birim: "adet" } },
      { miktar: 1, urun: { ad: "Bol", stokTakibi: true, stokMiktar: 90, birim: "adet" } },
    ]);
    expect(s.yapilabilir).toBe(2);
    expect(s.darBogaz?.ad).toBe("Dar");
  });

  it("stok takibi olmayan kalem KISIT getirmez", () => {
    // Hizmet, lisans gibi kalemler tükenmez.
    const s = paketStokKapasitesi([
      { miktar: 1, urun: { ad: "Lisans", stokTakibi: false, stokMiktar: 0, birim: "adet" } },
      { miktar: 1, urun: { ad: "Cihaz", stokTakibi: true, stokMiktar: 7, birim: "adet" } },
    ]);
    expect(s.yapilabilir).toBe(7);
  });

  it("hiçbir kalem takipli değilse null döner", () => {
    // "Sınırsız" demek yanlış olurdu; doğrusu "stoktan sınırlanmıyor".
    const s = paketStokKapasitesi([
      { miktar: 1, urun: { ad: "Danışmanlık", stokTakibi: false, stokMiktar: 0, birim: "saat" } },
    ]);
    expect(s.yapilabilir).toBeNull();
    expect(s.darBogaz).toBeNull();
  });

  it("stok yetmiyorsa 0 döner ve dar boğazı söyler", () => {
    const s = paketStokKapasitesi([
      { miktar: 3, urun: { ad: "Az", stokTakibi: true, stokMiktar: 2, birim: "kutu" } },
    ]);
    expect(s.yapilabilir).toBe(0);
    expect(s.darBogaz?.ad).toBe("Az");
  });
});

describe("Firmanın kampanyaları — saf (v1.27.3)", () => {
  const K = (ek: Partial<KapsamliKampanya> = {}): KapsamliKampanya => ({
    kampanyaId: "k1", kod: "K1", ad: "Kampanya", tip: "yuzde",
    deger: 10, alN: 0, odeM: 0, kalanKota: 5,
    baslangic: "2026-01-01", bitis: "2030-12-31",
    tukendi: false, urunIdler: [], paketIdler: [], firmaIdler: [],
    ...ek,
  });
  const AN = new Date("2026-08-13");

  it("ÜRÜN/PAKET kapsamı burada SÜZGEÇ DEĞİLDİR", () => {
    /*
      Ziyaret ekranında henüz satır yoktur; soru "bu müşteriye hangi
      kampanyaları sunabilirim?" biçimindedir. Satır süzgeciyle karıştırmak
      temsilciye "kampanya yok" dedirtirdi.
    */
    const liste = firmaninKampanyalari([K({ urunIdler: ["u1"] })], "f1", AN);
    expect(liste).toHaveLength(1);
  });

  it("BAŞKA firmaya tanımlı kampanya görünmez", () => {
    expect(
      firmaninKampanyalari([K({ firmaIdler: ["f-baska"] })], "f1", AN)
    ).toHaveLength(0);
    expect(
      firmaninKampanyalari([K({ firmaIdler: ["f1"] })], "f1", AN)
    ).toHaveLength(1);
  });

  it("tarihi geçmiş ve kotası dolmuş kampanya görünmez", () => {
    expect(
      firmaninKampanyalari([K({ bitis: "2026-01-31" })], "f1", AN)
    ).toHaveLength(0);
    expect(firmaninKampanyalari([K({ tukendi: true })], "f1", AN)).toHaveLength(0);
  });
});
