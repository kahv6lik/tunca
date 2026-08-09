"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { sssOkundu } from "@/app/(app)/sss/actions";

/**
 * Açılır SSS kartı (Faz 16 / P4).
 *
 * Görüntülenme sayacı YALNIZCA ilk açılışta artar: aynı kişinin kartı açıp
 * kapatması, o yanıtı popülermiş gibi göstermemelidir.
 */
export default function SssKarti({
  id,
  soru,
  yanit,
  kategori,
  etiketler,
  goruntulenme,
  pasif,
  duzenle,
  sil,
}: {
  id: string;
  soru: string;
  yanit: string;
  kategori: string | null;
  etiketler: string[];
  goruntulenme: number;
  pasif: boolean;
  duzenle?: React.ReactNode;
  sil?: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  const [sayildi, setSayildi] = useState(false);
  const [, basla] = useTransition();

  function degistir() {
    const yeni = !acik;
    setAcik(yeni);
    if (yeni && !sayildi) {
      setSayildi(true);
      // Sayaç arka planda artar; hata olursa kullanıcı akışı bozulmaz.
      basla(async () => {
        try {
          await sssOkundu(id);
        } catch {
          /* sayaç kritik değildir */
        }
      });
    }
  }

  return (
    <div className={`card p-4 ${pasif ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={degistir}
          aria-expanded={acik}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              acik ? "rotate-180" : ""
            }`}
          />
          <span className="font-medium text-foreground">{soru}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {pasif && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              Pasif
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {goruntulenme}
          </span>
          {duzenle}
          {sil}
        </div>
      </div>

      {acik && (
        <div className="mt-3 pl-6">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{yanit}</p>
          {(kategori || etiketler.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              {kategori && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  {kategori}
                </span>
              )}
              {etiketler.map((e) => (
                <span
                  key={e}
                  className="rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground"
                >
                  #{e}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
