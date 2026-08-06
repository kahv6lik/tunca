"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal, X, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { panoKaydet, panoVarsayilanaDon } from "@/app/(app)/pano-actions";
import { PANO_KARTLARI } from "@/lib/pano-tanimlar";

const TUR_ETIKET: Record<string, string> = {
  kpi: "Sayaçlar",
  grafik: "Grafikler",
  liste: "Listeler",
};

/**
 * Pano düzenleme paneli (Faz 10 / E3).
 *
 * `izinliKartlar` sunucudan gelir: kullanıcının İZNİ OLMAYAN kart burada
 * hiç listelenmez — seçilemeyecek bir şeyi göstermek yanıltıcı olurdu.
 * `secili` mevcut etkin düzendir (sıra önemli).
 */
export default function PanoDuzenle({
  izinliKartlar,
  secili,
}: {
  izinliKartlar: string[];
  secili: string[];
}) {
  const [acik, setAcik] = useState(false);
  const [kartlar, setKartlar] = useState<string[]>(secili);
  const [bekliyor, basla] = useTransition();

  const izinli = new Set(izinliKartlar);
  const seciliKume = new Set(kartlar);

  function ekleCikar(anahtar: string) {
    setKartlar((k) =>
      k.includes(anahtar) ? k.filter((x) => x !== anahtar) : [...k, anahtar]
    );
  }

  function tasi(anahtar: string, yon: -1 | 1) {
    setKartlar((k) => {
      const i = k.indexOf(anahtar);
      const j = i + yon;
      if (i === -1 || j < 0 || j >= k.length) return k;
      const kopya = [...k];
      [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
      return kopya;
    });
  }

  return (
    <>
      <button type="button" onClick={() => setAcik(true)} className="btn-secondary">
        <SlidersHorizontal className="h-4 w-4" /> Panoyu Düzenle
      </button>

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Panoyu Düzenle</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Hangi kartların görüneceğini ve sırasını seçin. Tercih yalnızca sizin
              panonuzu etkiler.
            </p>

            <div className="space-y-5">
              {(["kpi", "grafik", "liste"] as const).map((tur) => {
                const grup = PANO_KARTLARI.filter(
                  (k) => k.tur === tur && izinli.has(k.anahtar)
                );
                if (grup.length === 0) return null;

                return (
                  <div key={tur}>
                    <p className="label">{TUR_ETIKET[tur]}</p>
                    <div className="space-y-1.5">
                      {grup.map((kart) => {
                        const seciliMi = seciliKume.has(kart.anahtar);
                        const sira = kartlar.indexOf(kart.anahtar);
                        return (
                          <div
                            key={kart.anahtar}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                              seciliMi
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`kart-${kart.anahtar}`}
                              checked={seciliMi}
                              onChange={() => ekleCikar(kart.anahtar)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <label
                              htmlFor={`kart-${kart.anahtar}`}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <span className="block text-sm font-medium text-foreground">
                                {kart.etiket}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {kart.aciklama}
                              </span>
                            </label>
                            {seciliMi && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  aria-label="Yukarı taşı"
                                  disabled={sira <= 0}
                                  onClick={() => tasi(kart.anahtar, -1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Aşağı taşı"
                                  disabled={sira === kartlar.length - 1}
                                  onClick={() => tasi(kart.anahtar, 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={bekliyor}
                onClick={() =>
                  basla(async () => {
                    await panoVarsayilanaDon();
                    setAcik(false);
                  })
                }
                className="btn-ghost text-sm"
              >
                <RotateCcw className="h-4 w-4" /> Varsayılana dön
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={bekliyor || kartlar.length === 0}
                  onClick={() =>
                    basla(async () => {
                      await panoKaydet(kartlar);
                      setAcik(false);
                    })
                  }
                  className="btn-primary"
                >
                  {bekliyor ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
