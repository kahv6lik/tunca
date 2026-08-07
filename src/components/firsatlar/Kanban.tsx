"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trophy, XCircle, GripVertical } from "lucide-react";
import { firsatAsamaDegistir } from "@/app/(app)/firsatlar/actions";
import { formatPara, formatTarih } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KanbanAsama = { id: string; ad: string; renk: string | null };

export type KanbanFirsat = {
  id: string;
  asamaId: string;
  baslik: string;
  tutar: number;
  paraBirimi: string;
  olasilik: number;
  kapanisTarihi: string | null;
  firmaAd: string;
  firmaId: string;
  kisiAd: string | null;
  sorumluAd: string | null;
};

/**
 * Satış hattı kanban'ı (Faz 6 / C3).
 *
 * Sürükle-bırak, tarayıcının kendi HTML5 drag-and-drop API'siyle yapılır —
 * bunun için ek bir kütüphane kurulmadı. Dokunmatik cihazlarda sürükleme
 * güvenilir değildir; o yüzden her kartta ayrıca bir aşama seçici vardır ve
 * klavye kullanıcıları da onu kullanabilir. Sürükleme bir kolaylıktır,
 * tek yol değildir.
 *
 * Aşama değişikliği sunucuda `firsatAsamaDegistir` ile yapılır; orada yetki
 * ve sahiplik yeniden doğrulanır.
 */
export default function Kanban({
  asamalar,
  firsatlar,
  duzenleyebilir,
}: {
  asamalar: KanbanAsama[];
  firsatlar: KanbanFirsat[];
  duzenleyebilir: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [suruklenen, setSuruklenen] = useState<string | null>(null);
  const [hedef, setHedef] = useState<string | null>(null);
  // İyimser güncelleme: sunucu yanıtı beklenirken kart yeni sütunda görünür.
  const [tasinan, setTasinan] = useState<Record<string, string>>({});

  const asamaOf = (f: KanbanFirsat) => tasinan[f.id] ?? f.asamaId;

  function tasi(firsatId: string, asamaId: string) {
    if (!duzenleyebilir) return;
    const firsat = firsatlar.find((f) => f.id === firsatId);
    if (!firsat || asamaOf(firsat) === asamaId) return;

    setTasinan((t) => ({ ...t, [firsatId]: asamaId }));
    basla(async () => {
      await firsatAsamaDegistir(firsatId, asamaId);
    });
  }

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-4">
      {asamalar.map((asama) => {
        const sutun = firsatlar.filter((f) => asamaOf(f) === asama.id);
        const toplam = sutun.reduce((s, f) => s + f.tutar, 0);
        const beklenen = sutun.reduce((s, f) => s + (f.tutar * f.olasilik) / 100, 0);
        const renk = asama.renk ?? "#6366f1";

        return (
          <div
            key={asama.id}
            onDragOver={(e) => {
              if (!duzenleyebilir) return;
              e.preventDefault();
              setHedef(asama.id);
            }}
            onDragLeave={() => setHedef((h) => (h === asama.id ? null : h))}
            onDrop={(e) => {
              e.preventDefault();
              setHedef(null);
              if (suruklenen) tasi(suruklenen, asama.id);
              setSuruklenen(null);
            }}
            className={cn(
              // Sütunlar ekranı DOLDURUR: az aşamada genişleyip yayılır,
              // çok aşamada min-genişliğin altına inmez ve yatay kaydırma açılır.
              "flex min-w-[270px] flex-1 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/40 transition-colors",
              hedef === asama.id && "border-primary/60 bg-primary/5"
            )}
          >
            <div className="border-b border-border/60 p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: renk }}
                  aria-hidden
                />
                <h3 className="flex-1 truncate text-sm font-semibold text-foreground">
                  {asama.ad}
                </h3>
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5 text-xs text-muted-foreground">
                  {sutun.length}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatPara(toplam)}
                {beklenen > 0 && (
                  <span className="text-muted-foreground/70">
                    {" "}
                    · beklenen {formatPara(beklenen)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex-1 space-y-2 p-2">
              {sutun.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground/60">
                  Bu aşamada fırsat yok
                </p>
              )}

              {sutun.map((f) => (
                <div
                  key={f.id}
                  draggable={duzenleyebilir}
                  onDragStart={() => setSuruklenen(f.id)}
                  onDragEnd={() => {
                    setSuruklenen(null);
                    setHedef(null);
                  }}
                  className={cn(
                    "card group p-3 transition-opacity",
                    duzenleyebilir && "cursor-grab active:cursor-grabbing",
                    suruklenen === f.id && "opacity-40",
                    bekliyor && tasinan[f.id] && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    {duzenleyebilir && (
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {f.baslik}
                      </p>
                      <Link
                        href={`/firmalar/${f.firmaId}`}
                        className="block truncate text-xs text-muted-foreground hover:text-primary"
                      >
                        {f.firmaAd}
                      </Link>
                    </div>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatPara(f.tutar, f.paraBirimi)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      %{f.olasilik}
                    </span>
                  </p>

                  {(f.kisiAd || f.sorumluAd || f.kapanisTarihi) && (
                    <p className="mt-1 truncate text-xs text-muted-foreground/80">
                      {[
                        f.kisiAd,
                        f.sorumluAd,
                        f.kapanisTarihi ? formatTarih(f.kapanisTarihi) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  {duzenleyebilir && (
                    <select
                      aria-label={`${f.baslik} aşaması`}
                      value={asamaOf(f)}
                      onChange={(e) => tasi(f.id, e.target.value)}
                      className="mt-2 h-7 w-full rounded-lg border border-border/60 bg-background/60 px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                      {asamalar.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.ad}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Kanban üstündeki özet şeridi. */
export function HatOzeti({
  acikSayi,
  acikToplam,
  beklenen,
  kazanilan,
  kaybedilen,
}: {
  acikSayi: number;
  acikToplam: number;
  beklenen: number;
  kazanilan: number;
  kaybedilen: number;
}) {
  return (
    <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kutu etiket="Açık fırsat" deger={`${acikSayi}`} alt={formatPara(acikToplam)} />
      <Kutu
        etiket="Beklenen ciro"
        deger={formatPara(beklenen)}
        alt="tutar × olasılık"
      />
      <Kutu
        etiket="Kazanılan"
        deger={formatPara(kazanilan)}
        ikon={<Trophy className="h-4 w-4 text-emerald-500" />}
      />
      <Kutu
        etiket="Kaybedilen"
        deger={formatPara(kaybedilen)}
        ikon={<XCircle className="h-4 w-4 text-rose-400" />}
      />
    </div>
  );
}

function Kutu({
  etiket,
  deger,
  alt,
  ikon,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  ikon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {ikon}
        {etiket}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">{deger}</p>
      {alt && <p className="text-xs text-muted-foreground/70">{alt}</p>}
    </div>
  );
}
