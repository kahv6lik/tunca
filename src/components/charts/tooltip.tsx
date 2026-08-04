"use client";

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (n: number) => n.toLocaleString("tr-TR"),
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-soft backdrop-blur-xl">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: p.color || p.fill || p.payload?.fill }}
          />
          <span className="font-semibold text-foreground">
            {valueFormatter(p.value)}
          </span>
          {p.name && p.name !== "value" && (
            <span className="text-xs text-muted-foreground">{p.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}
