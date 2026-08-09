import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  ARAMA_TURLERI,
  EN_AZ_TERIM,
  HIZLI_EYLEMLER,
  PANEL_ANAHTARI,
  TUR_BASINA_SONUC,
  aramaTuru,
  eylemleriSuz,
  panelCoz,
  panelDegeri,
} from "../src/lib/arama-tanimlar";
import {
  FIRMA_SEKMELERI,
  VARSAYILAN_SEKME,
  gorunurSekmeler,
  sekmeSec,
} from "../src/lib/firma-sekme-tanimlar";
import {
  ZINCIR,
  zincirAdimi,
  zincirAnlamliMi,
  zincirSirasi,
  type ZincirHalkasi,
} from "../src/lib/zincir-tanimlar";
import { IZIN_ETIKET } from "../src/lib/yetki-tanimlar";

/**
 * Birleşik çalışma ekranı — Faz 20 / U1-U4.
 *
 * Buradaki asıl sözler:
 *   1. Aranabilir her tür GERÇEK bir izne bağlıdır (uydurma izin, izin
 *      süzgecini sessizce etkisiz bırakırdı).
 *   2. Sekme adresi doğrulanır: uydurma değer "genel"e düşer, izinsiz sekme
 *      seçilemez.
 *   3. Zincirin sırası iş akışının kendisidir ve değişmez.
 */

describe("Arama ve komut paleti kayıt defteri (U1)", () => {
  it("her aranabilir tür tanımlı bir izne bağlıdır", () => {
    for (const t of ARAMA_TURLERI) {
      expect(IZIN_ETIKET[t.izin], `${t.tur} izni tanımsız`).toBeTruthy();
    }
  });

  it("her hızlı eylem tanımlı bir izne bağlıdır", () => {
    for (const e of HIZLI_EYLEMLER) {
      expect(IZIN_ETIKET[e.izin], `${e.anahtar} izni tanımsız`).toBeTruthy();
    }
  });

  it("tür anahtarları tekildir", () => {
    const anahtarlar = ARAMA_TURLERI.map((t) => t.tur);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("eylemler Türkçe duyarsız süzülür, boş terimde hepsi döner", () => {
    expect(eylemleriSuz(HIZLI_EYLEMLER, "")).toHaveLength(HIZLI_EYLEMLER.length);
    const sonuc = eylemleriSuz(HIZLI_EYLEMLER, "SİPARİŞ");
    expect(sonuc.length).toBeGreaterThan(0);
    expect(sonuc.every((e) => e.etiket.toLocaleLowerCase("tr").includes("sipariş"))).toBe(
      true
    );
  });

  it("eşleşmeyen terimde eylem kalmaz", () => {
    expect(eylemleriSuz(HIZLI_EYLEMLER, "zzzz")).toHaveLength(0);
  });

  it("arama eşiği ve sayfa başına sonuç makul sınırlardadır", () => {
    expect(EN_AZ_TERIM).toBeGreaterThanOrEqual(2);
    expect(TUR_BASINA_SONUC).toBeGreaterThan(0);
    expect(TUR_BASINA_SONUC).toBeLessThanOrEqual(10);
  });
});

describe("Yan panel adresi (U2)", () => {
  it("panel değeri kodlanıp çözülebilir", () => {
    const deger = panelDegeri("firma", "abc123");
    expect(panelCoz(deger)).toEqual({ tur: "firma", id: "abc123" });
  });

  it("id içinde iki nokta olsa bile ilk ayıraç kullanılır", () => {
    expect(panelCoz("teklif:a:b")).toEqual({ tur: "teklif", id: "a:b" });
  });

  it("tanımsız tür, boş id ve bozuk değer reddedilir", () => {
    expect(panelCoz("uydurma:1")).toBeNull();
    expect(panelCoz("firma:")).toBeNull();
    expect(panelCoz("firma")).toBeNull();
    expect(panelCoz(null)).toBeNull();
    expect(panelCoz("")).toBeNull();
  });

  it("panel parametresi tek bir anahtarda toplanmıştır", () => {
    expect(PANEL_ANAHTARI).toBe("panel");
  });

  it("özet ucu yalnızca kayıt defterindeki türleri tanır", () => {
    const kaynak = readFileSync("src/app/api/ozet/route.ts", "utf8");
    for (const t of ARAMA_TURLERI) {
      expect(kaynak, `${t.tur} için özet dalı yok`).toContain(`case "${t.tur}"`);
    }
  });

  it("aramaTuru bilinmeyen tür için undefined döner", () => {
    expect(aramaTuru("yok")).toBeUndefined();
  });
});

describe("Firma çalışma ekranı sekmeleri (U3)", () => {
  const hepsi = new Set(
    FIRMA_SEKMELERI.flatMap((s) => s.izinler).concat(["firma.goruntule"])
  );

  it("her sekme izni gerçek bir izin anahtarıdır", () => {
    for (const s of FIRMA_SEKMELERI) {
      for (const izin of s.izinler) {
        expect(IZIN_ETIKET[izin], `${s.anahtar} → ${izin} tanımsız`).toBeTruthy();
      }
    }
  });

  it("varsayılan sekme her zaman görünür (izin gerektirmez)", () => {
    const gorunur = gorunurSekmeler(new Set());
    expect(gorunur.map((s) => s.anahtar)).toContain(VARSAYILAN_SEKME);
  });

  it("izni olmayan sekme listede görünmez", () => {
    const gorunur = gorunurSekmeler(new Set(["kisi.goruntule"]));
    expect(gorunur.map((s) => s.anahtar)).toEqual(["genel", "kontak"]);
  });

  it("uydurma sekme sessizce genele düşer", () => {
    expect(sekmeSec("uydurma", hepsi)).toBe(VARSAYILAN_SEKME);
    expect(sekmeSec(undefined, hepsi)).toBe(VARSAYILAN_SEKME);
  });

  it("izinsiz sekme seçilemez", () => {
    expect(sekmeSec("satis", new Set())).toBe(VARSAYILAN_SEKME);
    expect(sekmeSec("satis", new Set(["teklif.goruntule"]))).toBe("satis");
  });

  it("sekme anahtarları tekildir", () => {
    const anahtarlar = FIRMA_SEKMELERI.map((s) => s.anahtar);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("firma sayfası her sekmeyi gerçekten çiziyor", () => {
    const kaynak = readFileSync("src/app/(app)/firmalar/[id]/page.tsx", "utf8");
    for (const s of FIRMA_SEKMELERI) {
      expect(kaynak, `${s.anahtar} sekmesinin gövdesi yok`).toContain(
        `sekme === "${s.anahtar}"`
      );
    }
  });
});

describe("İlişkili kayıt zinciri (U4)", () => {
  it("sıra iş akışının kendisidir: fırsat → teklif → sipariş → sevkiyat", () => {
    expect(ZINCIR.map((z) => z.tur)).toEqual([
      "firsat",
      "teklif",
      "siparis",
      "sevkiyat",
    ]);
    expect(zincirSirasi("teklif")).toBeLessThan(zincirSirasi("siparis"));
    expect(zincirSirasi("yok")).toBe(-1);
  });

  it("her halka gerçek bir izne bağlıdır", () => {
    for (const z of ZINCIR) {
      expect(IZIN_ETIKET[z.izin], `${z.tur} izni tanımsız`).toBeTruthy();
    }
    expect(zincirAdimi("sevkiyat")?.etiket).toBe("Sevkiyat");
  });

  it("tek dolu halka varsa şerit anlamsızdır", () => {
    const halkalar: ZincirHalkasi[] = ZINCIR.map((z, i) => ({
      tur: z.tur,
      etiket: z.etiket,
      baslik: i === 1 ? "TKF-1" : null,
      durum: null,
      adres: null,
      aktif: i === 1,
      izinsiz: false,
    }));
    expect(zincirAnlamliMi(halkalar)).toBe(false);

    halkalar[2].baslik = "SIP-1";
    expect(zincirAnlamliMi(halkalar)).toBe(true);
  });

  it("zincir kurucusu kiracı katmanından geçer", () => {
    expect(existsSync("src/lib/zincir.ts")).toBe(true);
    const kaynak = readFileSync("src/lib/zincir.ts", "utf8");
    // Doğrudan Prisma istemcisi kullanılmaz; db argümanı kiracı katmanından gelir.
    expect(kaynak).not.toContain("@prisma/client");
    expect(kaynak).toContain("server-only");
  });
});
