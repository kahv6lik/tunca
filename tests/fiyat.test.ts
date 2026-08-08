import { describe, it, expect } from "vitest";
import {
  satirFiyatiHesapla,
  kampanyaIndirimi,
  enIyiKampanya,
  paketBirimFiyati,
  kampanyaGecerliMi,
  type FiyatKampanyasi,
  type FiyatPaketi,
} from "../src/lib/fiyat-saf";

/**
 * Fiyat motoru — Faz 14 / T6.
 *
 * Bu dosya projedeki en "para" testidir: buradaki bir hata doğrudan yanlış
 * fatura demektir. Bu yüzden sınır durumları (negatif fiyat, kota taşması,
 * ters kampanya) mutlulukla birlikte sınanır.
 */

const URUN = { urunId: "u1", listeFiyat: 100, kdvOrani: 20 };

function kampanya(over: Partial<FiyatKampanyasi> = {}): FiyatKampanyasi {
  return {
    kampanyaId: "k1",
    kod: "K1",
    ad: "Kampanya",
    tip: "yuzde",
    deger: 10,
    alN: 0,
    odeM: 0,
    kalanKota: 0,
    ...over,
  };
}

describe("Fiyat motoru — temel akış", () => {
  it("kampanyasız satır: liste × miktar + KDV", () => {
    const s = satirFiyatiHesapla(URUN, 3);
    expect(s.listeTutar).toBe(300);
    expect(s.netTutar).toBe(300);
    expect(s.kdvTutari).toBe(60);
    expect(s.toplam).toBe(360);
    expect(s.kampanya).toBeNull();
  });

  it("KDV indirimli tutar üzerinden hesaplanır, liste üzerinden değil", () => {
    // %10 indirimde KDV 20 değil 18 olmalı; aksi halde müşteri almadığı
    // indirimin vergisini öder.
    const s = satirFiyatiHesapla(URUN, 1, { kampanyalar: [kampanya()] });
    expect(s.netTutar).toBe(90);
    expect(s.kdvTutari).toBe(18);
    expect(s.toplam).toBe(108);
  });

  it("miktar 0 ise her şey sıfırdır (negatif miktar da 0 sayılır)", () => {
    expect(satirFiyatiHesapla(URUN, 0).toplam).toBe(0);
    expect(satirFiyatiHesapla(URUN, -5).toplam).toBe(0);
  });
});

describe("Paket fiyatlaması", () => {
  const iskontolu: FiyatPaketi = {
    paketId: "p1",
    sabitFiyat: false,
    fiyat: 0,
    iskontoOrani: 25,
    kalemler: [{ urunId: "u1", miktar: 1, listeFiyat: 100 }],
  };

  const sabit: FiyatPaketi = {
    paketId: "p2",
    sabitFiyat: true,
    fiyat: 900, // liste toplamı 1200 olan iki kalem için
    iskontoOrani: 0,
    kalemler: [
      { urunId: "u1", miktar: 2, listeFiyat: 100 }, // 200
      { urunId: "u2", miktar: 1, listeFiyat: 1000 }, // 1000
    ],
  };

  it("iskontolu pakette birim fiyat liste üzerinden düşer", () => {
    expect(paketBirimFiyati(iskontolu, "u1", 100)).toBe(75);
  });

  it("sabit paket fiyatı kalemlere LİSTE DEĞERİNE ORANTILI dağıtılır", () => {
    // u1'in payı 200/1200 = 1/6 → 900/6 = 150 → 2 adet için birim 75
    expect(paketBirimFiyati(sabit, "u1", 100)).toBe(75);
    // u2'nin payı 1000/1200 → 750 → 1 adet için birim 750
    expect(paketBirimFiyati(sabit, "u2", 1000)).toBe(750);
    // Dağıtılan toplam, paket fiyatını aşmamalı.
    expect(75 * 2 + 750 * 1).toBe(900);
  });

  it("pakette olmayan ürün için paket fiyatı YOKTUR (liste geçerli)", () => {
    expect(paketBirimFiyati(sabit, "baska-urun", 50)).toBeNull();
    const s = satirFiyatiHesapla(
      { urunId: "baska-urun", listeFiyat: 50, kdvOrani: 20 },
      1,
      { paket: sabit }
    );
    expect(s.netTutar).toBe(50);
  });

  it("paket kampanyadan ÖNCE gelir; kampanya paket fiyatının üzerine biner", () => {
    const s = satirFiyatiHesapla(URUN, 1, {
      paket: iskontolu, // 100 → 75
      kampanyalar: [kampanya({ tip: "yuzde", deger: 10 })], // 75 → 67.5
    });
    expect(s.birimFiyat).toBe(75);
    expect(s.netTutar).toBe(67.5);
  });
});

describe("Kampanya tipleri", () => {
  it("yüzde indirimi 0–100 aralığına sıkışır", () => {
    expect(kampanyaIndirimi(kampanya({ deger: 150 }), 100, 1).indirim).toBe(100);
    expect(kampanyaIndirimi(kampanya({ deger: -20 }), 100, 1).indirim).toBe(0);
  });

  it("tutar indirimi satırdan büyük olamaz — negatif fiyat üretmez", () => {
    const s = satirFiyatiHesapla(URUN, 1, {
      kampanyalar: [kampanya({ tip: "tutar", deger: 500 })],
    });
    expect(s.netTutar).toBe(0);
    expect(s.toplam).toBe(0);
  });

  it("3 al 2 öde: her üç adette biri bedava", () => {
    const k = kampanya({ tip: "alnodem", alN: 3, odeM: 2 });
    expect(kampanyaIndirimi(k, 100, 3).indirim).toBe(100);
    expect(kampanyaIndirimi(k, 100, 6).indirim).toBe(200);
    // Grup tamamlanmadıysa indirim yok.
    expect(kampanyaIndirimi(k, 100, 2).indirim).toBe(0);
  });

  it("bozuk al/öde tanımı indirim üretmez (M ≥ N anlamsızdır)", () => {
    expect(kampanyaIndirimi(kampanya({ tip: "alnodem", alN: 2, odeM: 3 }), 100, 10).indirim).toBe(0);
    expect(kampanyaIndirimi(kampanya({ tip: "alnodem", alN: 0, odeM: 0 }), 100, 10).indirim).toBe(0);
  });

  it("paket fiyatı tipi birim fiyatı hedefe çeker, pahalılaştırmaz", () => {
    expect(kampanyaIndirimi(kampanya({ tip: "paketfiyat", deger: 80 }), 100, 2).indirim).toBe(40);
    // Hedef fiyat listeden yüksekse indirim uygulanmaz.
    expect(kampanyaIndirimi(kampanya({ tip: "paketfiyat", deger: 120 }), 100, 2).indirim).toBe(0);
  });

  it("tanınmayan tip indirim üretmez", () => {
    const bozuk = { ...kampanya(), tip: "uydurma" as never };
    expect(kampanyaIndirimi(bozuk, 100, 5).indirim).toBe(0);
  });
});

describe("Kota", () => {
  it("indirim yalnızca KALAN KOTA kadar adede uygulanır", () => {
    // 5 hakkı kalan kampanyadan 8 adet satılıyor: indirim 5 adede.
    const k = kampanya({ deger: 50, kalanKota: 5 });
    const { indirim, kullanilanAdet } = kampanyaIndirimi(k, 100, 8);
    expect(indirim).toBe(250);
    expect(kullanilanAdet).toBe(5);
  });

  it("kota 0 ise sınırsızdır", () => {
    const k = kampanya({ deger: 50, kalanKota: 0 });
    expect(kampanyaIndirimi(k, 100, 8).indirim).toBe(400);
  });
});

describe("Tek kampanya seçimi", () => {
  const yuzde20 = kampanya({ kampanyaId: "a", kod: "A", deger: 20 });
  const tutar50 = kampanya({ kampanyaId: "b", kod: "B", tip: "tutar", deger: 50 });

  it("müşteriye en avantajlı olan seçilir", () => {
    // 1 adet 100 TL: %20 → 20 TL, sabit 50 TL → sabit kazanır.
    expect(enIyiKampanya([yuzde20, tutar50], 100, 1)!.kampanya.kod).toBe("B");
    // 10 adet 1000 TL: %20 → 200 TL, sabit 50 TL → yüzde kazanır.
    expect(enIyiKampanya([yuzde20, tutar50], 100, 10)!.kampanya.kod).toBe("A");
  });

  it("indirimler ÜST ÜSTE BİNMEZ — yalnızca biri uygulanır", () => {
    const s = satirFiyatiHesapla(URUN, 10, { kampanyalar: [yuzde20, tutar50] });
    expect(s.indirimTutari).toBe(200); // 200 + 50 DEĞİL
    expect(s.kampanya!.kod).toBe("A");
  });

  it("kullanıcı seçimi motorun önerisini geçersiz kılar", () => {
    const s = satirFiyatiHesapla(URUN, 10, {
      kampanyalar: [yuzde20, tutar50],
      secilenKampanyaId: "b",
    });
    expect(s.kampanya!.kod).toBe("B");
    expect(s.indirimTutari).toBe(50);
  });

  it("adaylar arasında olmayan bir kampanya id'si indirim ÜRETMEZ", () => {
    // İstemciden gelen uydurma bir id'ye güvenmek, indirim yetkisini
    // herkese açmak olurdu.
    const s = satirFiyatiHesapla(URUN, 10, {
      kampanyalar: [yuzde20],
      secilenKampanyaId: "yetkisiz-id",
    });
    expect(s.kampanya).toBeNull();
    expect(s.indirimTutari).toBe(0);
  });
});

describe("Elle iskonto", () => {
  it("kampanyadan SONRA, kalan tutar üzerinden uygulanır", () => {
    const s = satirFiyatiHesapla(URUN, 1, {
      kampanyalar: [kampanya({ deger: 10 })], // 100 → 90
      elIskontoOrani: 10, // 90 → 81
    });
    expect(s.netTutar).toBe(81);
    expect(s.indirimTutari).toBe(19);
  });

  it("%100'ü aşan iskonto negatif fiyat üretmez", () => {
    const s = satirFiyatiHesapla(URUN, 1, { elIskontoOrani: 500 });
    expect(s.netTutar).toBe(0);
    expect(s.toplam).toBe(0);
  });
});

describe("Kampanya geçerlilik kuralı", () => {
  const temel = {
    durum: "aktif",
    baslangic: new Date("2026-08-01"),
    bitis: new Date("2026-08-31"),
    kota: 0,
    kullanilan: 0,
    urunIdler: [] as string[],
    paketIdler: [] as string[],
    firmaIdler: [] as string[],
  };
  const an = new Date("2026-08-15");

  it("aktif, tarihi geçerli ve kapsamı boş kampanya herkese açıktır", () => {
    expect(kampanyaGecerliMi(temel, { an, firmaId: "f1", urunId: "u1" })).toBe(true);
  });

  it("taslak ya da duraklatılmış kampanya uygulanmaz", () => {
    expect(kampanyaGecerliMi({ ...temel, durum: "taslak" }, { an })).toBe(false);
    expect(kampanyaGecerliMi({ ...temel, durum: "duraklatildi" }, { an })).toBe(false);
  });

  it("tarih aralığının dışında uygulanmaz", () => {
    expect(kampanyaGecerliMi(temel, { an: new Date("2026-07-31") })).toBe(false);
    expect(kampanyaGecerliMi(temel, { an: new Date("2026-09-01") })).toBe(false);
  });

  it("kotası dolmuş kampanya uygulanmaz", () => {
    expect(kampanyaGecerliMi({ ...temel, kota: 5, kullanilan: 5 }, { an })).toBe(false);
    expect(kampanyaGecerliMi({ ...temel, kota: 5, kullanilan: 4 }, { an })).toBe(true);
  });

  it("firma kapsamı doluysa yalnızca o firmalara açıktır", () => {
    const k = { ...temel, firmaIdler: ["f1"] };
    expect(kampanyaGecerliMi(k, { an, firmaId: "f1" })).toBe(true);
    expect(kampanyaGecerliMi(k, { an, firmaId: "f2" })).toBe(false);
    expect(kampanyaGecerliMi(k, { an })).toBe(false);
  });

  it("ürün kapsamı doluysa yalnızca o ürünlere açıktır", () => {
    const k = { ...temel, urunIdler: ["u1"] };
    expect(kampanyaGecerliMi(k, { an, urunId: "u1" })).toBe(true);
    expect(kampanyaGecerliMi(k, { an, urunId: "u9" })).toBe(false);
  });
});
