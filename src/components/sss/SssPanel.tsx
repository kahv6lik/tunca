"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import { sssOlustur, sssGuncelle, type FormState } from "@/app/(app)/sss/actions";

export type SssDegerleri = {
  id: string;
  soru: string;
  yanit: string;
  kategori: string;
  etiketler: string;
  durum: string;
  sira: number;
};

/** SSS ekleme / düzenleme paneli (Faz 16 / P4). */
export default function SssPanel({
  kategoriler,
  mevcut,
}: {
  kategoriler: string[];
  mevcut?: SssDegerleri;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? sssGuncelle.bind(null, mevcut!.id) : sssOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Soru
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
                {duzenleme ? "Soruyu Düzenle" : "Yeni Soru"}
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
              <div className="sm:col-span-2">
                <label className="label" htmlFor={`ssoru-${k}`}>Soru *</label>
                <input
                  id={`ssoru-${k}`}
                  name="soru"
                  required
                  defaultValue={mevcut?.soru}
                  className="input"
                  placeholder="ör. Fatura adresimi nasıl değiştiririm?"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`syanit-${k}`}>Yanıt *</label>
                <textarea
                  id={`syanit-${k}`}
                  name="yanit"
                  required
                  rows={6}
                  defaultValue={mevcut?.yanit}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`skategori-${k}`}>Kategori</label>
                <input
                  id={`skategori-${k}`}
                  name="kategori"
                  list={`skatlist-${k}`}
                  defaultValue={mevcut?.kategori}
                  className="input"
                  placeholder="ör. Faturalama"
                />
                {/* Var olan kategoriler önerilir ama yenisi de yazılabilir:
                    kategori ayrı bir yönetim ekranı gerektirmez. */}
                <datalist id={`skatlist-${k}`}>
                  {kategoriler.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label" htmlFor={`setiket-${k}`}>Etiketler</label>
                <input
                  id={`setiket-${k}`}
                  name="etiketler"
                  defaultValue={mevcut?.etiketler}
                  className="input"
                  placeholder="virgülle ayırın: fatura, iade"
                />
              </div>

              <div>
                <label className="label" htmlFor={`sdurum-${k}`}>Durum</label>
                <select
                  id={`sdurum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "aktif"}
                  className="input"
                >
                  <option value="aktif">Aktif</option>
                  <option value="pasif">Pasif</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`ssira-${k}`}>Sıra</label>
                <input
                  id={`ssira-${k}`}
                  name="sira"
                  type="number"
                  min={0}
                  defaultValue={mevcut?.sira ?? 0}
                  className="input"
                />
              </div>

              {state.error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400 sm:col-span-2">
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
