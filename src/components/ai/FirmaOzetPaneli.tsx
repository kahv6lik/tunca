"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { firmaOzetiAkicilastir } from "@/app/(app)/ai-actions";
import type { OzetSatiri } from "@/lib/firma-ozet-saf";

/**
 * Firma özeti paneli — Faz 21 / G2.
 *
 * İKİ KATMANLIDIR ve bu bilinçlidir:
 *
 *   1. Veriden üretilen maddeler HER ZAMAN görünür. AI kapalıyken, anahtar
 *      yokken, model hata verdiğinde bile özet yerinde durur — özellik
 *      sağlayıcıya bağımlı olmamalıdır.
 *   2. "Paragraf hâline getir" düğmesi ANCAK kullanıcı isterse çağrı yapar.
 *      Sayfa açılışında otomatik çağırmak, her firma görüntülemesini ücretli
 *      bir isteğe çevirirdi.
 */
export default function FirmaOzetPaneli({
  firmaId,
  satirlar,
  aiAcik,
  kapaliSebep,
}: {
  firmaId: string;
  satirlar: OzetSatiri[];
  aiAcik: boolean;
  kapaliSebep: string | null;
}) {
  const [paragraf, setParagraf] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function akicilastir() {
    setHata(null);
    basla(async () => {
      const sonuc = await firmaOzetiAkicilastir(firmaId);
      if (sonuc.ok) setParagraf(sonuc.metin);
      else setHata(sonuc.metin);
    });
  }

  return (
    <div className="card mb-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Özet
        </h2>
        {aiAcik ? (
          <button
            onClick={akicilastir}
            disabled={bekliyor}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {bekliyor ? "Yazılıyor…" : "Paragraf hâline getir"}
          </button>
        ) : (
          kapaliSebep && (
            <span className="text-xs text-muted-foreground">{kapaliSebep}</span>
          )
        )}
      </div>

      {paragraf ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {paragraf}
          </p>
          <button
            onClick={() => setParagraf(null)}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Maddelere dön
          </button>
        </>
      ) : (
        <dl className="divide-y divide-border/50">
          {satirlar.map((s) => (
            <div key={s.baslik} className="flex items-start gap-4 py-2">
              <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground/70">
                {s.baslik}
              </dt>
              <dd className="min-w-0 flex-1 text-sm text-foreground">{s.metin}</dd>
            </div>
          ))}
        </dl>
      )}

      {hata && <p className="mt-3 text-sm text-rose-400">{hata}</p>}
    </div>
  );
}
