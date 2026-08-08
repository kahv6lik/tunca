"use client";

import { useState, useTransition } from "react";
import { sevkiyatDurumGuncelle } from "@/app/(app)/sevkiyat/actions";

/**
 * Sevkiyat durumunu ilerleten düğmeler (Faz 15 / S4).
 *
 * Yalnızca SIRADAKİ adım gösterilir: "hazırlanıyor → sevk edildi → teslim".
 * Bütün durumları her satırda listelemek, depo ekibinin yanlış düğmeye
 * basmasını kolaylaştırırdı. Geri alma bilinçli olarak yok — yanlış işaret
 * bir sonraki adımla değil, iptalle düzeltilir.
 */
export default function DurumDugmeleri({
  id,
  durum,
}: {
  id: string;
  durum: string;
}) {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function ilerlet(yeni: string) {
    setHata(null);
    basla(async () => {
      try {
        await sevkiyatDurumGuncelle(id, yeni);
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Güncellenemedi.");
      }
    });
  }

  const sonraki: Record<string, { deger: string; etiket: string } | undefined> = {
    hazirlaniyor: { deger: "sevkedildi", etiket: "Sevk Et" },
    sevkedildi: { deger: "teslim", etiket: "Teslim Edildi" },
  };

  const adim = sonraki[durum];
  if (!adim && durum !== "hazirlaniyor" && durum !== "sevkedildi") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {hata && <span className="text-xs text-rose-400">{hata}</span>}
      {adim && (
        <button
          onClick={() => ilerlet(adim.deger)}
          disabled={bekliyor}
          className="btn-secondary h-8 px-2.5 text-xs"
        >
          {bekliyor ? "…" : adim.etiket}
        </button>
      )}
      {durum !== "iptal" && (
        <button
          onClick={() => {
            if (confirm("Bu sevkiyat iptal edilsin mi?")) ilerlet("iptal");
          }}
          disabled={bekliyor}
          className="text-xs text-muted-foreground hover:text-rose-400"
        >
          İptal
        </button>
      )}
    </div>
  );
}
