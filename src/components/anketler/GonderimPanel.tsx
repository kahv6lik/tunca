"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Send, X } from "lucide-react";
import { anketGonder, type FormState } from "@/app/(app)/anketler/actions";

export type GonderilecekKisi = {
  id: string;
  ad: string;
  email: string;
  firmaAd: string;
  gonderildi: boolean;
};

/**
 * Anket gönderim paneli (Faz 19 / N2).
 *
 * DAHA ÖNCE GÖNDERİLENLER işaretli ve seçilemez durumdadır: aynı kişiye
 * ikinci bir bağlantı göndermek, yanıtlama oranını ve "kaç kişiye sorduk"
 * rakamını bozar. Sunucu da bu kişileri atlar — arayüzdeki işaret yalnızca
 * kullanıcıya durumu anlatmak içindir.
 */
export default function GonderimPanel({
  anketId,
  kisiler,
}: {
  anketId: string;
  kisiler: GonderilecekKisi[];
}) {
  const [acik, setAcik] = useState(false);
  const [ara, setAra] = useState("");
  const [state, formAction] = useFormState<FormState, FormData>(
    anketGonder.bind(null, anketId),
    {}
  );

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const gorunen = useMemo(() => {
    const terim = ara.trim().toLocaleLowerCase("tr");
    if (!terim) return kisiler;
    return kisiler.filter(
      (k) =>
        k.ad.toLocaleLowerCase("tr").includes(terim) ||
        k.firmaAd.toLocaleLowerCase("tr").includes(terim) ||
        k.email.toLocaleLowerCase("tr").includes(terim)
    );
  }, [ara, kisiler]);

  const bekleyen = kisiler.filter((k) => !k.gonderildi).length;

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-primary">
        <Send className="h-4 w-4" /> Gönder
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Anketi Gönder</h2>
                <p className="text-xs text-muted-foreground">
                  Her alıcı kişiye özel, tek kullanımlık bir bağlantı alır.
                </p>
              </div>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              value={ara}
              onChange={(e) => setAra(e.target.value)}
              placeholder="Kontak, firma ya da e-posta ara…"
              className="input mb-3"
            />

            <form action={formAction}>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60">
                {gorunen.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    E-posta adresi olan kontak bulunamadı.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {gorunen.map((k) => (
                      <li key={k.id} className="flex items-center gap-3 p-2.5">
                        <input
                          type="checkbox"
                          name="kisiId"
                          value={k.id}
                          disabled={k.gonderildi}
                          id={`gk-${k.id}`}
                        />
                        <label htmlFor={`gk-${k.id}`} className="min-w-0 flex-1 text-sm">
                          <span className="text-foreground">{k.ad}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {k.firmaAd} · {k.email}
                          </span>
                        </label>
                        {k.gonderildi && (
                          <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                            gönderildi
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {state.error && (
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {bekleyen} kontak henüz almadı
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAcik(false)}
                    className="btn-secondary"
                  >
                    Vazgeç
                  </button>
                  <Gonder />
                </div>
              </div>
            </form>
          </div>
        </ModalKatman>
      )}
    </>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Send className="h-4 w-4" /> {pending ? "Gönderiliyor…" : "Gönder"}
    </button>
  );
}
