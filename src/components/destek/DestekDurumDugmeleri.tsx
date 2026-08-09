"use client";

import { useState, useTransition } from "react";
import { destekDurumDegistir } from "@/app/(app)/destek/actions";
import { DESTEK_DURUM, durumBadge } from "@/lib/constants";

/**
 * Destek kaydının durumunu değiştiren düğmeler (Faz 16 / P2).
 *
 * Sevkiyattaki tek yönlü akıştan farklı olarak BÜTÜN durumlar gösterilir:
 * destek kaydı ileri geri hareket eder (çözüldü sanılan iş yeniden açılır,
 * müşteri yanıt vermeyince beklemeye alınır). Damgalar sunucuda atıldığı
 * için geri dönüş veriyi bozmaz.
 */
export default function DestekDurumDugmeleri({
  id,
  durum,
}: {
  id: string;
  durum: string;
}) {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function degistir(yeni: string) {
    setHata(null);
    basla(async () => {
      try {
        await destekDurumDegistir(id, yeni);
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Güncellenemedi.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DESTEK_DURUM.filter((d) => d !== durum).map((d) => (
        <button
          key={d}
          onClick={() => degistir(d)}
          disabled={bekliyor}
          className="btn-secondary h-8 px-2.5 text-xs"
        >
          {durumBadge(d).label}
        </button>
      ))}
      {hata && <span className="text-xs text-rose-400">{hata}</span>}
    </div>
  );
}
