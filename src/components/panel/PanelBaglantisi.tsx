"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PANEL_ANAHTARI, panelDegeri } from "@/lib/arama-tanimlar";

/**
 * Yan paneli açan bağlantı — Faz 20 / U2.
 *
 * `<button>` değil `<Link>`dir: orta tıklama ve "yeni sekmede aç" çalışsın,
 * bağlantı kopyalanabilsin. Panel URL'de yaşadığı için (`?panel=tur:id`)
 * listelerin hiçbirine durum taşımak gerekmez — mevcut süzgeçler
 * korunarak yalnızca bir parametre eklenir.
 */
export default function PanelBaglantisi({
  tur,
  id,
  className,
  title,
  children,
}: {
  tur: string;
  id: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const parametreler = useSearchParams();

  const yeni = new URLSearchParams(parametreler.toString());
  yeni.set(PANEL_ANAHTARI, panelDegeri(tur, id));

  return (
    <Link
      href={`${pathname}?${yeni.toString()}`}
      scroll={false}
      title={title ?? "Özeti yan panelde aç"}
      className={className}
    >
      {children}
    </Link>
  );
}
