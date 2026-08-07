"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  alanOlustur,
  alanGuncelle,
  alanSil,
  alanTasi,
  type FormState,
} from "@/app/(app)/ozel-alanlar/actions";
import {
  OZEL_ALAN_VARLIKLARI,
  OZEL_ALAN_TIPLERI,
  VARLIK_ETIKET,
  TIP_ETIKET,
  type OzelAlanVarligi,
  type OzelAlanTipi,
} from "@/lib/ozel-alan-tanimlar";

type Alan = {
  id: string;
  varlik: string;
  ad: string;
  tip: string;
  secenekler: string[];
  zorunlu: boolean;
  degerSayisi: number;
};

export default function OzelAlanPanel({
  mevcut,
  varsayilanVarlik,
}: {
  mevcut?: Alan;
  varsayilanVarlik?: OzelAlanVarligi;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? alanGuncelle.bind(null, mevcut!.id) : alanOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [tip, setTip] = useState(mevcut?.tip ?? "metin");

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const key = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Alan
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
                {duzenleme ? "Alanı Düzenle" : "Yeni Özel Alan"}
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
                <label className="label" htmlFor={`varlik-${key}`}>Hangi kayıtta?</label>
                {duzenleme ? (
                  <>
                    {/* Varlık sonradan değiştirilemez: değerler o kayıtlara bağlı. */}
                    <input type="hidden" name="varlik" value={mevcut!.varlik} />
                    <p className="input flex items-center bg-muted/40 text-muted-foreground">
                      {VARLIK_ETIKET[mevcut!.varlik as OzelAlanVarligi] ?? mevcut!.varlik}
                    </p>
                  </>
                ) : (
                  <select
                    id={`varlik-${key}`}
                    name="varlik"
                    className="input"
                    defaultValue={varsayilanVarlik ?? "firma"}
                  >
                    {OZEL_ALAN_VARLIKLARI.map((v) => (
                      <option key={v} value={v}>{VARLIK_ETIKET[v]}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="label" htmlFor={`ad-${key}`}>Alan Adı *</label>
                <input
                  id={`ad-${key}`}
                  name="ad"
                  required
                  maxLength={60}
                  defaultValue={mevcut?.ad}
                  className="input"
                  placeholder="ör. Müşteri No, Sözleşme Bitişi"
                />
              </div>

              <div>
                <label className="label" htmlFor={`tip-${key}`}>Tip</label>
                <select
                  id={`tip-${key}`}
                  name="tip"
                  className="input"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                >
                  {OZEL_ALAN_TIPLERI.map((t) => (
                    <option key={t} value={t}>{TIP_ETIKET[t as OzelAlanTipi]}</option>
                  ))}
                </select>
                {duzenleme && mevcut!.degerSayisi > 0 && (
                  <p className="mt-1 text-xs text-amber-500">
                    Bu alanda {mevcut!.degerSayisi} kayıtlı değer var; tip değiştirmek eski
                    değerleri silmez ama yeni girişler yeni tipe göre doğrulanır.
                  </p>
                )}
              </div>

              {tip === "secim" && (
                <div>
                  <label className="label" htmlFor={`secenekler-${key}`}>
                    Seçenekler (her satıra bir tane)
                  </label>
                  <textarea
                    id={`secenekler-${key}`}
                    name="secenekler"
                    rows={4}
                    className="input"
                    defaultValue={mevcut?.secenekler.join("\n")}
                    placeholder={"Altın\nGümüş\nBronz"}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="zorunlu"
                  value="1"
                  defaultChecked={mevcut?.zorunlu}
                  className="h-4 w-4 rounded border-border"
                />
                Zorunlu alan (formda boş bırakılamaz)
              </label>

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

/** Sıralama okları, düzenleme ve silme — alan satırındaki işlemler. */
export function OzelAlanIslemleri({
  alan,
  ilk,
  son,
}: {
  alan: Alan;
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
        aria-label="Yukarı taşı"
        onClick={() => basla(async () => void (await alanTasi(alan.id, "yukari")))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={son || bekliyor}
        aria-label="Aşağı taşı"
        onClick={() => basla(async () => void (await alanTasi(alan.id, "asagi")))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <OzelAlanPanel mevcut={alan} />

      <button
        type="button"
        disabled={bekliyor}
        aria-label="Alanı sil"
        onClick={() => {
          setHata(null);
          const uyari =
            alan.degerSayisi > 0
              ? `"${alan.ad}" alanı ve ${alan.degerSayisi} kayıttaki değeri silinsin mi? Bu geri alınamaz.`
              : `"${alan.ad}" alanı silinsin mi?`;
          if (!confirm(uyari)) return;
          basla(async () => {
            const sonuc = await alanSil(alan.id);
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
