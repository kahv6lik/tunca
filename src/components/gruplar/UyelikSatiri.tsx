"use client";

import { useTransition } from "react";
import { uyelikDegistir } from "@/app/(app)/gruplar/actions";

export default function UyelikSatiri({
  grupId,
  kullanici,
  uye,
}: {
  grupId: string;
  kullanici: { id: string; ad: string; email: string; rolEtiket: string };
  uye: boolean;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{kullanici.ad}</p>
        <p className="truncate text-xs text-muted-foreground">
          {kullanici.email} · {kullanici.rolEtiket}
        </p>
      </div>
      <input
        type="checkbox"
        checked={uye}
        disabled={bekliyor}
        onChange={(e) => {
          const ekle = e.target.checked;
          basla(async () => {
            await uyelikDegistir(grupId, kullanici.id, ekle);
          });
        }}
        className="h-4 w-4 shrink-0 rounded border-border/70 bg-secondary/40 accent-[hsl(var(--primary))] disabled:opacity-50"
      />
    </label>
  );
}
