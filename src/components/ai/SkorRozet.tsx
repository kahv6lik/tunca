"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ModalKatman from "@/components/ui/ModalKatman";
import { SKOR_SEVIYE, type Skor } from "@/lib/skor-saf";

/**
 * Skor rozeti — Faz 21 / G1.
 *
 * Rozet TIKLANABİLİRDİR ve gerekçeyi açar. Açıklanamayan bir skor, satış
 * temsilcisinin güvenmediği ve bir süre sonra yok saydığı bir rakamdır;
 * gerekçe bu yüzden bir "ayrıntı" değil, özelliğin kendisidir.
 *
 * Örnek sayısı azken rozet bunu SÖYLER — sessizce bir rakam basmak, olmayan
 * bir kesinlik iddiasıdır.
 */
export default function SkorRozet({ skor }: { skor: Skor }) {
  const [acik, setAcik] = useState(false);
  const seviye = SKOR_SEVIYE[skor.seviye] ?? SKOR_SEVIYE.orta;

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        title="Skorun gerekçesini gör"
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${seviye.className}`}
      >
        <Sparkles className="h-3 w-3" />
        {skor.deger}
        {!skor.yeterliVeri && <span className="opacity-70">?</span>}
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div
            className="card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-semibold ${seviye.className}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {skor.deger} · {seviye.etiket}
              </span>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              Skor, kuruluşunuzun <strong>kendi</strong> kapanmış işlerinden
              hesaplanır. Hiçbir veri dışarı gönderilmez.
            </p>

            <ul className="divide-y divide-border/50 border-y border-border/50">
              {skor.etkenler.map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{e.etiket}</span>
                    <span className="block text-xs text-muted-foreground">
                      {e.aciklama}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-sm ${
                      e.katki < 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {e.katki > 0 ? "+" : ""}
                    {Math.round(e.katki)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
              {skor.yeterliVeri
                ? `${skor.ornekSayisi} kapanmış işe dayanıyor.`
                : `Yalnızca ${skor.ornekSayisi} kapanmış iş var — skor henüz güvenilir değil, iş kapandıkça isabet artar.`}
            </p>

            <button
              onClick={() => setAcik(false)}
              className="btn-secondary mt-4 w-full"
            >
              Kapat
            </button>
          </div>
        </ModalKatman>
      )}
    </>
  );
}
