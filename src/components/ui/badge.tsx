import { cn } from "@/lib/utils";
import { durumBadge } from "@/lib/constants";

// Durum rozeti (aktif, onaylandı, planlandı…)
export function StatusBadge({ durum, className }: { durum: string; className?: string }) {
  const { label, className: c } = durumBadge(durum);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        c,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/60",
        className
      )}
    >
      {children}
    </span>
  );
}
