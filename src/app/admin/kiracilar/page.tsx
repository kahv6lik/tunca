import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getPlatformDb } from "@/lib/platform-db";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { KIRACI_DURUM } from "@/lib/constants";
import { durumBadge } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Kuruluş (kiracı) listesi — Faz 5 / B1. */
export default async function KiracilarPage({
  searchParams,
}: {
  searchParams: { q?: string; durum?: string };
}) {
  const db = await getPlatformDb();

  const q = (searchParams.q ?? "").trim();
  const durum = KIRACI_DURUM.includes(searchParams.durum as never)
    ? searchParams.durum
    : undefined;

  const kiracilar = await db.tenant.findMany({
    where: {
      ...(durum ? { durum } : {}),
      ...(q
        ? {
            OR: [
              { ad: { contains: q, mode: "insensitive" as const } },
              { slug: { contains: q, mode: "insensitive" as const } },
              { iletisimEmail: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { ad: "asc" },
    include: {
      plan: { select: { ad: true, kullaniciLimiti: true, firmaLimiti: true } },
      _count: { select: { kullanicilar: true, firmalar: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Kuruluşlar"
        subtitle={`${kiracilar.length} kayıt`}
        action={
          <Link href="/admin/kiracilar/yeni" className="btn-primary">
            <Plus className="h-4 w-4" /> Yeni Kuruluş
          </Link>
        }
      />

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="relative min-w-[220px] flex-1">
          <label className="label" htmlFor="q">
            Ara
          </label>
          <Search className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Kuruluş adı, kod veya e-posta"
            className="input pl-9"
          />
        </div>
        <div>
          <label className="label" htmlFor="durum">
            Durum
          </label>
          <select id="durum" name="durum" defaultValue={durum ?? ""} className="input">
            <option value="">Tümü</option>
            {KIRACI_DURUM.map((d) => (
              <option key={d} value={d}>
                {durumBadge(d).label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtrele
        </button>
      </form>

      {kiracilar.length === 0 ? (
        <EmptyState
          title="Kuruluş bulunamadı"
          description="Arama ölçütlerinizi değiştirin ya da yeni bir kuruluş ekleyin."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/60">
                <tr>
                  <th className="th">Kuruluş</th>
                  <th className="th">Kod</th>
                  <th className="th">Paket</th>
                  <th className="th">Kullanıcı</th>
                  <th className="th">Firma</th>
                  <th className="th">Durum</th>
                  <th className="th">Eklendi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {kiracilar.map((k) => {
                  const kLimit = k.plan?.kullaniciLimiti ?? 0;
                  const fLimit = k.plan?.firmaLimiti ?? 0;
                  return (
                    <tr key={k.id} className="transition-colors hover:bg-accent/40">
                      <td className="td">
                        <Link
                          href={`/admin/kiracilar/${k.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {k.ad}
                        </Link>
                        {k.iletisimEmail && (
                          <p className="text-xs text-muted-foreground">{k.iletisimEmail}</p>
                        )}
                      </td>
                      <td className="td font-mono text-xs text-muted-foreground">{k.slug}</td>
                      <td className="td text-muted-foreground">{k.plan?.ad ?? "—"}</td>
                      <td className="td">
                        {k._count.kullanicilar}
                        {kLimit > 0 && (
                          <span className="text-muted-foreground"> / {kLimit}</span>
                        )}
                      </td>
                      <td className="td">
                        {k._count.firmalar}
                        {fLimit > 0 && <span className="text-muted-foreground"> / {fLimit}</span>}
                      </td>
                      <td className="td">
                        <StatusBadge durum={k.durum} />
                      </td>
                      <td className="td text-muted-foreground">{formatTarih(k.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
