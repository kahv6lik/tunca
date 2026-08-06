import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { HIZMET_DURUM } from "@/lib/constants";

export const dynamic = "force-dynamic";
const SAYFA_BOYUTU = 25;

export default async function HizmetlerPage({
  searchParams,
}: {
  searchParams: { ara?: string; durum?: string; sayfa?: string };
}) {
  await yetkiGerektir(IZIN.hizmetGoruntule);
  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = searchParams.durum ?? "";
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.HizmetWhereInput = {
    AND: [
      ara
        ? { OR: [{ baslik: { contains: ara } }, { firma: { ad: { contains: ara } } }] }
        : {},
      durum ? { durum } : {},
    ],
  };

  const [toplam, kayitlar] = await Promise.all([
    db.hizmet.count({ where }),
    db.hizmet.findMany({
      where,
      orderBy: { tarih: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: { firma: { select: { id: true, ad: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  if (durum) qs.set("durum", durum);
  const baseUrl = `/hizmetler?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader title="Hizmetler" subtitle={`${toplam} kayıt`} />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input id="ara" name="ara" defaultValue={ara} placeholder="Başlık veya firma…" className="input" />
        </div>
        <div className="w-48">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            {HIZMET_DURUM.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum) && <Link href="/hizmetler" className="btn-secondary">Temizle</Link>}
      </form>

      {kayitlar.length === 0 ? (
        <EmptyState title="Kayıt bulunamadı" description="Hizmetler firma detay sayfasından eklenir." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Firma</th>
                <th className="th">Başlık</th>
                <th className="th">Tür</th>
                <th className="th">Tarih</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kayitlar.map((h) => (
                <tr key={h.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link href={`/firmalar/${h.firma.id}`} className="font-medium text-foreground hover:text-primary">
                      {h.firma.ad}
                    </Link>
                  </td>
                  <td className="td">{h.baslik}</td>
                  <td className="td">{h.tur ?? "—"}</td>
                  <td className="td">{formatTarih(h.tarih)}</td>
                  <td className="td"><StatusBadge durum={h.durum} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
