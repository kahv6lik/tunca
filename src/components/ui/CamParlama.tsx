"use client";

import { useEffect } from "react";

/**
 * İmleci izleyen parlama — v1.24.0.
 *
 * Cam yüzeyin üzerindeki spektral parlamanın konumunu (`--cam-mx/--cam-my`)
 * imlecin yüzey içindeki YÜZDESİNE göre günceller. Bu, camın "gerçek bir
 * yüzey" gibi hissettiren tek hareketli parçasıdır.
 *
 * TEK DİNLEYİCİ: her cam yüzeye ayrı bir `onMouseMove` bağlamak yerine
 * belgede tek bir dinleyici vardır ve imlecin altındaki en yakın `.cam`
 * öğesini bulur. Onlarca yüzeyde onlarca React durumu güncellemek yerine
 * doğrudan CSS değişkeni yazılır — hiçbir yeniden çizim tetiklenmez.
 *
 * `prefers-reduced-motion` açıksa hiç bağlanmaz.
 */
export default function CamParlama() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    function hareket(e: PointerEvent) {
      const hedef = (e.target as Element | null)?.closest?.(".cam");
      if (!(hedef instanceof HTMLElement)) return;
      const k = hedef.getBoundingClientRect();
      if (k.width === 0 || k.height === 0) return;
      hedef.style.setProperty("--cam-mx", `${((e.clientX - k.left) / k.width) * 100}%`);
      hedef.style.setProperty("--cam-my", `${((e.clientY - k.top) / k.height) * 100}%`);
    }

    window.addEventListener("pointermove", hareket, { passive: true });
    return () => window.removeEventListener("pointermove", hareket);
  }, []);

  return null;
}
