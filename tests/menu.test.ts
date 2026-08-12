import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  BOLUMLER,
  bolum,
  bolumHedefi,
  gorunurSekmeler,
  sekmeAktifMi,
  etkinSekme,
  yolunBolumu,
} from "../src/lib/bolum-tanimlar";
import { IZIN_ETIKET } from "../src/lib/yetki-tanimlar";

/**
 * Menü konsolidasyonu — v1.22.0.
 *
 * Buradaki asıl sözler:
 *   1. HİÇBİR ROTA DEĞİŞMEDİ — her sekme gerçek bir sayfaya işaret eder.
 *   2. Her sekme GERÇEK bir izne bağlıdır; uydurma izin, süzgeci sessizce
 *      etkisiz bırakırdı.
 *   3. Bölüme tıklayan kullanıcı, GÖREBİLDİĞİ ilk ekrana gider — izni
 *      olmayan bir ekrana yönlendirilip /yetkisiz'e düşmez.
 */

/** Rotanın gerçekten bir sayfası var mı? */
function sayfaVarMi(rota: string): boolean {
  const yol = rota.replace(/^\//, "");
  return existsSync(`src/app/(app)/${yol}/page.tsx`);
}

describe("Bölüm kayıt defteri", () => {
  it("beklenen bölümler tanımlı", () => {
    expect(BOLUMLER.map((b) => b.anahtar)).toEqual(["crm", "ayarlar", "satis"]);
    expect(bolum("crm")?.etiket).toBe("CRM");
    expect(bolum("satis")?.etiket).toBe("Satış Yönetimi");
    expect(bolum("yok")).toBeUndefined();
  });

  it("her sekmenin GERÇEK bir sayfası var (rotalar değişmedi)", () => {
    for (const b of BOLUMLER) {
      for (const s of b.sekmeler) {
        expect(sayfaVarMi(s.href), `${s.href} sayfası yok`).toBe(true);
        for (const es of s.esRotalar ?? []) {
          expect(sayfaVarMi(es), `${es} sayfası yok`).toBe(true);
        }
      }
    }
  });

  it("her sekme tanımlı bir izne bağlı", () => {
    for (const b of BOLUMLER) {
      for (const s of b.sekmeler) {
        if (!s.izin) continue;
        expect(IZIN_ETIKET[s.izin], `${s.href} → ${s.izin} tanımsız`).toBeTruthy();
      }
    }
  });

  it("aynı rota iki bölümde birden yer almaz", () => {
    const hepsi = BOLUMLER.flatMap((b) => b.sekmeler.map((s) => s.href));
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });

  it("CRM istenen ekranları taşıyor", () => {
    const crm = bolum("crm")!.sekmeler.map((s) => s.href);
    for (const r of [
      "/firmalar",
      "/firsatlar",
      "/kisiler",
      "/aktiviteler",
      "/projeler",
      "/destek",
      "/ziyaretler",
      "/anketler",
      "/kampanyalar",
      "/yatirim-destekleri",
      "/egitimler",
      "/hizmetler",
    ]) {
      expect(crm, `${r} CRM'de yok`).toContain(r);
    }
  });

  it("Satış Yönetimi istenen ekranları taşıyor", () => {
    const satis = bolum("satis")!.sekmeler.map((s) => s.href);
    expect(satis).toEqual([
      "/teklifler",
      "/siparisler",
      "/sevkiyat",
      "/stok",
      "/urunler",
    ]);
  });
});

describe("İzin süzgeci", () => {
  it("göremediği ekranın sekmesi çıkmaz", () => {
    const b = bolum("satis")!;
    const sekmeler = gorunurSekmeler(b, new Set(["teklif.goruntule", "stok.goruntule"]));
    expect(sekmeler.map((s) => s.href)).toEqual(["/teklifler", "/stok"]);
  });

  it("bölüm hedefi GÖREBİLDİĞİ ilk ekrandır", () => {
    const b = bolum("crm")!;
    // Firma izni yoksa hedef ilk görünür sekmeye kayar.
    expect(bolumHedefi(b, new Set(["firma.goruntule"]))).toBe("/firmalar");
    expect(bolumHedefi(b, new Set(["destek.goruntule"]))).toBe("/destek");
  });

  it("hiç sekmesi görünmeyen bölümün hedefi yoktur", () => {
    expect(bolumHedefi(bolum("satis")!, new Set())).toBeNull();
  });
});

describe("Etkin sekme kuralı", () => {
  const firsat = bolum("crm")!.sekmeler.find((s) => s.href === "/firsatlar")!;
  const urun = bolum("satis")!.sekmeler.find((s) => s.href === "/urunler")!;

  it("alt rotada da etkin kalır", () => {
    expect(sekmeAktifMi(firsat, "/firsatlar")).toBe(true);
    expect(sekmeAktifMi(firsat, "/firsatlar/asamalar")).toBe(true);
  });

  it("EN ÖZEL eşleşme kazanır (v1.26.0)", () => {
    /*
      İç içe rotalar aynı anda iki sekmeye uyar. Kural olmadan ikisi birden
      etkin görünür ya da yanlış bölümün çubuğu çizilirdi.
    */
    const ayarlar = bolum("ayarlar")!;
    // `/otomasyon/eposta` hem Otomasyon'a hem E-posta'ya uyar.
    expect(etkinSekme(ayarlar, "/otomasyon/eposta")?.href).toBe(
      "/otomasyon/eposta"
    );
    expect(etkinSekme(ayarlar, "/otomasyon")?.href).toBe("/otomasyon");
    // `/firsatlar/asamalar` hem CRM'in Fırsatlar'ına hem Ayarlar'ın Satış
    // Aşamaları'na uyar; kazanan daha DAR olandır.
    expect(yolunBolumu("/firsatlar/asamalar")?.anahtar).toBe("ayarlar");
    expect(yolunBolumu("/firsatlar")?.anahtar).toBe("crm");
  });

  it("es rota etkin sayılır (adaylar → fırsatlar, paketler → ürünler)", () => {
    expect(sekmeAktifMi(firsat, "/adaylar")).toBe(true);
    expect(sekmeAktifMi(urun, "/paketler")).toBe(true);
  });

  it("benzer ADLI başka rota etkin SAYILMAZ", () => {
    const destek = bolum("crm")!.sekmeler.find((s) => s.href === "/destek")!;
    // "/destekler" diye bir ekran olsaydı, düz startsWith onu da işaretlerdi.
    expect(sekmeAktifMi(destek, "/destekler")).toBe(false);
    expect(sekmeAktifMi(destek, "/destek/abc")).toBe(true);
  });
});

describe("Yolun bölümü", () => {
  it("bölüme ait yollar doğru bölümü bulur", () => {
    expect(yolunBolumu("/firmalar")?.anahtar).toBe("crm");
    expect(yolunBolumu("/kisiler")?.anahtar).toBe("crm");
    expect(yolunBolumu("/siparisler/abc")?.anahtar).toBe("satis");
    expect(yolunBolumu("/paketler")?.anahtar).toBe("satis");
  });

  it("bölüme ait OLMAYAN yollarda sekme çubuğu çizilmez", () => {
    // `/ai` ve `/yedekler` v1.26.0'da Ayarlar bölümünün sekmesi OLDU.
    for (const yol of ["/", "/takvim", "/raporlar", "/sss", "/kvkk", "/denetim"]) {
      expect(yolunBolumu(yol), `${yol} bir bölüme bağlanmış`).toBeUndefined();
    }
  });
});

describe("Ayarlar bölümü (v1.26.0)", () => {
  /*
    ORTAĞIN İSTEĞİ: "YÖNETİM başlığının altına Ayarlar adında bir ana sekme
    eklememiz lazım; içe aktar, kullanıcılar, gruplar, otomasyon, AI
    özellikleri, yedekler bunun altına alt sekme olarak taşınmalı."
  */
  const ayarlar = bolum("ayarlar")!;
  const rotalar = ayarlar.sekmeler.map((s) => s.href);

  it("istenen ekranların hepsi sekme oldu", () => {
    for (const r of [
      "/ice-aktar",
      "/kullanicilar",
      "/gruplar",
      "/otomasyon",
      "/ai",
      "/yedekler",
    ]) {
      expect(rotalar, `${r} Ayarlar'a taşınmamış`).toContain(r);
    }
  });

  it("e-posta ayarı Otomasyon'dan ÇIKARILIP kendi sekmesi oldu", () => {
    expect(rotalar).toContain("/otomasyon/eposta");
    const sayfa = readFileSync("src/app/(app)/otomasyon/page.tsx", "utf8");
    expect(sayfa, "Otomasyon ekranı hâlâ e-posta bağlantısı taşıyor").not.toContain(
      "/otomasyon/eposta"
    );
  });

  it("sistem ayarı olan diğer ekranlar da alındı", () => {
    // İstekte adı geçmiyordu ama yerleri burasıydı.
    expect(rotalar).toContain("/ozel-alanlar");
    expect(rotalar).toContain("/firsatlar/asamalar");
  });

  it("HİÇBİR ROTA DEĞİŞMEDİ — sayfalar yerli yerinde", () => {
    for (const r of rotalar) {
      const yol = `src/app/(app)${r}/page.tsx`;
      expect(existsSync(yol), `${r} için sayfa yok: ${yol}`).toBe(true);
    }
  });

  it("her sekme GERÇEK bir izin anahtarına bağlı", () => {
    // Uydurma bir izin, sekmeyi sessizce herkesten gizlerdi.
    for (const s of ayarlar.sekmeler) {
      expect(s.izin, `${s.href} izinsiz`).toBeTruthy();
      expect(IZIN_ETIKET, `${s.izin} tanımsız izin`).toHaveProperty(s.izin!);
    }
  });

  it("izni olmayan kullanıcı için bölüm hiç açılmaz", () => {
    expect(bolumHedefi(ayarlar, new Set())).toBeNull();
    // Yalnızca yedek izni olan kullanıcı doğrudan Yedekler'e düşer.
    expect(bolumHedefi(ayarlar, new Set(["yedek.yonet"]))).toBe("/yedekler");
  });

  it("Denetim Günlüğü ve KVKK bilinçli olarak DIŞARIDA", () => {
    // Denetim bir ayar değil kayıttır; KVKK kişisel bir haktır.
    expect(rotalar).not.toContain("/denetim");
    expect(rotalar).not.toContain("/kvkk");
  });
});
