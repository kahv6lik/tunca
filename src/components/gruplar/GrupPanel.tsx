"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Pencil, Trash2 } from "lucide-react";
import { grupOlustur, grupGuncelle, grupSil, type FormState } from "@/app/(app)/gruplar/actions";

type IzinModulu = { ad: string; izinler: { deger: string; etiket: string }[] };
type Mevcut = { id: string; ad: string; aciklama: string; izinler: string[] };

function Kaydet({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : label}
    </button>
  );
}

export default function GrupPanel({
  izinModulleri,
  mevcut,
}: {
  izinModulleri: IzinModulu[];
  mevcut?: Mevcut;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? grupGuncelle.bind(null, mevcut!.id) : grupOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  // Kayıt başarılı olunca paneli kapat
  if (state.ok && acik) {
    setTimeout(() => setAcik(false), 0);
  }

  const secili = new Set(mevcut?.izinler ?? []);

  return (
    <>
      {duzenleme ? (
        <div className="flex items-center gap-1">
          <button onClick={() => setAcik(true)} className="btn-secondary text-sm">
            <Pencil className="h-3.5 w-3.5" /> Düzenle
          </button>
          <form
            action={async () => {
              if (confirm(`"${mevcut!.ad}" grubunu silmek istediğinize emin misiniz?`)) {
                await grupSil(mevcut!.id);
              }
            }}
          >
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
              aria-label="Grubu sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Grup
        </button>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {acik && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
                onClick={() => setAcik(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="card my-8 w-full max-w-2xl p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      {duzenleme ? "Grubu Düzenle" : "Yeni Grup"}
                    </h2>
                    <button
                      onClick={() => setAcik(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                      aria-label="Kapat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form action={formAction} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor={`ad-${mevcut?.id ?? "yeni"}`}>
                          Grup Adı
                        </label>
                        <input
                          id={`ad-${mevcut?.id ?? "yeni"}`}
                          name="ad"
                          required
                          defaultValue={mevcut?.ad}
                          className="input"
                          placeholder="ör. Saha Ekibi"
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
                          placeholder="isteğe bağlı"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="label mb-2">İzinler</p>
                      <div className="space-y-4 rounded-xl border border-border/60 p-4">
                        {izinModulleri.map((modul) => (
                          <div key={modul.ad}>
                            <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground/70">
                              {modul.ad}
                            </p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {modul.izinler.map((izin) => (
                                <label
                                  key={izin.deger}
                                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90"
                                >
                                  <input
                                    type="checkbox"
                                    name="izinler"
                                    value={izin.deger}
                                    defaultChecked={secili.has(izin.deger)}
                                    className="h-4 w-4 rounded border-border/70 bg-secondary/40 accent-[hsl(var(--primary))]"
                                  />
                                  {izin.etiket}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {state.error && (
                      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                        {state.error}
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAcik(false)}
                        className="btn-secondary"
                      >
                        Vazgeç
                      </button>
                      <Kaydet label={duzenleme ? "Değişiklikleri Kaydet" : "Grubu Oluştur"} />
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
