"use client";

import { useEffect } from "react";

/**
 * Cam kırılma filtresi — v1.24.0.
 *
 * Kaynak fikir: hasib41/liquid-glass-nav. Yuvarlatılmış dikdörtgenin
 * İŞARETLİ MESAFE ALANI (SDF) bir normal haritaya çevrilir; SVG
 * `feDisplacementMap` bu haritayla arka planı kenar bandında dışa doğru
 * iter. Sonuç, sıradan bulanıklık değil gerçek bir mercek kırılmasıdır:
 * arkadaki ızgara çizgileri cam kenarından geçerken görünür biçimde bükülür.
 *
 * TEK ÖRNEK, TÜM UYGULAMA: filtre kabukta bir kez tanımlanır ve bütün cam
 * yüzeyler `backdrop-filter: url(#cam-warp)` ile ona bakar. Her yüzey kendi
 * filtresini üretseydi, aynı haritayı onlarca kez çizmek gerekirdi.
 *
 * DESTEKLEMEYEN TARAYICI SORUN DEĞİLDİR: `url()` içeren backdrop-filter'ı
 * çözemeyen tarayıcı bu katmanı çizmez ve altındaki sade buzlu cam görünür.
 * JS'te hiçbir özellik denetimi yoktur; kendiliğinden düşer.
 *
 * MALİYET: harita YALNIZCA BİR KEZ, sabit bir boyut için üretilir. Yüzey
 * başına yeniden çizmek (kaynak bileşendeki `ResizeObserver` yaklaşımı)
 * onlarca farklı boyutta canvas işi demekti; burada tek bir yumuşak kenar
 * profili bütün yüzeylere yeter.
 */

/** Haritanın kenar bandı derinliği (px). */
const BANT = 22;
/** Filtrenin dışarıdan örnekleme payı. */
const PAY = 26;
/** Üretilen haritanın kenar uzunluğu. */
const BOYUT = 240;

function normalHaritasi(): string | null {
  if (typeof document === "undefined") return null;

  const W = BOYUT + PAY * 2;
  const H = BOYUT + PAY * 2;
  const tuval = document.createElement("canvas");
  tuval.width = W;
  tuval.height = H;
  const ctx = tuval.getContext("2d");
  if (!ctx) return null;

  const r = 28; // köşe yarıçapı
  // Yuvarlatılmış dikdörtgenin işaretli mesafe alanı.
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x - BOYUT / 2) - (BOYUT / 2 - r);
    const qy = Math.abs(y - BOYUT / 2) - (BOYUT / 2 - r);
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  };

  const img = ctx.createImageData(W, H);
  const px = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      px[i + 3] = 255;
      const lx = x - PAY;
      const ly = y - PAY;
      const d = sdf(lx, ly);

      // Kenar bandının dışında kalan her piksel NÖTR gridir: orada hiçbir
      // itme olmaz, yani cam yüzeyin ortası bozulmadan geçer.
      if (d >= 0 || d < -BANT) {
        px[i] = 128;
        px[i + 1] = 128;
        px[i + 2] = 128;
        continue;
      }

      const gx = sdf(lx + 1, ly) - sdf(lx - 1, ly);
      const gy = sdf(lx, ly + 1) - sdf(lx, ly - 1);
      const boy = Math.hypot(gx, gy) || 1;

      const derinlik = -d;
      const t = 1 - derinlik / BANT; // kenarda 1, bandın dibinde 0
      const yumusatma = Math.min(derinlik / 1.5, 1);
      const genlik = Math.pow(t, 1.6) * yumusatma;

      px[i] = 128 + (gx / boy) * genlik * 127;
      px[i + 1] = 128 + (gy / boy) * genlik * 127;
      px[i + 2] = 128;
    }
  }

  ctx.putImageData(img, 0, 0);
  return tuval.toDataURL();
}

export default function CamFiltre() {
  useEffect(() => {
    // Harita istemcide bir kez üretilir; sunucuda canvas yoktur.
    const harita = normalHaritasi();
    if (!harita) return;
    const feImage = document.getElementById("cam-harita");
    if (!feImage) return;
    feImage.setAttribute("href", harita);
    feImage.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", harita);
  }, []);

  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter
          id="cam-warp"
          filterUnits="objectBoundingBox"
          x="0"
          y="0"
          width="1"
          height="1"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            id="cam-harita"
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="harita"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="harita"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
            result="bukum"
          />
          {/* Kırılmadan sonra buzlanma: kardeş backdrop katmanları
              zincirlenemediği için bu katman kendi bulanıklığını yapar. */}
          <feGaussianBlur in="bukum" stdDeviation="6" />
        </filter>
      </defs>
    </svg>
  );
}
