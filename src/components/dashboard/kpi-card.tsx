"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Wallet,
  GraduationCap,
  Wrench,
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { NumberTicker } from "@/components/magic/number-ticker";

// Server component'ten fonksiyon geçilemediği için ikonu anahtarla eşleriz
const ICONS: Record<string, LucideIcon> = {
  building: Building2,
  wallet: Wallet,
  graduation: GraduationCap,
  wrench: Wrench,
  chart: BarChart3,
  clock: Clock,
  users: Users,
  trending: TrendingUp,
};

export type KpiIcon = keyof typeof ICONS;

export function KpiCard({
  label,
  value,
  icon,
  accent = "#6366f1",
  prefix = "",
  suffix = "",
  hint,
  href,
  index = 0,
}: {
  label: string;
  value: number;
  icon: KpiIcon;
  accent?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  href?: string;
  index?: number;
}) {
  const Icon = ICONS[icon] ?? Building2;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="card-glow group relative overflow-hidden p-5"
    >
      {/* accent parıltı */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset"
          style={{
            background: `${accent}1f`,
            color: accent,
            borderColor: `${accent}33`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[1.7rem] font-bold tracking-tight text-foreground">
        <NumberTicker value={value} prefix={prefix} suffix={suffix} />
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
    </motion.div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
