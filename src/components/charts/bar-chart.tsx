"use client";

import {
  Bar,
  BarChart as ReBar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/lib/chart-theme";
import { ChartTooltip } from "./tooltip";
import { makeFormatter, type ChartFormat } from "@/lib/chart-format";

export function BarChart({
  data,
  height = 300,
  horizontal = false,
  format = "number",
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  horizontal?: boolean;
  format?: ChartFormat;
}) {
  const valueFormatter = makeFormatter(format);
  const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBar
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: horizontal ? 8 : -14, bottom: 0 }}
        barCategoryGap={horizontal ? "22%" : "30%"}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          horizontal={!horizontal}
          vertical={horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={130}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
          </>
        )}
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </ReBar>
    </ResponsiveContainer>
  );
}
