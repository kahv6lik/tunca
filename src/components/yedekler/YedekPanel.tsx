"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  DatabaseBackup,
  Download,
  Trash2,
  Upload,
  RotateCcw,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  simdiYedekAl,
  yedekSil,
  dosyadanYukle,
  yedegiGeriYukle,
  type YedekState,
} from "@/app/(app)/yedekler/actions";

export function SimdiYedekAl() {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => basla(async () => void (await simdiYedekAl()))}
      className="btn-primary"
    >
      <DatabaseBackup className="h-4 w-4" />
      {bekliyor ? "Alınıyor…" : "Şimdi Yedek Al"}
    </button>
  );
}

export function DosyadanYukleFormu() {
  const [state, formAction] = useFormState<YedekState, FormData>(dosyadanYukle, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label className="label" htmlFor="yedek-dosya">
          Yedek dosyasından yükle (.json.gz veya .json)
        </label>
        <input
          id="yedek-dosya"
          name="dosya"
          type="file"
          accept=".gz,.json,application/gzip,application/json"
          required
          className="input file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:text-foreground"
        />
      </div>
      <YukleDugmesi />
      {state.error && <p className="w-full text-sm text-rose-400">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-emerald-400">{state.bilgi}</p>}
    </form>
  );
}

function YukleDugmesi() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      <Upload className="h-4 w-4" />
      {pending ? "Yükleniyor…" : "Yükle"}
    </button>
  );
}

/** Satır işlemleri: indir, geri yükle (onaylı), sil. */
export function YedekIslemleri({
  yedek,
}: {
  yedek: { id: string; kayitSayisi: number; tur: string };
}) {
  const [geriYukleAcik, setGeriYukleAcik] = useState(false);
  const [bekliyor, basla] = useTransition();
  const [state, formAction] = useFormState<YedekState, FormData>(
    yedegiGeriYukle.bind(null, yedek.id),
    {}
  );

  return (
    <div className="flex items-center gap-1">
      <a
        href={`/api/yedek?id=${yedek.id}`}
        title="İndir"
        aria-label="Yedeği indir"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
      </a>

      <button
        type="button"
        onClick={() => setGeriYukleAcik(true)}
        className="btn-secondary h-8 px-2.5 text-xs"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Geri Yükle
      </button>

      <button
        type="button"
        disabled={bekliyor}
        aria-label="Yedeği sil"
        onClick={() => {
          if (!confirm("Bu yedek silinsin mi? (Verinize dokunulmaz, yalnızca yedek dosyası silinir.)"))
            return;
          basla(async () => void (await yedekSil(yedek.id)));
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {geriYukleAcik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setGeriYukleAcik(false)}
        >
          <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Yedeği Geri Yükle</h2>
              <button
                onClick={() => setGeriYukleAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {state.ok ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                  <p className="text-sm text-foreground">{state.bilgi}</p>
                </div>
                {state.detay && state.eklenen! > 0 && (
                  <ul className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
                    {Object.entries(state.detay)
                      .filter(([, sayi]) => sayi > 0)
                      .map(([model, sayi]) => (
                        <li key={model}>
                          {model}: <span className="text-foreground">{sayi}</span> kayıt
                        </li>
                      ))}
                  </ul>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setGeriYukleAcik(false)}
                    className="btn-primary"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bu yedekte <strong className="text-foreground">{yedek.kayitSayisi}</strong>{" "}
                  kayıt var. Geri yükleme <strong>ekleyicidir</strong>: yalnızca şu an var
                  olmayan kayıtlar eklenir, mevcut kayıtlara <strong>dokunulmaz</strong>.
                  İki kez çalıştırmak zararsızdır.
                </p>

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="onay"
                    value="1"
                    required
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  Ne yapacağını anladım; yedekteki eksik kayıtların eklenmesini
                  onaylıyorum.
                </label>

                {state.error && <p className="text-sm text-rose-400">{state.error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGeriYukleAcik(false)}
                    className="btn-secondary"
                  >
                    Vazgeç
                  </button>
                  <GeriYukleDugmesi />
                </div>
              </form>
            )}
          </div>
        </ModalKatman>
      )}
    </div>
  );
}

function GeriYukleDugmesi() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Geri yükleniyor…" : "Geri Yükle"}
    </button>
  );
}
