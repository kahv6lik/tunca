"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";
import { ChartTooltip } from "./tooltip";
import { makeFormatter, type ChartFormat } from "@/lib/chart-format";

export function DonutChart({
  data,
  height = 260,
  format = "number",
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  format?: ChartFormat;
  centerLabel?: string;
  centerValue?: string;
}) {
  const valueFormatter = makeFormatter(format);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {centerValue ?? total}
          </span>
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-2">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {d.label}
            </span>
            <span className="font-medium text-foreground">
              {valueFormatter ? valueFormatter(d.value) : d.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
