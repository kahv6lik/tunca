"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  Bookmark,
  BookmarkPlus,
  Star,
  Trash2,
  X,
  Users,
} from "lucide-react";
import {
  gorunumKaydet,
  gorunumSil,
  gorunumVarsayilan,
  type GorunumState,
} from "@/app/(app)/gorunum-actions";
import type { GorunumOgesi } from "@/lib/gorunum";

/**
 * Kayıtlı görünüm çubuğu — Faz 10 / E4.
 *
 * Liste sayfasının başlığına eklenir. İki iş yapar:
 *   1. Kayıtlı görünümleri listeler (kişisel + paylaşılan) ve tıklanınca
 *      o filtre URL'ine götürür.
 *   2. O ANKİ filtreyi adlandırıp kaydeder.
 *
 * `filtreler` sayfanın aktif süzgeçleridir (DisaAktarDugmesi ile aynı desen);
 * boş değerler ayıklanır.
 */
export default function GorunumBar({
  liste,
  gorunumler,
  filtreler = {},
}: {
  liste: string;
  gorunumler: GorunumOgesi[];
  filtreler?: Record<string, string | undefined>;
}) {
  const [menuAcik, setMenuAcik] = useState(false);
  const [kayitAcik, setKayitAcik] = useState(false);
  const [bekliyor, basla] = useTransition();
  const [state, formAction] = useFormState<GorunumState, FormData>(gorunumKaydet, {});

  const aktifSorgu = (() => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filtreler)) {
      if (v) qs.set(k, v);
    }
    return qs.toString();
  })();

  if (state.ok && kayitAcik) setTimeout(() => setKayitAcik(false), 0);

  const kisisel = gorunumler.filter((g) => g.benim);
  const paylasilanlar = gorunumler.filter((g) => !g.benim);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuAcik((a) => !a)}
          className="btn-secondary"
          aria-expanded={menuAcik}
          aria-haspopup="menu"
        >
          <Bookmark className="h-4 w-4" /> Görünümler
          {gorunumler.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">
              {gorunumler.length}
            </span>
          )}
        </button>

        {menuAcik && (
          <>
            <button
              type="button"
              aria-label="Menüyü kapat"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuAcik(false)}
            />
            <div role="menu" className="card absolute right-0 z-50 mt-2 w-80 p-2">
              <a
                href={`/${liste}?g=1`}
                className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Tümü (süzgeçsiz)
              </a>

              {kisisel.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Görünümlerim
                </p>
              )}
              {kisisel.map((g) => (
                <div
                  key={g.id}
                  className="group flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-accent"
                >
                  <a
                    href={`/${liste}?g=1&${g.sorgu}`}
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-sm text-foreground"
                  >
                    {g.varsayilan && (
                      <Star
                        className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                        aria-label="Varsayılan"
                      />
                    )}
                    <span className="truncate">{g.ad}</span>
                    {g.paylasilan && (
                      <Users
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                        aria-label="Paylaşılan"
                      />
                    )}
                  </a>
                  <button
                    type="button"
                    disabled={bekliyor}
                    title={g.varsayilan ? "Varsayılanı kaldır" : "Varsayılan yap"}
                    aria-label={g.varsayilan ? "Varsayılanı kaldır" : "Varsayılan yap"}
                    onClick={() =>
                      basla(async () => void (await gorunumVarsayilan(g.id, !g.varsayilan)))
                    }
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-amber-400 group-hover:opacity-100"
                  >
                    <Star className={`h-3.5 w-3.5 ${g.varsayilan ? "fill-amber-400 text-amber-400" : ""}`} />
                  </button>
                  <button
                    type="button"
                    disabled={bekliyor}
                    aria-label="Görünümü sil"
                    onClick={() => {
                      if (!confirm(`"${g.ad}" görünümü silinsin mi?`)) return;
                      basla(async () => void (await gorunumSil(g.id)));
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {paylasilanlar.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Paylaşılanlar
                </p>
              )}
              {paylasilanlar.map((g) => (
                <a
                  key={g.id}
                  href={`/${liste}?g=1&${g.sorgu}`}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate">{g.ad}</span>
                  {g.sahibi && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground/60">
                      {g.sahibi}
                    </span>
                  )}
                </a>
              ))}

              <div className="mt-1 border-t border-border/60 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuAcik(false);
                    setKayitAcik(true);
                  }}
                  disabled={!aktifSorgu}
                  title={aktifSorgu ? "" : "Önce listeyi süzün"}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-40"
                >
                  <BookmarkPlus className="h-4 w-4 text-primary" />
                  Bu filtreyi görünüm olarak kaydet
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {kayitAcik && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setKayitAcik(false)}
        >
          <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Görünümü Kaydet</h2>
              <button
                onClick={() => setKayitAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="liste" value={liste} />
              <input type="hidden" name="sorgu" value={aktifSorgu} />

              <div>
                <label className="label" htmlFor={`gad-${liste}`}>
                  Görünüm Adı *
                </label>
                <input
                  id={`gad-${liste}`}
                  name="ad"
                  required
                  maxLength={60}
                  className="input"
                  placeholder="ör. İzmir'deki aktif tekstilciler"
                />
              </div>

              <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
                Kaydedilecek filtre: <code className="text-foreground">{aktifSorgu}</code>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="hidden" name="paylasilan" value="0" />
                <input
                  type="checkbox"
                  name="paylasilan"
                  value="1"
                  className="h-4 w-4 rounded border-border"
                />
                Ekiple paylaş (kuruluştaki herkes görür)
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="hidden" name="varsayilan" value="0" />
                <input
                  type="checkbox"
                  name="varsayilan"
                  value="1"
                  className="h-4 w-4 rounded border-border"
                />
                Varsayılan yap (liste açılınca bu görünüm gelsin)
              </label>

              {state.error && <p className="text-sm text-rose-400">{state.error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setKayitAcik(false)} className="btn-secondary">
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
