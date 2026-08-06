"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, Trash2, X, Play, Pause, Zap } from "lucide-react";
import {
  kuralKaydet,
  kuralSil,
  kuralDurumDegistir,
  kuraliSimdiCalistir,
  type FormState,
} from "@/app/(app)/otomasyon/actions";
import { TETIKLEYICILER } from "@/lib/is-akisi-tanimlar";

export type KuralDegerleri = {
  id: string;
  ad: string;
  aciklama: string;
  tetikleyici: string;
  gun: number;
  aktif: boolean;
  eylemBildirim: boolean;
  eylemGorev: boolean;
  eylemBaslik: string;
  eylemMesaj: string;
  gorevGun: number;
};

export default function KuralPanel({ mevcut }: { mevcut?: KuralDegerleri }) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const [state, formAction] = useFormState<FormState, FormData>(
    kuralKaydet.bind(null, mevcut?.id ?? null),
    {}
  );
  const [tetikleyici, setTetikleyici] = useState(
    mevcut?.tetikleyici ?? TETIKLEYICILER[0].deger
  );
  const [gorevSecili, setGorevSecili] = useState(mevcut?.eylemGorev ?? false);

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const secili = TETIKLEYICILER.find((t) => t.deger === tetikleyici);
  const anahtar = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Kural
        </button>
      )}

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Kuralı Düzenle" : "Yeni İş Akışı Kuralı"}
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
                <label className="label" htmlFor={`ad-${anahtar}`}>
                  Kural Adı *
                </label>
                <input
                  id={`ad-${anahtar}`}
                  name="ad"
                  required
                  defaultValue={mevcut?.ad}
                  className="input"
                  placeholder="ör. Bekleyen fırsatları hatırlat"
                />
              </div>

              <div>
                <label className="label" htmlFor={`tetik-${anahtar}`}>
                  Ne zaman çalışsın? *
                </label>
                <select
                  id={`tetik-${anahtar}`}
                  name="tetikleyici"
                  value={tetikleyici}
                  onChange={(e) => setTetikleyici(e.target.value)}
                  className="input"
                >
                  {TETIKLEYICILER.map((t) => (
                    <option key={t.deger} value={t.deger}>
                      {t.etiket}
                    </option>
                  ))}
                </select>
                {secili && (
                  <p className="mt-1 text-xs text-muted-foreground">{secili.aciklama}</p>
                )}
              </div>

              {secili?.ayar === "gun" && (
                <div>
                  <label className="label" htmlFor={`gun-${anahtar}`}>
                    Gün sayısı
                  </label>
                  <input
                    id={`gun-${anahtar}`}
                    name="gun"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={mevcut?.gun ?? 3}
                    className="input"
                  />
                </div>
              )}

              <div className="rounded-xl border border-border/60 p-4">
                <p className="label">Ne yapsın? *</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input type="hidden" name="eylemBildirim" value="0" />
                    <input
                      type="checkbox"
                      name="eylemBildirim"
                      value="1"
                      defaultChecked={mevcut?.eylemBildirim ?? true}
                      className="h-4 w-4 rounded border-border"
                    />
                    Bildirim gönder (uygulama içi + e-posta)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input type="hidden" name="eylemGorev" value="0" />
                    <input
                      type="checkbox"
                      name="eylemGorev"
                      value="1"
                      defaultChecked={mevcut?.eylemGorev ?? false}
                      onChange={(e) => setGorevSecili(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    Takip görevi oluştur
                  </label>
                </div>

                {gorevSecili && (
                  <div className="mt-3">
                    <label className="label" htmlFor={`gorevGun-${anahtar}`}>
                      Görev kaç gün sonrasına açılsın?
                    </label>
                    <input
                      id={`gorevGun-${anahtar}`}
                      name="gorevGun"
                      type="number"
                      min={0}
                      max={90}
                      defaultValue={mevcut?.gorevGun ?? 1}
                      className="input"
                    />
                  </div>
                )}

                <div className="mt-3 grid gap-3">
                  <div>
                    <label className="label" htmlFor={`eBaslik-${anahtar}`}>
                      Başlık
                    </label>
                    <input
                      id={`eBaslik-${anahtar}`}
                      name="eylemBaslik"
                      defaultValue={mevcut?.eylemBaslik}
                      className="input"
                      placeholder="Boş bırakılırsa kural adı kullanılır"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      <code className="rounded bg-muted/60 px-1">{"{kayit}"}</code> yazarsanız
                      ilgili kaydın adıyla değiştirilir.
                    </p>
                  </div>
                  <div>
                    <label className="label" htmlFor={`eMesaj-${anahtar}`}>
                      Mesaj
                    </label>
                    <input
                      id={`eMesaj-${anahtar}`}
                      name="eylemMesaj"
                      defaultValue={mevcut?.eylemMesaj}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="hidden" name="aktif" value="0" />
                <input
                  type="checkbox"
                  name="aktif"
                  value="1"
                  defaultChecked={mevcut?.aktif ?? true}
                  className="h-4 w-4 rounded border-border"
                />
                Kural açık
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

/** Kural satırındaki işlemler: aç/durdur, şimdi çalıştır, sil. */
export function KuralIslemleri({
  kural,
}: {
  kural: { id: string; ad: string; aktif: boolean };
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={bekliyor}
        title="Şimdi çalıştır"
        aria-label="Kuralı şimdi çalıştır"
        onClick={() => basla(async () => void (await kuraliSimdiCalistir(kural.id)))}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Zap className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        disabled={bekliyor}
        title={kural.aktif ? "Durdur" : "Aç"}
        aria-label={kural.aktif ? "Kuralı durdur" : "Kuralı aç"}
        onClick={() =>
          basla(async () => void (await kuralDurumDegistir(kural.id, !kural.aktif)))
        }
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
      >
        {kural.aktif ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        disabled={bekliyor}
        aria-label="Kuralı sil"
        onClick={() => {
          if (!confirm(`"${kural.ad}" kuralı silinsin mi?`)) return;
          basla(async () => void (await kuralSil(kural.id)));
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
