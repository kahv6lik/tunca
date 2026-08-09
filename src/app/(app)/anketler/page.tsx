import Link from "next/link";
import { EyeOff } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { formatTarih } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { ANKET_DURUM, yanitOrani } from "@/lib/anket-tanimlar";
import AnketPanel from "@/components/anketler/AnketPanel";

export const dynamic = "force-dynamic";

/**
 * Anketler — Faz 19 / N1.
 *
 * Listede YANITLAMA ORANI durur: bir anketin değeri kaç soru içerdiği değil,
 * kaç kişinin yanıtladığıdır. Anonim anketler ayrıca işaretlenir — ekibin
 * "kim ne dedi" diye bakamayacağını bilmesi gerekir.
 */
export default async function AnketlerPage(props: {
  searchParams: Promise<{ ara?: string; durum?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.anketGoruntule);
  const yonetir = await yetkiVarMi(IZIN.anketYonet);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = (ANKET_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";

  const where: Prisma.AnketWhereInput = {
    AND: [
      ara ? { OR: metinArama<Prisma.AnketWhereInput>(ara, ["baslik", "aciklama"]) } : {},
      durum ? { durum } : {},
    ],
  };

  const anketler = await db.anket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      _count: { select: { sorular: true, gonderimler: true } },
      gonderimler: { where: { yanitTarihi: { not: null } }, select: { id: true } },
    },
  });

  const panel = yonetir ? <AnketPanel /> : undefined;

  return (
    <div>
      <PageHeader
        title="Anketler"
        subtitle={`${anketler.length} anket`}
        action={panel}
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Anket başlığı ya da açıklaması…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="taslak">Taslak</option>
            <option value="yayinda">Yayında</option>
            <option value="kapandi">Kapandı</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum) && <Link href="/anketler" className="btn-secondary">Temizle</Link>}
      </form>

      {anketler.length === 0 ? (
        <EmptyState
          title="Anket yok"
          description="Müşteri memnuniyeti ve geri bildirim anketleri burada tanımlanır, kişiye özel bağlantıyla gönderilir."
          action={panel}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Anket</th>
                <th className="th text-center">Soru</th>
                <th className="th text-center">Gönderim</th>
                <th className="th text-center">Yanıt</th>
                <th className="th text-center">Oran</th>
                <th className="th">Bitiş</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {anketler.map((a) => {
                const yanitlayan = a.gonderimler.length;
                const oran = yanitOrani(a._count.gonderimler, yanitlayan);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="td">
                      <Link
                        href={`/anketler/${a.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {a.baslik}
                      </Link>
                      {a.anonim && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> anonim
                        </span>
                      )}
                    </td>
                    <td className="td text-center text-sm">{a._count.sorular}</td>
                    <td className="td text-center text-sm">{a._count.gonderimler}</td>
                    <td className="td text-center text-sm">{yanitlayan}</td>
                    <td className="td text-center text-sm">
                      {oran === null ? "—" : `%${oran.toLocaleString("tr-TR")}`}
                    </td>
                    <td className="td text-xs text-muted-foreground">
                      {a.bitisTarihi ? formatTarih(a.bitisTarihi) : "—"}
                    </td>
                    <td className="td"><StatusBadge durum={a.durum} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
