"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Bir denetim kaydındaki değişiklikleri "eski → yeni" olarak gösterir.
 *
 * Güncellemelerde yalnızca GERÇEKTEN değişen alanlar kaydedilir
 * (bkz. src/lib/denetim.ts), bu yüzden burada gösterilen her satır anlamlıdır.
 */
export default function DegisiklikDetay({
  eski,
  yeni,
}: {
  eski: Record<string, unknown> | null;
  yeni: Record<string, unknown> | null;
}) {
  const [acik, setAcik] = useState(false);

  const alanlar = [...new Set([...Object.keys(eski ?? {}), ...Object.keys(yeni ?? {})])];
  if (alanlar.length === 0) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const goster = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div>
      <button
        onClick={() => setAcik((a) => !a)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {alanlar.length} alan
        <ChevronDown className={`h-3 w-3 transition-transform ${acik ? "rotate-180" : ""}`} />
      </button>

      {acik && (
        <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2">
          {alanlar.map((alan) => (
            <div key={alan} className="text-xs">
              <span className="font-medium text-foreground/80">{alan}: </span>
              {eski && alan in eski && (
                <span className="text-rose-400/90 line-through">{goster(eski[alan])}</span>
              )}
              {eski && alan in eski && yeni && alan in yeni && (
                <span className="text-muted-foreground/60"> → </span>
              )}
              {yeni && alan in yeni && (
                <span className="text-emerald-400/90">{goster(yeni[alan])}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
