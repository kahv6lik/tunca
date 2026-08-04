import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { durumBadge } from "@/lib/constants";
import { DURUM_RENK } from "@/lib/chart-theme";

export const dynamic = "force-dynamic";

export default async function RaporlarPage() {
  const [
    firmaSayisi,
    yatirimByDurum,
    yatirimByTur,
    egitimByDurum,
    hizmetByDurum,
    firmaByIl,
    firmaBySektor,
    egitimAgg,
    yatirimTryAgg,
    topFirmalarRaw,
  ] = await Promise.all([
    prisma.firma.count(),
    prisma.yatirimDestegi.groupBy({ by: ["durum"], _count: { _all: true } }),
    prisma.yatirimDestegi.groupBy({
      by: ["tur"],
      where: { paraBirimi: "TRY" },
      _sum: { tutar: true },
    }),
    prisma.egitim.groupBy({ by: ["durum"], _count: { _all: true } }),
    prisma.hizmet.groupBy({ by: ["durum"], _count: { _all: true } }),
    prisma.firma.groupBy({ by: ["il"], _count: { _all: true } }),
    prisma.firma.groupBy({ by: ["sektor"], _count: { _all: true } }),
    prisma.egitim.aggregate({ _sum: { sureSaat: true, katilimci: true } }),
    prisma.yatirimDestegi.aggregate({
      where: { paraBirimi: "TRY", durum: { in: ["onaylandi", "tamamlandi"] } },
      _sum: { tutar: true },
    }),
    prisma.yatirimDestegi.groupBy({
      by: ["firmaId"],
      where: { paraBirimi: "TRY" },
      _sum: { tutar: true },
      orderBy: { _sum: { tutar: "desc" } },
      take: 8,
    }),
  ]);

  const topFirmaIdler = topFirmalarRaw.map((t) => t.firmaId);
  const topFirmaKayit = await prisma.firma.findMany({
    where: { id: { in: topFirmaIdler } },
    select: { id: true, ad: true },
  });
  const adMap = new Map(topFirmaKayit.map((f) => [f.id, f.ad]));
  const etiket = (d: string) => durumBadge(d).label;

  const yatirimDurumData = yatirimByDurum.map((y) => ({
    label: etiket(y.durum),
    value: y._count._all,
    color: DURUM_RENK[y.durum],
  }));
  const egitimDurumData = egitimByDurum.map((e) => ({
    label: etiket(e.durum),
    value: e._count._all,
    color: DURUM_RENK[e.durum],
  }));
  const hizmetDurumData = hizmetByDurum.map((h) => ({
    label: etiket(h.durum),
    value: h._count._all,
    color: DURUM_RENK[h.durum],
  }));
  const turData = yatirimByTur.map((y) => ({
    label: y.tur ?? "Belirtilmemiş",
    value: Math.round(y._sum.tutar ?? 0),
  }));
  const ilData = firmaByIl
    .map((f) => ({ label: f.il ?? "Belirtilmemiş", value: f._count._all }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const sektorData = firmaBySektor
    .map((f) => ({ label: f.sektor ?? "Belirtilmemiş", value: f._count._all }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const topFirmaData = topFirmalarRaw.map((t) => ({
    label: adMap.get(t.firmaId) ?? "—",
    value: Math.round(t._sum.tutar ?? 0),
    color: "#10b981",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        subtitle="Firma, yatırım, eğitim ve hizmet istatistikleri"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Toplam Firma" value={firmaSayisi} icon="building" accent="#6366f1" />
        <KpiCard
          index={1}
          label="Onaylı Yatırım (TRY)"
          value={yatirimTryAgg._sum.tutar ?? 0}
          prefix="₺"
          icon="wallet"
          accent="#10b981"
        />
        <KpiCard
          index={2}
          label="Eğitim Saati"
          value={egitimAgg._sum.sureSaat ?? 0}
          suffix=" s"
          icon="clock"
          accent="#f59e0b"
        />
        <KpiCard
          index={3}
          label="Toplam Katılımcı"
          value={egitimAgg._sum.katilimci ?? 0}
          icon="users"
          accent="#0ea5e9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Yatırım Desteği — Durum Dağılımı" subtitle="Kayıt adedi">
          {yatirimDurumData.length ? (
            <DonutChart data={yatirimDurumData} height={230} centerLabel="kayıt" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Yatırım Tutarı — Tür Bazında" subtitle="TRY">
          {turData.length ? (
            <BarChart data={turData} height={230} format="currency" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Eğitim — Durum Dağılımı" subtitle="Kayıt adedi">
          {egitimDurumData.length ? (
            <DonutChart data={egitimDurumData} height={230} centerLabel="eğitim" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Hizmet — Durum Dağılımı" subtitle="Kayıt adedi">
          {hizmetDurumData.length ? (
            <DonutChart data={hizmetDurumData} height={230} centerLabel="hizmet" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="İl Bazında Firma Sayısı" subtitle="İlk 8">
          {ilData.length ? (
            <BarChart data={ilData} height={300} horizontal format="firma" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Sektör Bazında Firma Sayısı" subtitle="İlk 8">
          {sektorData.length ? (
            <BarChart data={sektorData} height={300} horizontal format="firma" />
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="En Çok Yatırım Alan Firmalar" subtitle="TRY · İlk 8" className="lg:col-span-2">
          {topFirmaData.length ? (
            <BarChart data={topFirmaData} height={320} horizontal format="currency" />
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-12 text-center text-sm text-muted-foreground">Veri yok.</p>;
}
