"use client";

import { PanelRight } from "lucide-react";
import PanelBaglantisi from "./PanelBaglantisi";

/**
 * Listelerdeki "özeti göster" düğmesi — Faz 20 / U2.
 *
 * Satırın ASIL bağlantısı olduğu gibi kalır (tam sayfa); bu düğme onun
 * YANINA gelir. Faz 20 mevcut ekranların üstüne eklenir, onları
 * değiştirmez — alışkanlıkları bozmadan hızlı bakış sunar.
 */
export default function OzetDugmesi({ tur, id }: { tur: string; id: string }) {
  return (
    <PanelBaglantisi
      tur={tur}
      id={id}
      title="Özeti yan panelde aç"
      className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded align-middle text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
    >
      <PanelRight className="h-3.5 w-3.5" />
      <span className="sr-only">Özeti aç</span>
    </PanelBaglantisi>
  );
}
