"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, ArrowRightLeft } from "lucide-react";
import {
  leadOlustur,
  leadGuncelle,
  leadSil,
  leadDonustur,
  type FormState,
} from "@/app/(app)/adaylar/actions";
import { LEAD_DURUM, LEAD_KAYNAKLARI, durumBadge } from "@/lib/constants";

export type LeadDegerleri = {
  id: string;
  ad: string;
  firmaAd: string;
  unvan: string;
  email: string;
  telefon: string;
  il: string;
  sektor: string;
  kaynak: string;
  durum: string;
  notlar: string;
  atananId: string;
};

export default function LeadPanel({
  kullanicilar,
  mevcut,
}: {
  kullanicilar: { id: string; name: string }[];
  mevcut?: LeadDegerleri;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? leadGuncelle.bind(null, mevcut!.id) : leadOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

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
          <Plus className="h-4 w-4" /> Yeni Aday
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
                {duzenleme ? "Adayı Düzenle" : "Yeni Aday"}
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
                <label className="label" htmlFor={`ad-${anahtar}`}>
                  Ad Soyad *
                </label>
                <input
                  id={`ad-${anahtar}`}
                  name="ad"
                  required
                  defaultValue={mevcut?.ad}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`firmaAd-${anahtar}`}>
                  Firma Adı
                </label>
                <input
                  id={`firmaAd-${anahtar}`}
                  name="firmaAd"
                  defaultValue={mevcut?.firmaAd}
                  className="input"
                  placeholder="Henüz sistemde kayıtlı değil"
                />
              </div>
              <div>
                <label className="label" htmlFor={`unvan-${anahtar}`}>
                  Unvan
                </label>
                <input
                  id={`unvan-${anahtar}`}
                  name="unvan"
                  defaultValue={mevcut?.unvan}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`kaynak-${anahtar}`}>
                  Kaynak
                </label>
                <input
                  id={`kaynak-${anahtar}`}
                  name="kaynak"
                  list={`kaynaklar-${anahtar}`}
                  defaultValue={mevcut?.kaynak}
                  className="input"
                  placeholder="ör. Fuar"
                />
                <datalist id={`kaynaklar-${anahtar}`}>
                  {LEAD_KAYNAKLARI.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor={`email-${anahtar}`}>
                  E-posta
                </label>
                <input
                  id={`email-${anahtar}`}
                  name="email"
                  type="email"
                  defaultValue={mevcut?.email}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`telefon-${anahtar}`}>
                  Telefon
                </label>
                <input
                  id={`telefon-${anahtar}`}
                  name="telefon"
                  defaultValue={mevcut?.telefon}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`il-${anahtar}`}>
                  İl
                </label>
                <input id={`il-${anahtar}`} name="il" defaultValue={mevcut?.il} className="input" />
              </div>
              <div>
                <label className="label" htmlFor={`sektor-${anahtar}`}>
                  Sektör
                </label>
                <input
                  id={`sektor-${anahtar}`}
                  name="sektor"
                  defaultValue={mevcut?.sektor}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor={`durum-${anahtar}`}>
                  Durum
                </label>
                <select
                  id={`durum-${anahtar}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "yeni"}
                  className="input"
                >
                  {LEAD_DURUM.filter((d) => d !== "donusturuldu").map((d) => (
                    <option key={d} value={d}>
                      {durumBadge(d).label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  &quot;Dönüştürüldü&quot; elle seçilmez; dönüştürme işleminde kendiliğinden
                  atanır.
                </p>
              </div>
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
                <label className="label" htmlFor={`notlar-${anahtar}`}>
                  Notlar
                </label>
                <textarea
                  id={`notlar-${anahtar}`}
                  name="notlar"
                  rows={3}
                  defaultValue={mevcut?.notlar}
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

/**
 * Dönüştürme paneli (C5).
 *
 * Firma adı önceden doldurulur ama düzenlenebilir — adaydaki serbest metin
 * çoğu zaman resmî unvan değildir.
 */
export function DonusturPanel({
  lead,
  asamalar,
}: {
  lead: { id: string; ad: string; firmaAd: string };
  asamalar: { id: string; ad: string }[];
}) {
  const [acik, setAcik] = useState(false);
  const [firsatAc, setFirsatAc] = useState(asamalar.length > 0);
  const [state, formAction] = useFormState<FormState, FormData>(
    leadDonustur.bind(null, lead.id),
    {}
  );

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-primary h-8 px-2.5 text-xs">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Dönüştür
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Adayı Dönüştür</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-5 text-sm text-muted-foreground">
              <strong className="text-foreground">{lead.ad}</strong> için bir firma ve
              birincil kişi kaydı açılacak. Aday silinmez; nereye dönüştüğü kaydında
              saklanır.
            </p>

            <form action={formAction} className="space-y-4">
              <div>
                <label className="label" htmlFor={`donusFirma-${lead.id}`}>
                  Firma Adı *
                </label>
                <input
                  id={`donusFirma-${lead.id}`}
                  name="firmaAd"
                  required
                  defaultValue={lead.firmaAd || lead.ad}
                  className="input"
                />
              </div>

              {asamalar.length > 0 && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={firsatAc}
                      onChange={(e) => setFirsatAc(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Aynı anda bir fırsat da aç
                  </label>
                  <input type="hidden" name="firsatAc" value={firsatAc ? "1" : "0"} />

                  {firsatAc && (
                    <div className="grid gap-4 rounded-xl border border-border/60 p-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor={`fBaslik-${lead.id}`}>
                          Fırsat Başlığı *
                        </label>
                        <input
                          id={`fBaslik-${lead.id}`}
                          name="firsatBaslik"
                          defaultValue={`${lead.firmaAd || lead.ad} — ilk iş`}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`fAsama-${lead.id}`}>
                          Aşama *
                        </label>
                        <select id={`fAsama-${lead.id}`} name="asamaId" className="input">
                          {asamalar.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.ad}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`fTutar-${lead.id}`}>
                          Tutar
                        </label>
                        <input
                          id={`fTutar-${lead.id}`}
                          name="tutar"
                          type="number"
                          step="0.01"
                          min={0}
                          defaultValue={0}
                          className="input"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {state.error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <Donustur />
              </div>
            </form>
          </div>
        </ModalKatman>
      )}
    </>
  );
}

function Donustur() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Dönüştürülüyor…" : "Firmaya Dönüştür"}
    </button>
  );
}

export function LeadSilDugmesi({ id, ad }: { id: string; ad: string }) {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      type="button"
      disabled={bekliyor}
      aria-label="Adayı sil"
      onClick={() => {
        if (!confirm(`"${ad}" adayı silinsin mi?`)) return;
        basla(async () => void (await leadSil(id)));
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
