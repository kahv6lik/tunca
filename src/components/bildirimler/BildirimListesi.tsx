"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, Trash2, CheckCheck, Eraser } from "lucide-react";
import {
  bildirimOkundu,
  bildirimSil,
  tumunuOkunduIsaretle,
  okunanlariTemizle,
} from "@/app/(app)/bildirimler/actions";
import { formatTarih } from "@/lib/format";

export type BildirimOgesi = {
  id: string;
  tur: string;
  baslik: string;
  mesaj: string | null;
  link: string | null;
  okundu: string | null;
  createdAt: string;
};

export function TopluIslemler({ okunmamis }: { okunmamis: number }) {
  const [bekliyor, basla] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={bekliyor || okunmamis === 0}
        onClick={() => basla(async () => void (await tumunuOkunduIsaretle()))}
        className="btn-secondary"
      >
        <CheckCheck className="h-4 w-4" /> Tümünü okundu işaretle
      </button>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() => {
          if (!confirm("Okunmuş bildirimler silinsin mi?")) return;
          basla(async () => void (await okunanlariTemizle()));
        }}
        className="btn-secondary"
      >
        <Eraser className="h-4 w-4" /> Okunanları temizle
      </button>
    </div>
  );
}

export function BildirimSatiri({ b }: { b: BildirimOgesi }) {
  const [bekliyor, basla] = useTransition();
  const okunmamis = !b.okundu;

  const govde = (
    <div className="min-w-[200px] flex-1">
      <p className={okunmamis ? "font-semibold text-foreground" : "text-foreground/80"}>
        {b.baslik}
      </p>
      {b.mesaj && <p className="mt-0.5 text-sm text-muted-foreground">{b.mesaj}</p>}
      <p className="mt-1 text-xs text-muted-foreground/70">{formatTarih(b.createdAt)}</p>
    </div>
  );

  return (
    <div className={`flex flex-wrap items-start gap-3 p-4 ${okunmamis ? "bg-primary/[0.04]" : ""}`}>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          okunmamis ? "bg-primary" : "bg-transparent"
        }`}
        aria-hidden
      />

      {b.link ? (
        <Link
          href={b.link}
          onClick={() => {
            // Bildirime tıklamak onu okundu sayar — ayrıca işaretlemek
            // gereksiz bir adım olurdu.
            if (okunmamis) basla(async () => void (await bildirimOkundu(b.id)));
          }}
          className="flex flex-1 hover:text-primary"
        >
          {govde}
        </Link>
      ) : (
        govde
      )}

      <div className="flex items-center gap-1">
        {okunmamis && (
          <button
            type="button"
            disabled={bekliyor}
            aria-label="Okundu işaretle"
            onClick={() => basla(async () => void (await bildirimOkundu(b.id)))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={bekliyor}
          aria-label="Bildirimi sil"
          onClick={() => basla(async () => void (await bildirimSil(b.id)))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
