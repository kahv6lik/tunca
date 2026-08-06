"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

/**
 * Dışa aktarım düğmesi — Faz 9 / E1.
 *
 * `filtreler` listede uygulanan süzgeçlerdir ve olduğu gibi geçirilir:
 * kullanıcı "ekranda gördüğümü indir" bekler. Boş değerler ayıklanır ki
 * bağlantı gereksiz parametrelerle şişmesin.
 */
export default function DisaAktarDugmesi({
  tur,
  filtreler = {},
}: {
  tur: string;
  filtreler?: Record<string, string | undefined>;
}) {
  const [acik, setAcik] = useState(false);

  function baglanti(bicim: "xlsx" | "csv") {
    const qs = new URLSearchParams({ tur, bicim });
    for (const [k, v] of Object.entries(filtreler)) {
      if (v) qs.set(k, v);
    }
    return `/api/disa-aktar?${qs.toString()}`;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="btn-secondary"
        aria-expanded={acik}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" /> Dışa Aktar
      </button>

      {acik && (
        <>
          {/* Dışarı tıklayınca kapansın */}
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAcik(false)}
          />
          <div
            role="menu"
            className="card absolute right-0 z-50 mt-2 w-56 overflow-hidden p-1"
          >
            <a
              href={baglanti("xlsx")}
              onClick={() => setAcik(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>
                Excel (.xlsx)
                <span className="block text-xs text-muted-foreground">
                  Biçimli, süzgeçli tablo
                </span>
              </span>
            </a>
            <a
              href={baglanti("csv")}
              onClick={() => setAcik(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <FileText className="h-4 w-4 text-sky-500" />
              <span>
                CSV
                <span className="block text-xs text-muted-foreground">
                  Başka sistemlere aktarım
                </span>
              </span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
