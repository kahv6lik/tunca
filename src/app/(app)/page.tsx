import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { formatPara, formatTarih } from "@/lib/format";
import { DURUM_RENK } from "@/lib/chart-theme";
import { durumBadge } from "@/lib/constants";

export const dynamic = "force-dynamic";

const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default async function DashboardPage() {
  const now = new Date();
  const oniki = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    firmaSayisi,
    aktifFirma,
    yatirimAgg,
    egitimSayisi,
    hizmetSayisi,
    yatirimByDurum,
    yatirimSeri,
    sonFirmalar,
    yaklasanEgitimler,
  ] = await Promise.all([
    prisma.firma.count(),
    prisma.firma.count({ where: { durum: "aktif" } }),
    prisma.yatirimDestegi.aggregate({
      _sum: { tutar: true },
      where: { durum: { in: ["onaylandi", "tamamlandi"] }, paraBirimi: "TRY" },
    }),
    prisma.egitim.count(),
    prisma.hizmet.count(),
    prisma.yatirimDestegi.groupBy({ by: ["durum"], _count: { _all: true } }),
    prisma.yatirimDestegi.findMany({
      where: { tarih: { gte: oniki }, paraBirimi: "TRY" },
      select: { tarih: true, tutar: true },
    }),
    prisma.firma.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, ad: true, il: true, durum: true, createdAt: true, sektor: true },
    }),
    prisma.egitim.findMany({
      where: { durum: "planlandi" },
      orderBy: { tarih: "asc" },
      take: 6,
      include: { firma: { select: { ad: true } } },
    }),
  ]);

  const toplamYatirim = yatirimAgg._sum.tutar ?? 0;

  // Son 12 ay için aylık yatırım serisi
  const seri: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const toplam = yatirimSeri
      .filter((y) => {
        const t = new Date(y.tarih);
        return `${t.getFullYear()}-${t.getMonth()}` === key;
      })
      .reduce((s, y) => s + y.tutar, 0);
    seri.push({ label: AY_KISA[d.getMonth()], value: Math.round(toplam) });
  }

  const donutData = yatirimByDurum.map((y) => ({
    label: durumBadge(y.durum).label,
    value: y._count._all,
    color: DURUM_RENK[y.durum],
  }));
  const yatirimToplamAdet = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        subtitle="Firmalara verilen destek, eğitim ve hizmetlerin canlı özeti"
      />

      {/* KPI kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Toplam Firma"
          value={firmaSayisi}
          icon="building"
          accent="#6366f1"
          hint={`${aktifFirma} aktif firma`}
          href="/firmalar"
        />
        <KpiCard
          index={1}
          label="Onaylı Yatırım (TRY)"
          value={toplamYatirim}
          prefix="₺"
          icon="wallet"
          accent="#10b981"
          hint="Onaylanan + tamamlanan"
          href="/yatirim-destekleri"
        />
        <KpiCard
          index={2}
          label="Eğitim"
          value={egitimSayisi}
          icon="graduation"
          accent="#f59e0b"
          hint="Toplam kayıt"
          href="/egitimler"
        />
        <KpiCard
          index={3}
          label="Hizmet"
          value={hizmetSayisi}
          icon="wrench"
          accent="#0ea5e9"
          hint="Toplam kayıt"
          href="/hizmetler"
        />
      </div>

      {/* Grafikler */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Aylık Yatırım Trendi"
          subtitle="Son 12 ay · TRY"
          href="/raporlar"
          className="lg:col-span-2"
        >
          <AreaChart
            data={seri}
            color="#6366f1"
            format="currency"
          />
        </ChartCard>

        <ChartCard title="Yatırım Durumları" subtitle="Dağılım">
          {yatirimToplamAdet === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <DonutChart
              data={donutData}
              height={210}
              centerValue={String(yatirimToplamAdet)}
              centerLabel="kayıt"
            />
          )}
        </ChartCard>
      </div>

      {/* Listeler */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Son Eklenen Firmalar" href="/firmalar">
          {sonFirmalar.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Henüz firma eklenmemiş.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {sonFirmalar.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/firmalar/${f.id}`}
                        className="block truncate text-sm font-medium text-foreground hover:text-primary"
                      >
                        {f.ad}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {[f.sektor, f.il].filter(Boolean).join(" · ") || "—"} ·{" "}
                        {formatTarih(f.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge durum={f.durum} />
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Yaklaşan Eğitimler" href="/egitimler">
          {yaklasanEgitimler.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Planlanmış eğitim yok.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {yaklasanEgitimler.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{e.baslik}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.firma.ad}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                    {formatTarih(e.tarih)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
