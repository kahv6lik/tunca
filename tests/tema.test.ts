import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Liquid glass tema — v1.24.0.
 *
 * Bu testler GÖRÜNÜMÜ sınamaz (onu göz yapar); temanın verdiği YAPISAL
 * sözleri sınar:
 *
 *   1. Cam yalnızca görünümü değiştirir — hiçbir tıklamayı engellemez.
 *   2. Işık ve koyu temanın ikisi de tanımlıdır.
 *   3. Baskıda cam tamamen nötrleşir (Faz 9 / E5 çıktıları bozulmaz).
 *   4. Kart yüzeyi camlaştırılmadı: `ModalKatman` çözümünün dayandığı
 *      denge (v1.11.1) korundu.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");
const KATMANLAR = readFileSync("src/components/ui/CamKatmanlari.tsx", "utf8");

/** Belirli bir @media/blok içindeki metni döndürür. */
function blok(kaynak: string, isaret: string): string {
  const i = kaynak.indexOf(isaret);
  return i < 0 ? "" : kaynak.slice(i);
}

describe("Cam katmanları", () => {
  it("beş katmanın hepsi tanımlı", () => {
    for (const sinif of [
      "cam-taban",
      "cam-kirilma",
      "cam-renk",
      "cam-parlama",
      "cam-kenar",
    ]) {
      expect(CSS, `${sinif} CSS'te yok`).toContain(`.${sinif}`);
      expect(KATMANLAR, `${sinif} çizilmiyor`).toContain(sinif);
    }
  });

  it("katmanlar TIKLAMAYI ENGELLEMEZ ve içeriğin altındadır", () => {
    // Kuralın gövdesi: açılış süslü parantezinden ilk kapanışa kadar.
    const bas = CSS.indexOf(".cam > .cam-katman");
    const katmanKurali = CSS.slice(bas, CSS.indexOf("}", bas));
    expect(katmanKurali).toContain("pointer-events: none");
    expect(katmanKurali).toContain("z-index: -1");
    expect(katmanKurali).toContain("position: absolute");
  });

  it("katmanlar ekran okuyucudan gizli", () => {
    // Beş katmanın beşi de aria-hidden taşımalı.
    expect(KATMANLAR.match(/aria-hidden/g) ?? []).toHaveLength(5);
  });

  it("kırılma katmanı tek bir filtreye bakar", () => {
    expect(CSS).toContain("url(#cam-warp)");
    const filtre = readFileSync("src/components/ui/CamFiltre.tsx", "utf8");
    expect(filtre).toContain('id="cam-warp"');
    expect(filtre).toContain("feDisplacementMap");
  });
});

describe("Işık ve koyu tema", () => {
  const TOKENLAR = [
    "--cam-tint",
    "--cam-blur",
    "--cam-rim-hi",
    "--cam-sheen",
    "--cam-cast",
    "--cam-pill-a",
    "--cam-grid",
  ];

  it("her cam token'ı İKİ temada da tanımlı", () => {
    const acik = CSS.slice(CSS.indexOf(":root {"), CSS.indexOf(".dark {"));
    const koyu = CSS.slice(CSS.indexOf(".dark {"), CSS.indexOf("* {"));
    for (const t of TOKENLAR) {
      expect(acik, `${t} açık temada yok`).toContain(t);
      expect(koyu, `${t} koyu temada yok`).toContain(t);
    }
  });

  it("KOYU TEMADA imleci izleyen parlama YOKTUR", () => {
    /*
      Ortağın bulgusu: koyu zeminde beyaz parlama, imleci takip eden bir
      hale gibi okunuyor ve dikkat dağıtıyordu. Açık temada aynı katman
      buzlu camın içinde kaybolduğu için orada kaldı.
    */
    const bas = CSS.indexOf(".dark .cam-parlama");
    expect(bas, "koyu temada parlama kapatılmamış").toBeGreaterThan(-1);
    expect(CSS.slice(bas, CSS.indexOf("}", bas))).toContain("display: none");

    // Açık temada parlama DURUYOR: beğenilen görünüm bozulmasın.
    expect(CSS).toContain(".cam-parlama {");
    expect(CSS).toContain("--cam-sheen");
  });

  it("koyu tema `.dark` sınıfına bağlı (next-themes düzeni korundu)", () => {
    // data-theme'e geçilseydi mevcut tema düğmesi çalışmazdı.
    expect(CSS).toContain(".dark {");
  });
});

describe("Baskı", () => {
  it("cam katmanları ve arka plan baskıda çizilmez", () => {
    const baski = blok(CSS, "@media print");
    expect(baski).toContain(".cam-katman");
    expect(baski).toContain("body::before");
    expect(baski).toContain("body::after");
  });

  it("baskıda kabuk hâlâ gizleniyor (eski söz bozulmadı)", () => {
    const baski = blok(CSS, "@media print");
    for (const secici of ["aside", "header", "nav", "button", "form"]) {
      expect(baski, `${secici} baskıda gizlenmiyor`).toContain(secici);
    }
  });
});

describe("Bozulmaması gerekenler", () => {
  it("kart yüzeyi camlaştırılmadı (ModalKatman dengesi korundu)", () => {
    const kart = CSS.slice(CSS.indexOf(".card {"), CSS.indexOf(".glass {"));
    expect(kart).not.toContain("cam-katman");
    // Portal çözümü hâlâ yerinde.
    const modal = readFileSync("src/components/ui/ModalKatman.tsx", "utf8");
    expect(modal).toContain("createPortal");
  });

  it("cam yüzeye çevrilen kabuk parçaları katmanlarını çiziyor", () => {
    const dosyalar = [
      "src/components/layout/topbar.tsx",
      "src/components/layout/sidebar.tsx",
      "src/components/layout/BolumSekmeleri.tsx",
      "src/components/layout/mobile-nav.tsx",
      "src/components/palet/KomutPaleti.tsx",
      "src/components/panel/YanPanel.tsx",
    ];
    for (const d of dosyalar) {
      const kaynak = readFileSync(d, "utf8");
      expect(kaynak, `${d} .cam kullanıyor ama katman çizmiyor`).toContain(
        "CamKatmanlari"
      );
    }
  });

  it("parlama izleyicisi azaltılmış hareket ayarına saygı duyar", () => {
    const parlama = readFileSync("src/components/ui/CamParlama.tsx", "utf8");
    expect(parlama).toContain("prefers-reduced-motion");
  });
});

describe("Modal davranışı (v1.26.0)", () => {
  /*
    ORTAĞIN İKİ BULGUSU:
      1. "Açılır pencere saçma sapan yukarı aşağı kayabiliyor; özellikle bir
         firma seçtiğimde." → kaplama kaydırılabilirdi; içeride odaklanan
         onay kutusunu görünür kılmak isteyen tarayıcı pencereyi zıplatıyordu.
      2. "Pencerenin içinde tıklayıp bırakmadan imleci dışarı taşıyarak
         bıraktığımda pencere kapanıyor." → `click` olayı, basma ve bırakma
         farklı öğelerdeyse ORTAK ATADA tetiklenir; metin seçerken imleç
         dışarı taşınca ortak ata kaplama olur ve girilen veri kaybolur.
  */
  const KATMAN = readFileSync("src/components/ui/ModalKatman.tsx", "utf8");

  it("kapatma kararı TEK YERDE verilir", () => {
    // Otuzdan fazla modal var; kural her birine ayrı yazılsaydı biri
    // er ya da geç unutulurdu.
    expect(KATMAN).toContain("onPointerDown");
    expect(KATMAN).toContain("e.target === e.currentTarget");
  });

  it("içeriden başlayan sürükleme modalı KAPATMAZ", () => {
    expect(KATMAN).toContain("kaplamadaBasladi");
    // Basma kaplamada başlamadıysa kapatma çağrılmaz.
    expect(KATMAN).toContain("if (!kaplamadaBasladi.current) return;");
  });

  it("kaplama kaydırılmaz, taşan içerik modalın İÇİNDE kaydırılır", () => {
    expect(KATMAN).toContain("modal-kaplama");
    expect(KATMAN).toContain("items-center");
    const bas = CSS.indexOf(".modal-kaplama > *");
    expect(bas, "modal-kaplama kuralı yok").toBeGreaterThan(-1);
    const kural = CSS.slice(bas, CSS.indexOf("}", bas));
    expect(kural).toContain("max-height: 100%");
    expect(kural).toContain("overflow-y: auto");
    expect(kural).toContain("overscroll-behavior: contain");
  });

  it("yan panel ve komut paleti kendi düzenlerini korur", () => {
    // İkisi de bir "pencere" değil: biri sağa yaslı tam yükseklik, öteki
    // üstten aşağı açılır. Ortalamak ikisini de bozardı.
    for (const yol of [
      "src/components/panel/YanPanel.tsx",
      "src/components/palet/KomutPaleti.tsx",
    ]) {
      expect(readFileSync(yol, "utf8"), `${yol} merkez düzene zorlanmış`).toContain(
        'duzen="ozel"'
      );
    }
  });

  it("onay kutusu `sr-only` DEĞİL — kaydırma sıçramasının kaynağıydı", () => {
    const secim = readFileSync("src/components/ui/CokluSecim.tsx", "utf8");
    expect(secim).not.toContain("sr-only\"");
    // Girdi görsel kutunun tam üstünde, kendi yerinde durur.
    expect(secim).toContain("absolute inset-0 h-full w-full");
  });
});
