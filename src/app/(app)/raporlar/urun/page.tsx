import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { formatPara } from "@/lib/format";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import { kirilim } from "@/lib/rapor-saf";
import { raporBul } from "@/lib/rapor-tanimlar";
import RaporSuzgeci from "@/components/raporlar/RaporSuzgeci";

export const dynamic = "force-dynamic";

/**
 * Ürün satış raporu — Faz 18 / R3.
 *
 * Kaynak ONAYLANMIŞ sipariş kalemleridir; onay bekleyen kalem henüz satış
 * değildir (mali rapordaki aynı kural). Kalemler ürünsüz de olabilir
 * (serbest metinli satır) — o satırlar "açıklama" adıyla görünür, sessizce
 * atılmaz, yoksa toplamlar tutmazdı.
 */
export default async function UrunRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.urunGoruntule);

  const db = await getTenantDb();
  const filtre = { bas: searchParams.bas, bit: searchParams.bit, firma: searchParams.firma };
  const aralik = tarihAraligi(filtre.bas, filtre.bit);
  const firma = (filtre.firma ?? "").trim();

  const [kalemler, firmalar] = await Promise.all([
    db.siparisKalemi.findMany({
      where: {
        siparis: {
          AND: [
            { durum: "onaylandi" },
            firma ? { firmaId: firma } : {},
            aralik ? { createdAt: aralik } : {},
          ],
        },
      },
      select: {
        aciklama: true,
        miktar: true,
        tutar: true,
        birim: true,
        urun: { select: { ad: true, kod: true, kategori: true } },
      },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
  ]);

  const ad = (k: (typeof kalemler)[number]) => k.urun?.ad ?? k.aciklama;

  const tutarKirilimi = kirilim(kalemler, ad, (k) => k.tutar, 10);
  const adetKirilimi = kirilim(kalemler, ad, (k) => k.miktar, 10);
  const kategoriKirilimi = kirilim(
    kalemler,
    (k) => k.urun?.kategori ?? "Kategorisiz",
    (k) => k.tutar,
    10
  );

  const toplamTutar = kalemler.reduce((t, k) => t + k.tutar, 0);
  const toplamAdet = kalemler.reduce((t, k) => t + k.miktar, 0);

  // Satır tablosu: grafiklerde ilk 10 görünür, tabloda hepsi durur.
  const satirlar = [...tutarKirilimi].map((t) => ({
    ad: t.label,
    tutar: t.value,
    adet: adetKirilimi.find((a) => a.label === t.label)?.value ?? 0,
  }));

  return (
    <div>
      <Link
        href="/raporlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Rapor Merkezi
      </Link>

      <PageHeader
        title="Ürün Satışı"
        subtitle={araliktanEtiket(aralik) ?? "Tüm zamanlar"}
      />

      <RaporSuzgeci
        rapor={raporBul("urun")!}
        filtre={filtre}
        firmalar={firmalar}
        kullanicilar={[]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kutu etiket="Satış tutarı" deger={formatPara(Math.round(toplamTutar))} />
        <Kutu etiket="Satılan adet" deger={toplamAdet.toLocaleString("tr-TR")} />
        <Kutu etiket="Kalem sayısı" deger={String(kalemler.length)} />
      </div>

      {kalemler.length === 0 ? (
        <p className="card mt-4 p-5 text-sm text-muted-foreground">
          Bu dönemde onaylanmış sipariş kalemi yok.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Tutara Göre" subtitle="En çok ciro getiren ürünler">
              <BarChart data={tutarKirilimi} horizontal format="currency" />
            </ChartCard>
            <ChartCard title="Adede Göre" subtitle="En çok satılan ürünler">
              <BarChart data={adetKirilimi} horizontal />
            </ChartCard>
          </div>

          <div className="mt-4">
            <ChartCard title="Kategori Dağılımı" subtitle="Tutar bazında">
              <BarChart data={kategoriKirilimi} format="currency" />
            </ChartCard>
          </div>

          <div className="card mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="th">Ürün</th>
                  <th className="th text-right">Adet</th>
                  <th className="th text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {satirlar.map((s) => (
                  <tr key={s.ad} className="hover:bg-muted/40">
                    <td className="td text-sm">{s.ad}</td>
                    <td className="td text-right text-sm">
                      {s.adet.toLocaleString("tr-TR")}
                    </td>
                    <td className="td text-right text-sm">{formatPara(s.tutar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kutu({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{deger}</p>
    </div>
  );
}
