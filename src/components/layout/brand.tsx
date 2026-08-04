import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
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
