"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import { anketOlustur, anketGuncelle, type FormState } from "@/app/(app)/anketler/actions";
import { ANKET_DURUM } from "@/lib/anket-tanimlar";

export type AnketDegerleri = {
  id: string;
  baslik: string;
  aciklama: string;
  durum: string;
  anonim: boolean;
  bitisTarihi: string;
};

const DURUM_ETIKET: Record<string, string> = {
  taslak: "Taslak",
  yayinda: "Yayında",
  kapandi: "Kapandı",
};

/** Anket tanımlama / düzenleme paneli (Faz 19 / N1). */
export default function AnketPanel({ mevcut }: { mevcut?: AnketDegerleri }) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? anketGuncelle.bind(null, mevcut!.id) : anketOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";
  // Anonimlik yalnızca TASLAK aşamasında değiştirilebilir (sunucu da bunu
  // zorlar); yayınlanmış ankette alan kilitlenir ve sebebi yazılır.
  const anonimKilitli = Boolean(mevcut && mevcut.durum !== "taslak");

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary text-sm">
          <Pencil className="h-4 w-4" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Anket
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
                {duzenleme ? "Anketi Düzenle" : "Yeni Anket"}
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
                <label className="label" htmlFor={`abaslik-${k}`}>Anket Başlığı *</label>
                <input
                  id={`abaslik-${k}`}
                  name="baslik"
                  required
                  defaultValue={mevcut?.baslik}
                  className="input"
                  placeholder="ör. 2026 Müşteri Memnuniyeti"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`aaciklama-${k}`}>Açıklama</label>
                <textarea
                  id={`aaciklama-${k}`}
                  name="aciklama"
                  rows={3}
                  defaultValue={mevcut?.aciklama}
                  className="input"
                  placeholder="Anket e-postasında da görünür."
                />
              </div>

              <div>
                <label className="label" htmlFor={`adurum-${k}`}>Durum</label>
                <select
                  id={`adurum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "taslak"}
                  className="input"
                >
                  {ANKET_DURUM.map((d) => (
                    <option key={d} value={d}>{DURUM_ETIKET[d]}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Yalnızca yayındaki anket gönderilebilir.
                </p>
              </div>

              <div>
                <label className="label" htmlFor={`abitis-${k}`}>Bitiş Tarihi</label>
                <input
                  id={`abitis-${k}`}
                  name="bitisTarihi"
                  type="date"
                  defaultValue={mevcut?.bitisTarihi}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Bağlantı bu tarihe kadar geçerlidir.
                </p>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-border/60 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="anonim"
                    value="1"
                    defaultChecked={mevcut?.anonim}
                    disabled={anonimKilitli}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-foreground">Anonim anket</span>
                    <span className="block text-xs text-muted-foreground">
                      İşaretlenirse yanıtlar kişiye ve firmaya BAĞLANMAZ — kimin
                      ne yanıtladığı sonradan da öğrenilemez. Kaç kişiye
                      gönderildiği ve kaçının yanıtladığı yine bilinir.
                    </span>
                    {anonimKilitli && (
                      <span className="mt-1 block text-xs text-amber-400">
                        Anket yayınlandığı için değiştirilemez: toplanmış
                        yanıtlar bu karara göre yazıldı.
                      </span>
                    )}
                  </span>
                </label>
                {/* Devre dışı bir onay kutusu form verisine GİRMEZ; mevcut
                    değer gizli alanla korunur, yoksa kaydetmek bayrağı
                    sessizce sıfırlardı. */}
                {anonimKilitli && mevcut?.anonim && (
                  <input type="hidden" name="anonim" value="1" />
                )}
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
