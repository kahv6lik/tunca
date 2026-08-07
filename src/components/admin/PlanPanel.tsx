"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { planKaydet, planSil, type FormState } from "@/app/admin/actions";
import { PAKET_MODULLERI } from "@/lib/constants";

type Plan = {
  id: string;
  ad: string;
  aciklama: string;
  kullaniciLimiti: number;
  firmaLimiti: number;
  moduller: string[];
  kiraciSayisi: number;
};

export default function PlanPanel({ mevcut }: { mevcut?: Plan }) {
  const [acik, setAcik] = useState(false);
  const [bekliyor, basla] = useTransition();
  const duzenleme = Boolean(mevcut);

  const [state, formAction] = useFormState<FormState, FormData>(
    planKaydet.bind(null, mevcut?.id ?? null),
    {}
  );

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const secili = new Set(mevcut?.moduller ?? PAKET_MODULLERI.map((m) => m.deger));

  return (
    <>
      {duzenleme ? (
        <div className="flex items-center gap-1">
          <button onClick={() => setAcik(true)} className="btn-secondary h-9 px-3 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Düzenle
          </button>
          <button
            type="button"
            disabled={bekliyor}
            aria-label="Paketi sil"
            onClick={() => {
              const uyari =
                mevcut!.kiraciSayisi > 0
                  ? `"${mevcut!.ad}" paketi ${mevcut!.kiraciSayisi} kuruluşta kullanılıyor. Silinirse bu kuruluşlar paketsiz kalır (limitsiz çalışır). Devam edilsin mi?`
                  : `"${mevcut!.ad}" paketi silinsin mi?`;
              if (!confirm(uyari)) return;
              basla(async () => {
                await planSil(mevcut!.id);
              });
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Paket
        </button>
      )}

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Paketi Düzenle" : "Yeni Paket"}
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
                  Paket Adı
                </label>
                <input
                  id={`ad-${mevcut?.id ?? "yeni"}`}
                  name="ad"
                  required
                  defaultValue={mevcut?.ad}
                  className="input"
                  placeholder="ör. Başlangıç"
                />
              </div>

              <div>
                <label className="label" htmlFor={`aciklama-${mevcut?.id ?? "yeni"}`}>
                  Açıklama
                </label>
                <input
                  id={`aciklama-${mevcut?.id ?? "yeni"}`}
                  name="aciklama"
                  defaultValue={mevcut?.aciklama}
                  className="input"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`kl-${mevcut?.id ?? "yeni"}`}>
                    Kullanıcı limiti
                  </label>
                  <input
                    id={`kl-${mevcut?.id ?? "yeni"}`}
                    name="kullaniciLimiti"
                    type="number"
                    min={0}
                    defaultValue={mevcut?.kullaniciLimiti ?? 0}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">0 = sınırsız</p>
                </div>
                <div>
                  <label className="label" htmlFor={`fl-${mevcut?.id ?? "yeni"}`}>
                    Firma limiti
                  </label>
                  <input
                    id={`fl-${mevcut?.id ?? "yeni"}`}
                    name="firmaLimiti"
                    type="number"
                    min={0}
                    defaultValue={mevcut?.firmaLimiti ?? 0}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">0 = sınırsız</p>
                </div>
              </div>

              <div>
                <p className="label">Açık modüller</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PAKET_MODULLERI.map((m) => (
                    <label
                      key={m.deger}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        name="moduller"
                        value={m.deger}
                        defaultChecked={secili.has(m.deger)}
                        className="h-4 w-4 rounded border-border"
                      />
                      {m.etiket}
                    </label>
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
