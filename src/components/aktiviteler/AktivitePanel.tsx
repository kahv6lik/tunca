"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, Check, RotateCcw } from "lucide-react";
import {
  aktiviteOlustur,
  aktiviteGuncelle,
  aktiviteTamamla,
  aktiviteSil,
  type FormState,
} from "@/app/(app)/aktiviteler/actions";
import { AKTIVITE_TUR } from "@/lib/constants";

type Secenek = { id: string; ad: string };

export type AktiviteDegerleri = {
  id: string;
  tur: string;
  baslik: string;
  aciklama: string;
  firmaId: string;
  kisiId: string;
  firsatId: string;
  atananId: string;
  sonTarih: string;
};

/**
 * Aktivite / görev paneli (Faz 7 / C4).
 *
 * `sabitFirmaId` verildiğinde firma seçici gizlenir (firma detayından
 * eklenirken) ve kişi/fırsat listeleri o firmanınkilerle sınırlıdır. Sunucu
 * tarafı bu bağı ayrıca doğrular — arayüzdeki daraltma koruma değildir.
 */
export default function AktivitePanel({
  kullanicilar,
  firmalar,
  kisiler,
  firsatlar,
  sabitFirmaId,
  mevcut,
  dugmeEtiketi,
}: {
  kullanicilar: { id: string; name: string }[];
  firmalar?: Secenek[];
  kisiler?: Secenek[];
  firsatlar?: Secenek[];
  sabitFirmaId?: string;
  mevcut?: AktiviteDegerleri;
  dugmeEtiketi?: string;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? aktiviteGuncelle.bind(null, mevcut!.id) : aktiviteOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [tur, setTur] = useState(mevcut?.tur ?? "not");

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const anahtar = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> {dugmeEtiketi ?? "Yeni Aktivite"}
        </button>
      )}

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Aktiviteyi Düzenle" : "Yeni Aktivite"}
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
                <label className="label" htmlFor={`tur-${anahtar}`}>
                  Tür
                </label>
                <select
                  id={`tur-${anahtar}`}
                  name="tur"
                  value={tur}
                  onChange={(e) => setTur(e.target.value)}
                  className="input"
                >
                  {AKTIVITE_TUR.map((t) => (
                    <option key={t.deger} value={t.deger}>
                      {t.etiket}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`sonTarih-${anahtar}`}>
                  Son Tarih
                </label>
                <input
                  id={`sonTarih-${anahtar}`}
                  name="sonTarih"
                  type="date"
                  defaultValue={mevcut?.sonTarih}
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Doldurursanız kayıt &quot;yapılacak iş&quot; olur ve görev listesinde çıkar.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`baslik-${anahtar}`}>
                  Başlık *
                </label>
                <input
                  id={`baslik-${anahtar}`}
                  name="baslik"
                  required
                  defaultValue={mevcut?.baslik}
                  className="input"
                  placeholder="ör. Fiyat görüşmesi için arandı"
                />
              </div>

              {sabitFirmaId ? (
                <input type="hidden" name="firmaId" value={sabitFirmaId} />
              ) : (
                firmalar && (
                  <div>
                    <label className="label" htmlFor={`firma-${anahtar}`}>
                      Firma
                    </label>
                    <select
                      id={`firma-${anahtar}`}
                      name="firmaId"
                      defaultValue={mevcut?.firmaId ?? ""}
                      className="input"
                    >
                      <option value="">—</option>
                      {firmalar.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.ad}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {kisiler && (
                <div>
                  <label className="label" htmlFor={`kisi-${anahtar}`}>
                    Kişi
                  </label>
                  <select
                    id={`kisi-${anahtar}`}
                    name="kisiId"
                    defaultValue={mevcut?.kisiId ?? ""}
                    className="input"
                  >
                    <option value="">—</option>
                    {kisiler.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {firsatlar && (
                <div>
                  <label className="label" htmlFor={`firsat-${anahtar}`}>
                    Fırsat
                  </label>
                  <select
                    id={`firsat-${anahtar}`}
                    name="firsatId"
                    defaultValue={mevcut?.firsatId ?? ""}
                    className="input"
                  >
                    <option value="">—</option>
                    {firsatlar.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor={`atanan-${anahtar}`}>
                  Atanan
                </label>
                <select
                  id={`atanan-${anahtar}`}
                  name="atananId"
                  defaultValue={mevcut?.atananId ?? ""}
                  className="input"
                >
                  <option value="">—</option>
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`aciklama-${anahtar}`}>
                  Açıklama
                </label>
                <textarea
                  id={`aciklama-${anahtar}`}
                  name="aciklama"
                  rows={3}
                  defaultValue={mevcut?.aciklama}
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

/** Görev satırındaki tamamla / geri al / sil düğmeleri. */
export function AktiviteIslemleri({
  id,
  baslik,
  tamamlandi,
  gorev,
  duzenleyebilir,
  silebilir,
}: {
  id: string;
  baslik: string;
  tamamlandi: boolean;
  gorev: boolean;
  duzenleyebilir: boolean;
  silebilir: boolean;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {gorev && duzenleyebilir && (
        <button
          type="button"
          disabled={bekliyor}
          aria-label={tamamlandi ? "Yeniden aç" : "Tamamlandı olarak işaretle"}
          onClick={() => basla(async () => void (await aktiviteTamamla(id, !tamamlandi)))}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
            tamamlandi
              ? "border-border/70 text-muted-foreground hover:text-foreground"
              : "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
          }`}
        >
          {tamamlandi ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
        </button>
      )}

      {silebilir && (
        <button
          type="button"
          disabled={bekliyor}
          aria-label="Aktiviteyi sil"
          onClick={() => {
            if (!confirm(`"${baslik}" silinsin mi?`)) return;
            basla(async () => void (await aktiviteSil(id)));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
