"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import { projeOlustur, projeGuncelle, type FormState } from "@/app/(app)/projeler/actions";
import { PROJE_DURUM, PARA_BIRIMI, durumBadge } from "@/lib/constants";

export type ProjeDegerleri = {
  id: string;
  kod: string;
  ad: string;
  aciklama: string;
  firmaId: string;
  sorumluId: string;
  durum: string;
  baslangic: string;
  bitis: string;
  butce: number;
  paraBirimi: string;
};

/** Proje ekleme / düzenleme paneli (Faz 16 / P1). */
export default function ProjePanel({
  firmalar,
  kullanicilar,
  mevcut,
  sabitFirmaId,
}: {
  firmalar: { id: string; ad: string }[];
  kullanicilar: { id: string; name: string }[];
  mevcut?: ProjeDegerleri;
  sabitFirmaId?: string;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? projeGuncelle.bind(null, mevcut!.id) : projeOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary text-sm">
          <Pencil className="h-4 w-4" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Proje
        </button>
      )}

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Projeyi Düzenle" : "Yeni Proje"}
              </h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`pkod-${k}`}>Proje Kodu *</label>
                <input id={`pkod-${k}`} name="kod" required defaultValue={mevcut?.kod} className="input" />
              </div>

              <div>
                <label className="label" htmlFor={`pad-${k}`}>Proje Adı *</label>
                <input id={`pad-${k}`} name="ad" required defaultValue={mevcut?.ad} className="input" />
              </div>

              {sabitFirmaId ? (
                <input type="hidden" name="firmaId" value={sabitFirmaId} />
              ) : (
                <div>
                  <label className="label" htmlFor={`pfirma-${k}`}>Firma *</label>
                  <select
                    id={`pfirma-${k}`}
                    name="firmaId"
                    required
                    defaultValue={mevcut?.firmaId ?? ""}
                    className="input"
                  >
                    <option value="">Seçin…</option>
                    {firmalar.map((f) => (
                      <option key={f.id} value={f.id}>{f.ad}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor={`psorumlu-${k}`}>Sorumlu</label>
                <select
                  id={`psorumlu-${k}`}
                  name="sorumluId"
                  defaultValue={mevcut?.sorumluId ?? ""}
                  className="input"
                >
                  <option value="">—</option>
                  {kullanicilar.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`pbas-${k}`}>Başlangıç</label>
                <input
                  id={`pbas-${k}`}
                  name="baslangic"
                  type="date"
                  defaultValue={mevcut?.baslangic}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`pbit-${k}`}>Bitiş</label>
                <input
                  id={`pbit-${k}`}
                  name="bitis"
                  type="date"
                  defaultValue={mevcut?.bitis}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`pbutce-${k}`}>Bütçe</label>
                <input
                  id={`pbutce-${k}`}
                  name="butce"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={mevcut?.butce ?? 0}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`ppb-${k}`}>Para Birimi</label>
                <select
                  id={`ppb-${k}`}
                  name="paraBirimi"
                  defaultValue={mevcut?.paraBirimi ?? "TRY"}
                  className="input"
                >
                  {PARA_BIRIMI.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`pdurum-${k}`}>Durum</label>
                <select
                  id={`pdurum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "planlandi"}
                  className="input"
                >
                  {PROJE_DURUM.map((d) => (
                    <option key={d} value={d}>{durumBadge(d).label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`pacik-${k}`}>Açıklama</label>
                <textarea
                  id={`pacik-${k}`}
                  name="aciklama"
                  rows={2}
                  defaultValue={mevcut?.aciklama}
                  className="input"
                />
              </div>

              {state.error && (
                <p className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <Kaydet />
              </div>
            </form>
          </div>
        </ModalKatman>
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
