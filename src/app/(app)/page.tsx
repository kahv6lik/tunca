import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Badge } from "@/components/ui";
import { formatPara, formatTarih } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    firmaSayisi,
    aktifFirma,
    yatirimAgg,
    egitimSayisi,
    hizmetSayisi,
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
    prisma.firma.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, ad: true, il: true, durum: true, createdAt: true },
    }),
    prisma.egitim.findMany({
      where: { durum: "planlandi" },
      orderBy: { tarih: "asc" },
      take: 5,
      include: { firma: { select: { ad: true } } },
    }),
  ]);

  const toplamYatirim = yatirimAgg._sum.tutar ?? 0;

  return (
    <div>
      <PageHeader
        title="Genel Bakış"
        subtitle="Firmalara verilen destek, eğitim ve hizmetlerin özeti"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Toplam Firma"
          value={firmaSayisi}
          hint={`${aktifFirma} aktif`}
          href="/firmalar"
        />
        <StatCard
          label="Yatırım Desteği (TRY)"
          value={formatPara(toplamYatirim)}
          hint="Onaylanan + tamamlanan"
          href="/yatirim-destekleri"
        />
        <StatCard
          label="Eğitim"
          value={egitimSayisi}
          hint="Toplam kayıt"
          href="/egitimler"
        />
        <StatCard
          label="Hizmet"
          value={hizmetSayisi}
          hint="Toplam kayıt"
          href="/hizmetler"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Son Eklenen Firmalar</h2>
            <Link href="/firmalar" className="text-sm text-brand-600 hover:underline">
              Tümü →
            </Link>
          </div>
          {sonFirmalar.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz firma eklenmemiş.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sonFirmalar.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link
                      href={`/firmalar/${f.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-brand-600"
                    >
                      {f.ad}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {f.il ?? "—"} · {formatTarih(f.createdAt)}
                    </p>
                  </div>
                  <Badge durum={f.durum} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Yaklaşan Eğitimler</h2>
            <Link href="/egitimler" className="text-sm text-brand-600 hover:underline">
              Tümü →
            </Link>
          </div>
          {yaklasanEgitimler.length === 0 ? (
            <p className="text-sm text-slate-500">Planlanmış eğitim yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {yaklasanEgitimler.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.baslik}</p>
                    <p className="text-xs text-slate-400">{e.firma.ad}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatTarih(e.tarih)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
