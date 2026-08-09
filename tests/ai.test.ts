import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  AI_TURLERI,
  OZET_ALANLARI,
  OZET_GONDERILMEYENLER,
  aiKapaliSebebi,
  aiKullanilabilir,
  tokenMetni,
} from "../src/lib/ai-tanimlar";
import {
  EN_AZ_ORNEK,
  KIRILIM_EN_AZ,
  skorHesapla,
  skorSeviyesi,
  skorTabani,
  gunFarki,
  type GecmisIs,
} from "../src/lib/skor-saf";
import { ozetSatirlari, ozetIstemi } from "../src/lib/firma-ozet-saf";
import {
  SORGU_HEDEFLERI,
  jsonAyikla,
  sorguAdresi,
  sorguCoz,
  sorguDogrula,
  sorguHedefi,
  sorguSistemIstemi,
} from "../src/lib/sorgu-saf";
import { IZIN_ETIKET } from "../src/lib/yetki-tanimlar";

/**
 * AI özellikleri — Faz 21 / G1-G3.
 *
 * Buradaki asıl sözler:
 *   1. Skor kiracının KENDİ verisinden çıkar ve açıklanabilir; az örnekle
 *      "yeterli veri" iddiasında bulunmaz.
 *   2. AI üç kapıdan geçer; biri kapalıysa çağrı YAPILMAZ ve sebebi söylenir.
 *   3. Doğal dilde sorgu yalnızca SÜZGEÇ üretir; beyaz listede olmayan alan
 *      sessizce atılır ve izinsiz hedef reddedilir.
 */

// ── G1: skorlama ────────────────────────────────────────────────────────

function gecmisUret(kazanan: number, kaybeden: number, sektor = "Tekstil"): GecmisIs[] {
  return [
    ...Array.from({ length: kazanan }, () => ({
      kazanildi: true,
      sektor,
      tutar: 100_000,
      kaynak: "fuar",
    })),
    ...Array.from({ length: kaybeden }, () => ({
      kazanildi: false,
      sektor,
      tutar: 100_000,
      kaynak: "fuar",
    })),
  ];
}

const ACIK = {
  sektor: "Tekstil",
  tutar: 100_000,
  kaynak: "fuar",
  asamaOlasilik: 50,
  sonTemasGun: 10,
  aktiviteSayisi: 3,
};

describe("Skorlama tabanı (G1)", () => {
  it("genel kazanma oranını hesaplar", () => {
    const t = skorTabani(gecmisUret(6, 4));
    expect(t.genelOran).toBe(60);
    expect(t.ornekSayisi).toBe(10);
  });

  it("örnek azken kırılım oranı ÜRETİLMEZ (uydurulmaz)", () => {
    const t = skorTabani(gecmisUret(2, 1)); // 3 iş, KIRILIM_EN_AZ'ın altında
    expect(t.sektorOrani.size).toBe(0);
    expect(KIRILIM_EN_AZ).toBeGreaterThan(3);
  });

  it("yeterli örnekte kırılım oranı üretilir", () => {
    const t = skorTabani(gecmisUret(4, 4));
    expect(t.sektorOrani.get("Tekstil")).toBe(50);
  });

  it("boş geçmişte çökmez, oran sıfırdır", () => {
    const t = skorTabani([]);
    expect(t.genelOran).toBe(0);
    expect(t.ortancaKazanilanTutar).toBe(0);
  });
});

describe("Skor hesabı (G1)", () => {
  it("0-100 aralığının dışına çıkmaz", () => {
    const t = skorTabani(gecmisUret(20, 0));
    const yuksek = skorHesapla({ ...ACIK, asamaOlasilik: 100, sonTemasGun: 1 }, t);
    expect(yuksek.deger).toBeLessThanOrEqual(100);

    const t2 = skorTabani(gecmisUret(0, 20));
    const dusuk = skorHesapla(
      { ...ACIK, asamaOlasilik: 0, sonTemasGun: 200, aktiviteSayisi: 0 },
      t2
    );
    expect(dusuk.deger).toBeGreaterThanOrEqual(0);
  });

  it("her etken bir gerekçe cümlesi taşır (açıklanabilirlik)", () => {
    const t = skorTabani(gecmisUret(6, 4));
    const skor = skorHesapla(ACIK, t);
    expect(skor.etkenler.length).toBeGreaterThan(0);
    for (const e of skor.etkenler) {
      expect(e.aciklama.length).toBeGreaterThan(5);
      expect(e.etiket.length).toBeGreaterThan(0);
    }
  });

  it("hiç aktivite yoksa skor düşer ve sebebi yazılır", () => {
    const t = skorTabani(gecmisUret(6, 4));
    const temasli = skorHesapla(ACIK, t);
    const temassiz = skorHesapla({ ...ACIK, aktiviteSayisi: 0, sonTemasGun: null }, t);
    expect(temassiz.deger).toBeLessThan(temasli.deger);
    expect(temassiz.etkenler.some((e) => e.aciklama.includes("aktivite"))).toBe(true);
  });

  it("uzun süredir temas edilmemiş iş cezalandırılır", () => {
    const t = skorTabani(gecmisUret(6, 4));
    const yeni = skorHesapla({ ...ACIK, sonTemasGun: 3 }, t);
    const eski = skorHesapla({ ...ACIK, sonTemasGun: 90 }, t);
    expect(eski.deger).toBeLessThan(yeni.deger);
  });

  it("ortancanın çok üstündeki tutar skoru düşürür", () => {
    const t = skorTabani(gecmisUret(6, 4));
    const normal = skorHesapla(ACIK, t);
    const buyuk = skorHesapla({ ...ACIK, tutar: 100_000 * 10 }, t);
    expect(buyuk.deger).toBeLessThan(normal.deger);
  });

  it("az örnekle 'yeterli veri' İDDİA ETMEZ", () => {
    const az = skorHesapla(ACIK, skorTabani(gecmisUret(2, 1)));
    expect(az.yeterliVeri).toBe(false);
    const cok = skorHesapla(ACIK, skorTabani(gecmisUret(8, 4)));
    expect(cok.yeterliVeri).toBe(true);
    expect(EN_AZ_ORNEK).toBeGreaterThanOrEqual(10);
  });

  it("aynı girdi HER ZAMAN aynı skoru verir (denetlenebilirlik)", () => {
    const t = skorTabani(gecmisUret(6, 4));
    expect(skorHesapla(ACIK, t).deger).toBe(skorHesapla(ACIK, t).deger);
  });

  it("seviye eşikleri tutarlı", () => {
    expect(skorSeviyesi(80)).toBe("yuksek");
    expect(skorSeviyesi(50)).toBe("orta");
    expect(skorSeviyesi(10)).toBe("dusuk");
  });

  it("gün farkı saat/dakikayı yok sayar", () => {
    const a = new Date("2026-08-10T23:00:00Z");
    const b = new Date("2026-08-08T01:00:00Z");
    expect(gunFarki(a, b)).toBe(2);
  });

  it("skorlama katmanı dış servise ÇAĞRI YAPMAZ", () => {
    for (const dosya of ["src/lib/skor-saf.ts", "src/lib/skor.ts"]) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak, `${dosya} dış çağrı içeriyor`).not.toContain("fetch(");
      expect(kaynak).not.toContain("anthropic");
    }
  });
});

// ── AI kapıları ─────────────────────────────────────────────────────────

describe("AI kapıları", () => {
  const acikDurum = { modulAcik: true, kiraciAcik: true, anahtarVar: true };

  it("üç kapı da açık olmadan kullanılamaz", () => {
    expect(aiKullanilabilir(acikDurum)).toBe(true);
    expect(aiKullanilabilir({ ...acikDurum, modulAcik: false })).toBe(false);
    expect(aiKullanilabilir({ ...acikDurum, kiraciAcik: false })).toBe(false);
    expect(aiKullanilabilir({ ...acikDurum, anahtarVar: false })).toBe(false);
  });

  it("kapalıysa SEBEBİ söylenir ve sebepler birbirinden ayrıdır", () => {
    expect(aiKapaliSebebi(acikDurum)).toBeNull();
    const sebepler = [
      aiKapaliSebebi({ ...acikDurum, modulAcik: false }),
      aiKapaliSebebi({ ...acikDurum, kiraciAcik: false }),
      aiKapaliSebebi({ ...acikDurum, anahtarVar: false }),
    ];
    expect(new Set(sebepler).size).toBe(3);
    for (const s of sebepler) expect(s).toBeTruthy();
  });

  it("anahtar tanımsızsa KAPALIDIR (tanımsızsa serbest DEĞİL)", () => {
    const kaynak = readFileSync("src/lib/ai.ts", "utf8");
    expect(kaynak).toContain("ANTHROPIC_API_KEY");
    // Çağrı, kapı kontrolünden SONRA yapılır.
    expect(kaynak.indexOf("aiKullanilabilir")).toBeLessThan(
      kaynak.indexOf("api.anthropic.com")
    );
  });

  it("her çağrı kullanım defterine yazılır", () => {
    const kaynak = readFileSync("src/lib/ai.ts", "utf8");
    expect(kaynak).toContain("kullanimYaz");
    expect(kaynak).toContain("aiKullanim");
  });

  it("çağrı türleri tanımlı ve tekildir", () => {
    const degerler = AI_TURLERI.map((t) => t.deger);
    expect(new Set(degerler).size).toBe(degerler.length);
  });

  it("AI izinleri gerçek izin anahtarlarıdır", () => {
    expect(IZIN_ETIKET["ai.kullan"]).toBeTruthy();
    expect(IZIN_ETIKET["ai.yonet"]).toBeTruthy();
  });

  it("token metni okunur", () => {
    expect(tokenMetni(0, 0)).toBe("—");
    expect(tokenMetni(300, 200)).toBe("500 token");
    expect(tokenMetni(1200, 800)).toBe("2.0K token");
  });
});

// ── G2: firma özeti ─────────────────────────────────────────────────────

const BOS_OZET = {
  ad: "ACME A.Ş.",
  sektor: null,
  il: null,
  firsatlar: [],
  teklifler: [],
  siparisler: [],
  destekler: [],
  sonAktiviteler: [],
  paraBirimi: "TRY",
};

describe("Firma özeti (G2)", () => {
  it("model olmadan da özet üretir", () => {
    const satirlar = ozetSatirlari({
      ...BOS_OZET,
      sektor: "Tekstil",
      il: "İzmir",
      firsatlar: [{ baslik: "Yeni hat", durum: "acik", tutar: 250_000 }],
    });
    expect(satirlar.length).toBeGreaterThan(0);
    expect(satirlar.some((s) => s.baslik === "Satış hattı")).toBe(true);
  });

  it("boş bölüm için CÜMLE ÜRETMEZ", () => {
    const satirlar = ozetSatirlari(BOS_OZET);
    expect(satirlar.some((s) => s.baslik === "Teklifler")).toBe(false);
    expect(satirlar.some((s) => s.baslik === "Siparişler")).toBe(false);
  });

  it("hiç veri yoksa dürüst bir cümle döner", () => {
    const satirlar = ozetSatirlari(BOS_OZET);
    expect(satirlar.some((s) => s.metin.includes("Kayıtlı aktivite yok"))).toBe(true);
  });

  it("ciro yalnızca ONAYLANMIŞ siparişten sayılır", () => {
    const satirlar = ozetSatirlari({
      ...BOS_OZET,
      siparisler: [
        { no: "SIP-1", durum: "onaylandi", toplam: 100 },
        { no: "SIP-2", durum: "onaybekliyor", toplam: 900 },
      ],
    });
    const satir = satirlar.find((s) => s.baslik === "Siparişler")!;
    expect(satir.metin).toContain("onay bekliyor");
    // 900 onaylanmadığı için onaylanmış tutara girmez.
    expect(satir.metin).not.toContain("1.000");
  });

  it("açık destek kaydı ayrıca sayılır", () => {
    const satirlar = ozetSatirlari({
      ...BOS_OZET,
      destekler: [
        { baslik: "Arıza", durum: "acik", oncelik: "acil" },
        { baslik: "Soru", durum: "kapandi", oncelik: "dusuk" },
      ],
    });
    const satir = satirlar.find((s) => s.baslik === "Destek")!;
    expect(satir.metin).toContain("1'i açık");
  });

  it("modele gönderilen istem YALNIZCA üretilen satırlardan kurulur", () => {
    const satirlar = ozetSatirlari({ ...BOS_OZET, sektor: "Gıda", il: "Bursa" });
    const istem = ozetIstemi("ACME A.Ş.", satirlar);
    expect(istem).toContain("ACME A.Ş.");
    for (const s of satirlar) expect(istem).toContain(s.metin);
    // Ham kayıt alanları (telefon, e-posta) istemde HİÇ geçmez.
    expect(istem).not.toContain("@");
  });

  it("gönderilenler ve gönderilmeyenler listesi doludur (söz yazılıdır)", () => {
    expect(OZET_ALANLARI.length).toBeGreaterThan(3);
    expect(OZET_GONDERILMEYENLER.length).toBeGreaterThan(3);
  });

  it("özet katmanı izin süzgecinden geçer", () => {
    const kaynak = readFileSync("src/lib/firma-ozet.ts", "utf8");
    for (const izin of [
      "firsatGoruntule",
      "teklifGoruntule",
      "siparisGoruntule",
      "destekGoruntule",
      "aktiviteGoruntule",
    ]) {
      expect(kaynak, `${izin} süzgeci yok`).toContain(izin);
    }
  });
});

// ── G3: doğal dilde sorgu ───────────────────────────────────────────────

describe("Doğal dilde sorgu (G3)", () => {
  const hepsi = new Set(SORGU_HEDEFLERI.map((h) => h.izin));

  it("her hedef gerçek bir izne bağlıdır", () => {
    for (const h of SORGU_HEDEFLERI) {
      expect(IZIN_ETIKET[h.izin], `${h.anahtar} izni tanımsız`).toBeTruthy();
    }
  });

  it("model OLMADAN tipik cümleyi çözer", () => {
    const sonuc = sorguCoz("İzmir'deki onaylanmış hibeler");
    expect(sonuc).not.toBeNull();
    expect(sonuc!.hedef).toBe("yatirim");
    expect(sonuc!.suzgec.durum).toBe("onaylandi");
    expect(sonuc!.suzgec.tur).toBe("Hibe");
  });

  it("firma sorgusunda il ve sektör yakalanır", () => {
    const sonuc = sorguCoz("Bursa'daki tekstil firmaları");
    expect(sonuc!.hedef).toBe("firmalar");
    expect(sonuc!.suzgec.il).toBe("Bursa");
    expect(sonuc!.suzgec.sektor).toBe("Tekstil");
  });

  it("onay bekleyen siparişleri bulur", () => {
    const sonuc = sorguCoz("onay bekleyen siparişler");
    expect(sonuc!.hedef).toBe("siparisler");
    expect(sonuc!.suzgec.durum).toBe("onaybekliyor");
  });

  it("fırsat durumu seçilince LİSTE görünümüne geçer (kanban yalnızca açıkları gösterir)", () => {
    const sonuc = sorguCoz("kaybedilen fırsatlar");
    expect(sonuc!.hedef).toBe("firsatlar");
    expect(sonuc!.suzgec.durum).toBe("kaybedildi");
    expect(sonuc!.suzgec.gorunum).toBe("liste");
  });

  it("anlaşılmayan cümlede YANLIŞ LİSTEYE GÖTÜRMEZ", () => {
    expect(sorguCoz("bugün hava nasıl")).toBeNull();
    expect(sorguCoz("ab")).toBeNull();
  });

  it("beyaz listede olmayan alan SESSİZCE atılır", () => {
    const sonuc = sorguDogrula(
      { hedef: "firmalar", suzgec: { il: "İzmir", uydurma: "x", tenantId: "başka" } },
      hepsi
    );
    expect(sonuc).not.toBeNull();
    expect(sonuc!.qs).toContain("il=");
    expect(sonuc!.qs).not.toContain("uydurma");
    expect(sonuc!.qs).not.toContain("tenantId");
  });

  it("tanımsız hedef reddedilir", () => {
    expect(sorguDogrula({ hedef: "kullanicilar", suzgec: {} }, hepsi)).toBeNull();
    expect(sorguDogrula({ hedef: 42, suzgec: {} }, hepsi)).toBeNull();
    expect(sorguDogrula({}, hepsi)).toBeNull();
  });

  it("İZNİ OLMAYAN hedef reddedilir", () => {
    expect(sorguDogrula({ hedef: "siparisler", suzgec: {} }, new Set())).toBeNull();
    expect(
      sorguDogrula({ hedef: "siparisler", suzgec: {} }, new Set(["siparis.goruntule"]))
    ).not.toBeNull();
  });

  it("üretilen adres hedefin kendi rotasıdır", () => {
    const d = sorguDogrula({ hedef: "destek", suzgec: { durum: "acik" } }, hepsi)!;
    expect(sorguAdresi(d.hedef, d.qs)).toBe("/destek?durum=acik");
    expect(sorguAdresi(d.hedef, "")).toBe("/destek");
  });

  it("sistem istemi alan sözlüğünü içerir ve veri istemez", () => {
    const istem = sorguSistemIstemi();
    for (const h of SORGU_HEDEFLERI) expect(istem).toContain(h.anahtar);
    expect(istem).toContain("UYDURMA");
  });

  it("model yanıtından JSON ayıklanır, bozuksa null döner", () => {
    expect(jsonAyikla('İşte: {"hedef":"firmalar"} umarım olur')).toEqual({
      hedef: "firmalar",
    });
    expect(jsonAyikla("hiç JSON yok")).toBeNull();
    expect(jsonAyikla("{bozuk json")).toBeNull();
  });

  it("hedef anahtarları tekildir ve rota taşır", () => {
    const anahtarlar = SORGU_HEDEFLERI.map((h) => h.anahtar);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    for (const h of SORGU_HEDEFLERI) expect(h.rota.startsWith("/")).toBe(true);
    expect(sorguHedefi("yok")).toBeUndefined();
  });

  it("sorgu katmanı MÜŞTERİ VERİSİ göndermez", () => {
    const kaynak = readFileSync("src/lib/sorgu-saf.ts", "utf8");
    // Saf katman veritabanına hiç dokunmaz; istem yalnızca sözlükten kurulur.
    expect(kaynak).not.toContain("prisma");
    expect(kaynak).not.toContain("getTenantDb");
    expect(kaynak).not.toContain("fetch(");
  });
});
