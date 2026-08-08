"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  kampanyaKullanimKaydet,
  type FormState,
} from "@/app/(app)/kampanyalar/actions";

/**
 * Kampanya kullanımı kaydetme (Faz 14 / T4).
 *
 * Faz 15'te sipariş onayı bunu kendisi çağıracak. Şimdilik satış temsilcisi
 * verdiği indirimi elle işler — kota düşümü yine ATOMİKTİR, yani aynı anda
 * iki kişi son adedi işleyemez.
 */
export default function KullanimPanel({
  kampanyaId,
  firmalar,
}: {
  kampanyaId: string;
  firmalar: { id: string; ad: string }[];
}) {
  const [acik, setAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(
    kampanyaKullanimKaydet,
    {}
  );

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Kullanım Kaydet
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Kampanya Kullanımı</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4">
              <input type="hidden" name="kampanyaId" value={kampanyaId} />

              <div>
                <label className="label" htmlFor="kullanim-firma">Firma *</label>
                <select id="kullanim-firma" name="firmaId" required className="input">
                  <option value="">Seçin…</option>
                  {firmalar.map((f) => (
                    <option key={f.id} value={f.id}>{f.ad}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="kullanim-adet">Adet *</label>
                  <input
                    id="kullanim-adet"
                    name="adet"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="kullanim-indirim">İndirim Tutarı</label>
                  <input
                    id="kullanim-indirim"
                    name="indirimTutari"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={0}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="kullanim-ref">Referans</label>
                <input
                  id="kullanim-ref"
                  name="referans"
                  className="input"
                  placeholder="ör. teklif ya da sipariş no"
                />
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
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}
