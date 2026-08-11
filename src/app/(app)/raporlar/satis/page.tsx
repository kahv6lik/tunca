import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { formatPara } from "@/lib/format";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import { hatOzeti, kirilim, oran, oranMetni } from "@/lib/rapor-saf";
import { raporBul } from "@/lib/rapor-tanimlar";
import RaporSuzgeci from "@/components/raporlar/RaporSuzgeci";
import RaporBasligi from "@/components/raporlar/RaporBasligi";

export const dynamic = "force-dynamic";

/**
 * Satış hattı raporu — Faz 18 / R3.
 *
 * DÖNÜŞÜM ORANI KAPANMIŞ İŞLER ÜZERİNDEN hesaplanır (`hatOzeti`): hâlâ açık
 * bir fırsat henüz kaybedilmedi. Açıkları paydaya koymak, hattı doldurdukça
 * başarı oranını düşük gösterirdi — satış ekibini yeni fırsat girmekten
 * caydıran bir rakam.
 */
export default async function SatisRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string; sorumlu?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.firsatGoruntule);
  const leadGorur = await yetkiVarMi(IZIN.leadGoruntule);

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

  const where: Prisma.FirsatWhereInput = {
    AND: [
      aralik ? { createdAt: aralik } : {},
      firma ? { firmaId: firma } : {},
      sorumlu ? { sorumluId: sorumlu } : {},
    ],
  };

  const [firsatlar, asamalar, leadler, firmalar, kullanicilar] = await Promise.all([
    db.firsat.findMany({
      where,
      select: {
        durum: true,
        tutar: true,
        olasilik: true,
        asamaId: true,
        sorumluId: true,
        kapanisSebebi: true,
      },
    }),
    db.asama.findMany({ orderBy: { sira: "asc" }, select: { id: true, ad: true, renk: true } }),
    leadGorur
      ? db.lead.findMany({
          where: aralik ? { createdAt: aralik } : {},
          select: { durum: true, kaynak: true },
        })
      : Promise.resolve([]),
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

  const ozet = hatOzeti(firsatlar);
  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));
  const asamaAdi = new Map(asamalar.map((a) => [a.id, a.ad]));

  // Aşama dağılımı YALNIZCA AÇIK fırsatları sayar: kapanmış iş son aşamasında
  // durur (Faz 6 kararı) ve hattı olduğundan dolu gösterirdi.
  const acikFirsatlar = firsatlar.filter((f) => f.durum === "acik");
  const asamaDagilimi = asamalar.map((a) => ({
    label: a.ad,
    value: acikFirsatlar.filter((f) => f.asamaId === a.id).length,
    color: a.renk ?? undefined,
  }));
  const asamaTutari = asamalar
    .map((a) => ({
      label: a.ad,
      value: Math.round(
        acikFirsatlar
          .filter((f) => f.asamaId === a.id)
          .reduce((t, f) => t + f.tutar, 0)
      ),
      color: a.renk ?? undefined,
    }))
    .filter((x) => x.value > 0);

  const sorumluKirilimi = kirilim(
    firsatlar,
    (f) => (f.sorumluId ? adOf.get(f.sorumluId) ?? "—" : "Atanmamış"),
    () => 1,
    8
  );
  const kayipSebepleri = kirilim(
    firsatlar.filter((f) => f.durum === "kaybedildi" && f.kapanisSebebi),
    (f) => f.kapanisSebebi!,
    () => 1,
    8
  );

  const donusenLead = leadler.filter((l) => l.durum === "donusturuldu").length;
  const leadDonusum = oran(donusenLead, leadler.length);

  return (
    <div>
      <Link
        href="/raporlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Rapor Merkezi
      </Link>

      <RaporBasligi baslik="Satış Hattı" donem={araliktanEtiket(aralik)} />

      <RaporSuzgeci
        rapor={raporBul("satis")!}
        filtre={filtre}
        firmalar={firmalar}
        kullanicilar={kullanicilar}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kutu
          etiket="Açık fırsat"
          deger={String(ozet.acik)}
          alt={formatPara(ozet.acikTutar)}
        />
        <Kutu
          etiket="Beklenen ciro"
          deger={formatPara(ozet.beklenenCiro)}
          alt="Tutar × olasılık"
        />
        <Kutu
          etiket="Dönüşüm oranı"
          deger={oranMetni(ozet.donusumOrani)}
          alt={`${ozet.kazanilan} kazanıldı / ${ozet.kaybedilen} kaybedildi`}
        />
        <Kutu
          etiket="Kazanılan tutar"
          deger={formatPara(ozet.kazanilanTutar)}
          alt={`${ozet.toplam} fırsat incelendi`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Aşama Dağılımı" subtitle="Yalnızca açık fırsatlar">
          {ozet.acik === 0 ? (
            <p className="text-sm text-muted-foreground">Açık fırsat yok.</p>
          ) : (
            <DonutChart data={asamaDagilimi.filter((a) => a.value > 0)} />
          )}
        </ChartCard>

        <ChartCard title="Aşamadaki Tutar" subtitle="Açık fırsatların aşama bazında toplamı">
          {asamaTutari.length === 0 ? (
            <p className="text-sm text-muted-foreground">Açık fırsat yok.</p>
          ) : (
            <BarChart data={asamaTutari} horizontal format="currency" />
          )}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Sorumlu Bazında Fırsat" subtitle="Dönemdeki fırsat adedi">
          {sorumluKirilimi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            <BarChart data={sorumluKirilimi} horizontal />
          )}
        </ChartCard>

        <div className="card p-5">
          <h3 className="mb-1 font-semibold tracking-tight text-foreground">
            Kayıp Sebepleri
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Kaybedilen fırsatlarda girilen gerekçeler
          </p>
          {kayipSebepleri.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Gerekçe girilmiş kayıp fırsat yok.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {kayipSebepleri.map((k) => (
                <li key={k.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{k.label}</span>
                  <span className="ml-3 shrink-0 font-medium text-foreground">{k.value}</span>
                </li>
              ))}
            </ul>
          )}

          {leadGorur && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground">Aday dönüşüm oranı</p>
              <p className="text-lg font-semibold text-foreground">
                {oranMetni(leadDonusum)}
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                {donusenLead} / {leadler.length} aday firmaya dönüştü
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kutu({ etiket, deger, alt }: { etiket: string; deger: string; alt?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{deger}</p>
      {alt && <p className="mt-1 text-xs text-muted-foreground">{alt}</p>}
    </div>
  );
}
