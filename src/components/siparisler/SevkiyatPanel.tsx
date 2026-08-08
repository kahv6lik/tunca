"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { sevkiyatOlustur, type FormState } from "@/app/(app)/sevkiyat/actions";

/**
 * Sevkiyat açma paneli (Faz 15 / S4).
 *
 * Bu düğme yalnızca onaylanmış siparişte GÖSTERİLİR; ama asıl kontrol
 * sunucudadır (`sevkiyatAcilabilirMi`). Arayüzde gizlemek koruma değildir.
 */
export default function SevkiyatPanel({
  siparisId,
  varsayilanAdres,
}: {
  siparisId: string;
  varsayilanAdres?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(
    sevkiyatOlustur.bind(null, siparisId),
    {}
  );

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-primary h-9 px-3 text-sm">
        <Plus className="h-4 w-4" /> Sevkiyat Aç
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Yeni Sevkiyat</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="tasiyici">Taşıyıcı</label>
                  <input id="tasiyici" name="tasiyici" className="input" placeholder="ör. Aras Kargo" />
                </div>
                <div>
                  <label className="label" htmlFor="takipNo">Takip No</label>
                  <input id="takipNo" name="takipNo" className="input" />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="adres">Teslimat Adresi</label>
                <textarea
                  id="adres"
                  name="adres"
                  rows={2}
                  defaultValue={varsayilanAdres}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor="notlar">Notlar</label>
                <input id="notlar" name="notlar" className="input" />
              </div>

              {state.error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
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
      {pending ? "Açılıyor…" : "Sevkiyat Aç"}
    </button>
  );
}
