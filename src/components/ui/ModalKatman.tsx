"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Modal kaplaması — içerik React portalıyla document.body'ye taşınır.
 *
 * Neden portal: `.card` sınıfı `backdrop-blur` kullanır ve backdrop-filter,
 * `position: fixed` torunlar için kapsayıcı blok oluşturur. Kartın İÇİNDEN
 * render edilen bir modal ekrana değil karta göre konumlanır ve "kutunun
 * içinde sıkışmış" görünür. Portal, modalı DOM'da kartın dışına çıkararak
 * bu sınıfı sorunun tamamını kapatır.
 *
 * ═══ SÜRÜKLEYİP DIŞARIDA BIRAKMAK MODALI KAPATMAZ (v1.26.0) ═══
 *
 * ORTAĞIN BULGUSU: "pencerenin içinde sol tıklayıp bırakmadan imleci dışarı
 * taşıyarak bıraktığımda pencere kapanıyor; veri girerken çok sorun oluyor."
 *
 * Sebep tarayıcının `click` olayıdır: basma ve bırakma FARKLI öğelerdeyse
 * `click`, ikisinin ORTAK ATASINDA tetiklenir. Metin seçerken imleç formun
 * dışına taştığında ortak ata kaplamanın kendisi olur ve "dışarı tıklandı"
 * sanılır — girilen bütün veri kaybolur.
 *
 * ÇÖZÜM: kapatma yalnızca basma DA bırakma DA kaplamanın kendisinde olduğunda
 * çalışır. Karar burada, TEK YERDE verilir; otuzdan fazla modalın her biri
 * kendi kuralını yazsaydı biri er ya da geç unutulurdu.
 *
 * ═══ MODAL ORTADA SABİT DURUR ═══
 *
 * İkinci bulgu: "açılır pencere saçma sapan yukarı aşağı kayabiliyor."
 * Kaplamanın kendisi kaydırılabilir olduğu için (`items-start` +
 * `overflow-y-auto`), içeride bir onay kutusuna odaklanmak bütün pencereyi
 * kaydırıyordu. Artık KAPLAMA kaydırılmaz, taşan içerik MODALIN İÇİNDE
 * kaydırılır (`.modal-kaplama` kuralı `globals.css`'te). Böylece pencere
 * ekranın ortasında sabit kalır.
 */

/** Kaplamanın kaydırılmasına yol açan sınıflar — merkez düzende ayıklanır. */
const CAKISAN = new Set([
  "items-start",
  "items-end",
  "items-baseline",
  "overflow-y-auto",
  "overflow-auto",
]);

function merkezSiniflari(sinif: string | undefined): string {
  const kalan = (sinif ?? "").split(/\s+/).filter((c) => c && !CAKISAN.has(c));
  return [...kalan, "modal-kaplama", "items-center", "overflow-hidden"].join(" ");
}

export default function ModalKatman({
  children,
  className,
  onClick,
  duzen = "merkez",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /**
   * `merkez` (varsayılan): pencere ekranın ortasında sabit durur, taşan
   * içerik kendi içinde kaydırılır.
   *
   * `ozel`: kaplamanın yerleşimine DOKUNULMAZ. Yan panel (sağa yaslı, tam
   * yükseklik) ve komut paleti (üstten aşağı açılır) kendi düzenlerini
   * korumak için bunu kullanır — ikisi de bir "pencere" değil.
   */
  duzen?: "merkez" | "ozel";
}) {
  const [hazir, setHazir] = useState(false);
  // Basmanın kaplamada başlayıp başlamadığı. Ref: yeniden çizim gerektirmez.
  const kaplamadaBasladi = useRef(false);

  useEffect(() => setHazir(true), []);
  if (!hazir) return null;

  return createPortal(
    <div
      {...props}
      className={duzen === "merkez" ? merkezSiniflari(className) : className}
      onPointerDown={(e) => {
        kaplamadaBasladi.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!onClick) return;
        // Bırakma modalın içindeyse zaten kapatılmaz.
        if (e.target !== e.currentTarget) return;
        // Basma İÇERİDE başlamışsa bu bir sürüklemedir, kapatma niyeti değil.
        if (!kaplamadaBasladi.current) return;
        onClick(e);
      }}
    >
      {children}
    </div>,
    document.body
  );
}
