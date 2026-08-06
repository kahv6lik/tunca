import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPara, formatTarih } from "@/lib/format";
import { TEKLIF_DURUM, durumBadge } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Teklif listesi (Faz 7 / C7). */
export default async function TekliflerPage({
  searchParams,
}: {
  searchParams: { ara?: string; durum?: string };
}) {
  await yetkiGerektir(IZIN.teklifGoruntule);
  const ekleyebilir = await yetkiVarMi(IZIN.teklifOlustur);

  const db = await getTenantDb();

  const ara = (searchParams.ara ?? "").trim();
  const durum = TEKLIF_DURUM.includes(searchParams.durum as never) ? searchParams.durum : "";

  const where: Prisma.TeklifWhereInput = {
    AND: [
      ara
        ? {
            OR: [
              { no: { contains: ara, mode: "insensitive" as const } },
              { baslik: { contains: ara, mode: "insensitive" as const } },
              { firma: { ad: { contains: ara, mode: "insensitive" as const } } },
            ],
          }
        : {},
      durum ? { durum } : {},
    ],
  };

  const [teklifler, ozet] = await Promise.all([
    db.teklif.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        firma: { select: { id: true, ad: true } },
        firsat: { select: { baslik: true } },
        _count: { select: { kalemler: true, revizyonlar: true } },
      },
    }),
    db.teklif.groupBy({ by: ["durum"], _sum: { toplam: true }, _count: { _all: true } }),
  ]);

  const toplamOf = (d: string) => ozet.find((o) => o.durum === d)?._sum.toplam ?? 0;
  const sayiOf = (d: string) => ozet.find((o) => o.durum === d)?._count._all ?? 0;

  return (
    <div>
      <PageHeader
        title="Teklifler"
        subtitle={`${ozet.reduce((s, o) => s + o._count._all, 0)} teklif`}
        action={
          ekleyebilir ? (
            <Link href="/teklifler/yeni" className="btn-primary">
              <Plus className="h-4 w-4" /> Yeni Teklif
            </Link>
          ) : undefined
        }
      />

      <div className="card mb-4 grid gap-4 p-4 sm:grid-cols-4">
        <Kutu etiket="Taslak" sayi={sayiOf("taslak")} tutar={toplamOf("taslak")} />
        <Kutu etiket="Gönderildi" sayi={sayiOf("gonderildi")} tutar={toplamOf("gonderildi")} />
        <Kutu etiket="Kabul" sayi={sayiOf("kabul")} tutar={toplamOf("kabul")} />
        <Kutu etiket="Red" sayi={sayiOf("red")} tutar={toplamOf("red")} />
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">
            Ara
          </label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Teklif no, başlık veya firma…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">
            Durum
          </label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            {TEKLIF_DURUM.map((d) => (
              <option key={d} value={d}>
                {durumBadge(d).label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Filtrele
        </button>
        {(ara || durum) && (
          <Link href="/teklifler" className="btn-secondary">
            Temizle
          </Link>
        )}
      </form>

      {teklifler.length === 0 ? (
        <EmptyState
          title="Teklif bulunamadı"
          description="Fırsatlarınız için kalemli teklifler hazırlayın; revizyonlar geçmişiyle birlikte saklanır."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">No</th>
                <th className="th">Başlık</th>
                <th className="th">Firma</th>
                <th className="th">Kalem</th>
                <th className="th">Toplam</th>
                <th className="th">Geçerlilik</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {teklifler.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/teklifler/${t.id}`}
                      className="font-mono text-sm font-medium text-foreground hover:text-primary"
                    >
                      {t.no}
                    </Link>
                    {t.revizyonNo > 1 && (
                      <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400">
                        R{t.revizyonNo}
                      </span>
                    )}
                  </td>
                  <td className="td">
                    {t.baslik}
                    {t.firsat && (
                      <p className="text-xs text-muted-foreground">{t.firsat.baslik}</p>
                    )}
                  </td>
                  <td className="td">
                    <Link
                      href={`/firmalar/${t.firma.id}`}
                      className="text-foreground hover:text-primary"
                    >
                      {t.firma.ad}
                    </Link>
                  </td>
                  <td className="td">{t._count.kalemler}</td>
                  <td className="td font-medium">{formatPara(t.toplam, t.paraBirimi)}</td>
                  <td className="td text-muted-foreground">
                    {t.gecerlilikTarihi ? formatTarih(t.gecerlilikTarihi) : "—"}
                  </td>
                  <td className="td">
                    <StatusBadge durum={t.durum} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kutu({ etiket, sayi, tutar }: { etiket: string; sayi: number; tutar: number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {etiket}
      </p>
      <p className="mt-1 text-lg font-bold text-foreground">{formatPara(tutar)}</p>
      <p className="text-xs text-muted-foreground/70">{sayi} teklif</p>
    </div>
  );
}
