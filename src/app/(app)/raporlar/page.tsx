import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui";
import { formatPara } from "@/lib/format";
import { durumBadge } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Basit yatay çubuk grafik (CSS tabanlı, harici kütüphane yok)
function BarList({
  title,
  items,
  formatValue = (n: number) => String(n),
}: {
  title: string;
  items: { label: string; value: number; color?: string }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Veri yok.</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">{i.label}</span>
                <span className="font-medium text-slate-800">
                  {formatValue(i.value)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${i.color ?? "bg-brand-500"}`}
                  style={{ width: `${(i.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    prisma.yatirimDestegi.groupBy({
      by: ["durum"],
      _count: { _all: true },
      _sum: { tutar: true },
    }),
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
      take: 10,
    }),
  ]);

  // En çok yatırım alan firmaların adlarını getir
  const topFirmaIdler = topFirmalarRaw.map((t) => t.firmaId);
  const topFirmaKayit = await prisma.firma.findMany({
    where: { id: { in: topFirmaIdler } },
    select: { id: true, ad: true },
  });
  const adMap = new Map(topFirmaKayit.map((f) => [f.id, f.ad]));

  const durumRenk: Record<string, string> = {
    onaylandi: "bg-green-500",
    tamamlandi: "bg-emerald-500",
    basvuruldu: "bg-blue-500",
    reddedildi: "bg-red-500",
    planlandi: "bg-amber-500",
    iptal: "bg-red-500",
    devam: "bg-indigo-500",
  };

  const etiket = (d: string) => durumBadge(d).label;

  return (
    <div>
      <PageHeader
        title="Raporlar"
        subtitle="Firma, yatırım, eğitim ve hizmet istatistikleri"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Toplam Firma" value={firmaSayisi} />
        <StatCard
          label="Onaylı Yatırım (TRY)"
          value={formatPara(yatirimTryAgg._sum.tutar ?? 0)}
        />
        <StatCard label="Eğitim Saati" value={`${egitimAgg._sum.sureSaat ?? 0} s`} />
        <StatCard label="Toplam Katılımcı" value={egitimAgg._sum.katilimci ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="Yatırım Desteği — Durum Dağılımı (adet)"
          items={yatirimByDurum.map((y) => ({
            label: etiket(y.durum),
            value: y._count._all,
            color: durumRenk[y.durum],
          }))}
        />
        <BarList
          title="Yatırım Tutarı — Tür Bazında (TRY)"
          items={yatirimByTur.map((y) => ({
            label: y.tur ?? "Belirtilmemiş",
            value: y._sum.tutar ?? 0,
          }))}
          formatValue={(n) => formatPara(n)}
        />
        <BarList
          title="Eğitim — Durum Dağılımı (adet)"
          items={egitimByDurum.map((e) => ({
            label: etiket(e.durum),
            value: e._count._all,
            color: durumRenk[e.durum],
          }))}
        />
        <BarList
          title="Hizmet — Durum Dağılımı (adet)"
          items={hizmetByDurum.map((h) => ({
            label: etiket(h.durum),
            value: h._count._all,
            color: durumRenk[h.durum],
          }))}
        />
        <BarList
          title="İl Bazında Firma Sayısı (ilk 10)"
          items={firmaByIl
            .map((f) => ({ label: f.il ?? "Belirtilmemiş", value: f._count._all }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)}
          formatValue={(n) => `${n} firma`}
        />
        <BarList
          title="Sektör Bazında Firma Sayısı (ilk 10)"
          items={firmaBySektor
            .map((f) => ({ label: f.sektor ?? "Belirtilmemiş", value: f._count._all }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)}
          formatValue={(n) => `${n} firma`}
        />
        <div className="lg:col-span-2">
          <BarList
            title="En Çok Yatırım Alan Firmalar (TRY, ilk 10)"
            items={topFirmalarRaw.map((t) => ({
              label: adMap.get(t.firmaId) ?? "—",
              value: t._sum.tutar ?? 0,
              color: "bg-emerald-500",
            }))}
            formatValue={(n) => formatPara(n)}
          />
        </div>
      </div>
    </div>
  );
}
