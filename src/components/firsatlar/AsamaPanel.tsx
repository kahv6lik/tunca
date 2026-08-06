"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  asamaOlustur,
  asamaGuncelle,
  asamaSil,
  asamaTasi,
  type FormState,
} from "@/app/(app)/firsatlar/asamalar/actions";
import { ASAMA_RENKLERI } from "@/lib/constants";

type Asama = {
  id: string;
  ad: string;
  olasilik: number;
  renk: string | null;
  firsatSayisi: number;
};

export default function AsamaPanel({ mevcut }: { mevcut?: Asama }) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? asamaGuncelle.bind(null, mevcut!.id) : asamaOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [renk, setRenk] = useState(mevcut?.renk ?? ASAMA_RENKLERI[0]);

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Aşama
        </button>
      )}

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Aşamayı Düzenle" : "Yeni Aşama"}
              </h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="space-y-4">
              <div>
                <label className="label" htmlFor={`ad-${mevcut?.id ?? "yeni"}`}>
                  Aşama Adı *
                </label>
                <input
                  id={`ad-${mevcut?.id ?? "yeni"}`}
                  name="ad"
                  required
                  defaultValue={mevcut?.ad}
                  className="input"
                  placeholder="ör. Teklif Gönderildi"
                />
              </div>

              <div>
                <label className="label" htmlFor={`ol-${mevcut?.id ?? "yeni"}`}>
                  Varsayılan olasılık (%)
                </label>
                <input
                  id={`ol-${mevcut?.id ?? "yeni"}`}
                  name="olasilik"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={mevcut?.olasilik ?? 0}
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Bu aşamaya taşınan yeni fırsatlara öneri olarak gelir. Beklenen ciro
                  hesabı bu oranı kullanır.
                </p>
              </div>

              <div>
                <p className="label">Renk</p>
                <input type="hidden" name="renk" value={renk} />
                <div className="flex flex-wrap gap-2">
                  {ASAMA_RENKLERI.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRenk(r)}
                      aria-label={`Renk ${r}`}
                      className={`h-7 w-7 rounded-lg ring-2 ring-offset-2 ring-offset-background transition-all ${
                        renk === r ? "ring-foreground/60" : "ring-transparent"
                      }`}
                      style={{ background: r }}
                    />
                  ))}
                </div>
              </div>

              {state.error && <p className="text-sm text-rose-400">{state.error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <Kaydet />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

/** Sıralama okları ve silme — aşama satırındaki işlemler. */
export function AsamaIslemleri({
  asama,
  ilk,
  son,
}: {
  asama: Asama;
  ilk: boolean;
  son: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={ilk || bekliyor}
        aria-label="Sola taşı"
        onClick={() => basla(async () => void (await asamaTasi(asama.id, "sol")))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={son || bekliyor}
        aria-label="Sağa taşı"
        onClick={() => basla(async () => void (await asamaTasi(asama.id, "sag")))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <AsamaPanel mevcut={asama} />

      <button
        type="button"
        disabled={bekliyor}
        aria-label="Aşamayı sil"
        onClick={() => {
          setHata(null);
          if (!confirm(`"${asama.ad}" aşaması silinsin mi?`)) return;
          basla(async () => {
            const sonuc = await asamaSil(asama.id);
            if (sonuc.error) setHata(sonuc.error);
          });
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {hata && <span className="ml-2 text-xs text-rose-400">{hata}</span>}
    </div>
  );
}
