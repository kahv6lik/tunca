import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import { AKTIVITE_TUR } from "@/lib/constants";
import { aktiviteYuku, kirilim, oran, oranMetni } from "@/lib/rapor-saf";
import { raporBul } from "@/lib/rapor-tanimlar";
import RaporSuzgeci from "@/components/raporlar/RaporSuzgeci";

export const dynamic = "force-dynamic";

const TUR_ETIKET = new Map<string, string>(AKTIVITE_TUR.map((t) => [t.deger, t.etiket]));

/**
 * Aktivite yükü raporu — Faz 18 / R3.
 *
 * "Kimde ne kadar iş var" sorusunu yanıtlar. GECİKEN sayısı açık görevlerin
 * ALT KÜMESİDİR (`aktiviteYuku`), ayrı bir yığın değil: iki sütunu toplamak
 * aynı görevi iki kez saymak olurdu.
 */
export default async function AktiviteRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string; sorumlu?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.aktiviteGoruntule);

  const db = await getTenantDb();
  const filtre = {
    bas: searchParams.bas,
    bit: searchParams.bit,
    firma: searchParams.firma,
    sorumlu: searchParams.sorumlu,
  };
  const aralik = tarihAraligi(filtre.bas, filtre.bit);
  const firma = (filtre.firma ?? "").trim();
  const sorumlu = (filtre.sorumlu ?? "").trim();

  const where: Prisma.AktiviteWhereInput = {
    AND: [
      aralik ? { createdAt: aralik } : {},
      firma ? { firmaId: firma } : {},
      sorumlu ? { atananId: sorumlu } : {},
    ],
  };

  const [aktiviteler, firmalar, kullanicilar] = await Promise.all([
    db.aktivite.findMany({
      where,
      select: { tur: true, atananId: true, sonTarih: true, tamamlandi: true },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const yuk = aktiviteYuku(aktiviteler);
  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));

  const turDagilimi = kirilim(
    aktiviteler,
    (a) => TUR_ETIKET.get(a.tur) ?? a.tur,
    () => 1,
    8
  );

  const gorevler = aktiviteler.filter((a) => a.sonTarih);
  const tamamlanan = gorevler.filter((a) => a.tamamlandi).length;
  const geciken = yuk.reduce((t, k) => t + k.geciken, 0);
  const acikGorev = yuk.reduce((t, k) => t + k.acikGorev, 0);

  return (
    <div>
      <Link
        href="/raporlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Rapor Merkezi
      </Link>

      <PageHeader
        title="Aktivite Yükü"
        subtitle={araliktanEtiket(aralik) ?? "Tüm zamanlar"}
      />

      <RaporSuzgeci
        rapor={raporBul("aktivite")!}
        filtre={filtre}
        firmalar={firmalar}
        kullanicilar={kullanicilar}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kutu etiket="Toplam aktivite" deger={String(aktiviteler.length)} />
        <Kutu etiket="Açık görev" deger={String(acikGorev)} />
        <Kutu
          etiket="Geciken"
          deger={String(geciken)}
          vurgu={geciken > 0 ? "text-rose-400" : undefined}
          alt="Açık görevlerin alt kümesi"
        />
        <Kutu
          etiket="Görev tamamlama"
          deger={oranMetni(oran(tamamlanan, gorevler.length))}
          alt={`${tamamlanan} / ${gorevler.length} görev`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-1 font-semibold tracking-tight text-foreground">Kişi Yükü</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Geciken sayısı, açık görevlerin içindedir.
          </p>
          {yuk.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu dönemde aktivite yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/60">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="th">Kişi</th>
                    <th className="th text-center">Toplam</th>
                    <th className="th text-center">Açık görev</th>
                    <th className="th text-center">Geciken</th>
                    <th className="th text-center">Tamamlanan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {yuk.map((k) => (
                    <tr key={k.kullaniciId ?? "yok"} className="hover:bg-muted/40">
                      <td className="td text-sm">
                        {k.kullaniciId ? (
                          adOf.get(k.kullaniciId) ?? "—"
                        ) : (
                          <span className="text-muted-foreground">Atanmamış</span>
                        )}
                      </td>
                      <td className="td text-center text-sm">{k.toplam}</td>
                      <td className="td text-center text-sm">{k.acikGorev}</td>
                      <td
                        className={`td text-center text-sm ${
                          k.geciken > 0 ? "text-rose-400" : ""
                        }`}
                      >
                        {k.geciken}
                      </td>
                      <td className="td text-center text-sm">{k.tamamlanan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ChartCard title="Aktivite Türleri" subtitle="Dönemdeki dağılım">
          {turDagilimi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu dönemde aktivite yok.</p>
          ) : (
            <DonutChart data={turDagilimi} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function Kutu({
  etiket,
  deger,
  alt,
  vurgu,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  vurgu?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className={`mt-1 text-2xl font-semibold ${vurgu ?? "text-foreground"}`}>{deger}</p>
      {alt && <p className="mt-1 text-xs text-muted-foreground">{alt}</p>}
    </div>
  );
}
