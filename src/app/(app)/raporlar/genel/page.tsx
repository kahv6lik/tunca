import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { durumBadge } from "@/lib/constants";
import { DURUM_RENK } from "@/lib/chart-theme";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RaporSuzgeci from "@/components/raporlar/RaporSuzgeci";
import { raporBul } from "@/lib/rapor-tanimlar";

export const dynamic = "force-dynamic";

/**
 * Genel durum raporu — Faz 18 / R1 ile rapor merkezinin altına taşındı.
 *
 * Rota `/raporlar`dan `/raporlar/genel`e geçti; `/raporlar` artık MERKEZ
 * (hub) ekranıdır. Süzgeç çubuğu ortak bileşene devredildi — tarih mantığı
 * (gün sonu, ters aralık) artık her raporda tek yerden gelir.
 */
export default async function GenelRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.raporGoruntule);
  const db = await getTenantDb();

  /**
   * Tarih aralığı (Faz 13 / H9). Firma kayıtlarında EKLENME tarihi,
   * yatırım/eğitim/hizmet kayıtlarında işin KENDİ tarihi süzülür — "ağustosta
   * ne yaptık" sorusunda beklenen budur, kaydın ne zaman girildiği değil.
   */
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const kayitSuzgeci = aralik ? { tarih: aralik } : {};
  const firmaSuzgeci = aralik ? { createdAt: aralik } : {};
  const aralikEtiketi = araliktanEtiket(aralik);

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
    db.firma.count({ where: firmaSuzgeci }),
    db.yatirimDestegi.groupBy({
      by: ["durum"],
      where: kayitSuzgeci,
      _count: { _all: true },
    }),
    db.yatirimDestegi.groupBy({
      by: ["tur"],
      where: { paraBirimi: "TRY", ...kayitSuzgeci },
      _sum: { tutar: true },
    }),
    db.egitim.groupBy({ by: ["durum"], where: kayitSuzgeci, _count: { _all: true } }),
    db.hizmet.groupBy({ by: ["durum"], where: kayitSuzgeci, _count: { _all: true } }),
    db.firma.groupBy({ by: ["il"], where: firmaSuzgeci, _count: { _all: true } }),
    db.firma.groupBy({ by: ["sektor"], where: firmaSuzgeci, _count: { _all: true } }),
    db.egitim.aggregate({
      where: kayitSuzgeci,
      _sum: { sureSaat: true, katilimci: true },
    }),
    db.yatirimDestegi.aggregate({
      where: {
        paraBirimi: "TRY",
        durum: { in: ["onaylandi", "tamamlandi"] },
        ...kayitSuzgeci,
      },
      _sum: { tutar: true },
    }),
    db.yatirimDestegi.groupBy({
      by: ["firmaId"],
      where: { paraBirimi: "TRY", ...kayitSuzgeci },
      _sum: { tutar: true },
      orderBy: { _sum: { tutar: "desc" } },
      take: 8,
    }),
  ]);

  const topFirmaIdler = topFirmalarRaw.map((t) => t.firmaId);
  const topFirmaKayit = await db.firma.findMany({
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
      <div>
        <Link
          href="/raporlar"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Rapor Merkezi
        </Link>
        <PageHeader
          title="Genel Durum"
          subtitle={
            aralikEtiketi
              ? `Firma, yatırım, eğitim ve hizmet istatistikleri · ${aralikEtiketi}`
              : "Firma, yatırım, eğitim ve hizmet istatistikleri · tüm zamanlar"
          }
        />
        <RaporSuzgeci
          rapor={raporBul("genel")!}
          filtre={{ bas: searchParams.bas, bit: searchParams.bit }}
          firmalar={[]}
          kullanicilar={[]}
        />
      </div>

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
