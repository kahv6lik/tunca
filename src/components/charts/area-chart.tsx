"use client";

import {
  Area,
  AreaChart as ReArea,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./tooltip";
import { makeFormatter, type ChartFormat } from "@/lib/chart-format";

export function AreaChart({
  data,
  dataKey = "value",
  xKey = "label",
  color = "#6366f1",
  height = 260,
  format = "number",
}: {
  data: Record<string, any>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  height?: number;
  format?: ChartFormat;
}) {
  const valueFormatter = makeFormatter(format);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReArea data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={`area-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: color, strokeOpacity: 0.2 }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#area-${color})`}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </ReArea>
    </ResponsiveContainer>
  );
}
