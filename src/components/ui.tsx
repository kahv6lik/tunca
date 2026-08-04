import Link from "next/link";
import { durumBadge } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="card p-5 transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Badge({ durum }: { durum: string }) {
  const { label, className } = durumBadge(durum);
  return <span className={`badge ${className}`}>{label}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <p className="text-lg font-semibold text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  baseUrl,
}: {
  page: number;
  totalPages: number;
  baseUrl: string; // örn "/firmalar?ara=abc&"
}) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-slate-500">
        Sayfa {page} / {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={`${baseUrl}sayfa=${prev}`}
          aria-disabled={page <= 1}
          className={`btn-secondary text-sm ${
            page <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
        >
          ← Önceki
        </Link>
        <Link
          href={`${baseUrl}sayfa=${next}`}
          aria-disabled={page >= totalPages}
          className={`btn-secondary text-sm ${
            page >= totalPages ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Sonraki →
        </Link>
      </div>
    </div>
  );
}
