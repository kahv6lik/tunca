import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Star } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";
const SAYFA_BOYUTU = 25;

/**
 * Kişi listesi (Faz 6 / C1).
 *
 * Kişiler firma detay sayfasından eklenir; burası kiracı genelinde arama
 * içindir — "şu telefon kimindi?" sorusunun yanıtı.
 */
export default async function KisilerPage({
  searchParams,
}: {
  searchParams: { ara?: string; sayfa?: string };
}) {
  await yetkiGerektir(IZIN.kisiGoruntule);
  const db = await getTenantDb();

  const ara = (searchParams.ara ?? "").trim();
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.KisiWhereInput = ara
    ? {
        OR: [
          { ad: { contains: ara, mode: "insensitive" } },
          { unvan: { contains: ara, mode: "insensitive" } },
          { email: { contains: ara, mode: "insensitive" } },
          { telefon: { contains: ara } },
          { firma: { ad: { contains: ara, mode: "insensitive" } } },
        ],
      }
    : {};

  const [toplam, kisiler] = await Promise.all([
    db.kisi.count({ where }),
    db.kisi.findMany({
      where,
      orderBy: [{ birincil: "desc" }, { ad: "asc" }],
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: {
        firma: { select: { id: true, ad: true } },
        _count: { select: { firsatlar: true } },
      },
    }),
  ]);

  const toplamSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  const baseUrl = `/kisiler?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader title="Kişiler" subtitle={`${toplam} kişi`} />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="ara">
            Ara
          </label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Ad, unvan, e-posta, telefon veya firma…"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary">
          Filtrele
        </button>
        {ara && (
          <Link href="/kisiler" className="btn-secondary">
            Temizle
          </Link>
        )}
      </form>

      {kisiler.length === 0 ? (
        <EmptyState
          title="Kişi bulunamadı"
          description="Kişiler firma detay sayfasındaki Kişiler bölümünden eklenir."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Ad</th>
                <th className="th">Unvan</th>
                <th className="th">Firma</th>
                <th className="th">Telefon</th>
                <th className="th">E-posta</th>
                <th className="th">Fırsat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kisiler.map((k) => (
                <tr key={k.id} className="hover:bg-muted/40">
                  <td className="td">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {k.birincil && (
                        <Star
                          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                          aria-label="Birincil kişi"
                        />
                      )}
                      {k.ad}
                    </span>
                  </td>
                  <td className="td">{k.unvan ?? "—"}</td>
                  <td className="td">
                    <Link
                      href={`/firmalar/${k.firma.id}`}
                      className="text-foreground hover:text-primary"
                    >
                      {k.firma.ad}
                    </Link>
                  </td>
                  <td className="td">
                    {k.telefon ? (
                      <a href={`tel:${k.telefon}`} className="hover:text-primary">
                        {k.telefon}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="td">
                    {k.email ? (
                      <a href={`mailto:${k.email}`} className="hover:text-primary">
                        {k.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="td">{k._count.firsatlar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={toplamSayfa} baseUrl={baseUrl} />
    </div>
  );
}
