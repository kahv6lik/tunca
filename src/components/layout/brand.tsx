import { cn } from "@/lib/utils";

/**
 * Marka alanı.
 *
 * Kiracının kendi logosu tanımlıysa (Faz 5 / B7) onu gösterir; yoksa Gezegen
 * markası görünür. `img` bilinçli olarak `next/image` değildir: logo adresi
 * kiracıdan gelir ve rastgele bir dış alan adı olabilir; `next/image` bunun
 * için `next.config.js`'te alan adı tanımı ister.
 */
export function Brand({
  className,
  logoUrl,
  ad,
}: {
  className?: string;
  logoUrl?: string | null;
  ad?: string;
}) {
  if (logoUrl) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={ad ?? "Logo"}
          className="h-9 w-9 rounded-xl object-contain"
        />
        <p className="truncate text-sm font-bold tracking-tight text-foreground">
          {ad ?? "Gezegen"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-lg shadow-[0_6px_18px_-6px_hsl(var(--primary)/0.8)]">
        <span aria-hidden>🪐</span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-foreground">Gezegen</p>
        <p className="-mt-0.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          CRM
        </p>
      </div>
    </div>
  );
}
