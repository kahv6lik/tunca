import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import TeklifForm from "@/components/teklifler/TeklifForm";

export const dynamic = "force-dynamic";

/**
 * Yeni teklif (Faz 7 / C7).
 *
 * Teklif numarası "TKF-2026-0007" biçiminde önerilir: yıl içindeki sıradan
 * türetilir ama alan düzenlenebilir, çünkü çoğu kuruluşun kendi numaralama
 * geleneği vardır.
 */
export default async function YeniTeklifPage(
  props: {
    searchParams: Promise<{ firma?: string; firsat?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.teklifOlustur);
  const db = await getTenantDb();

  const yil = new Date().getFullYear();
  const yilBasi = new Date(yil, 0, 1);

  const [firmalar, firsatlar, kisiler, buYilSayi] = await Promise.all([
    db.firma.findMany({ orderBy: { ad: "asc" }, take: 500, select: { id: true, ad: true } }),
    db.firsat.findMany({
      where: { durum: "acik" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, baslik: true, firma: { select: { ad: true } } },
    }),
    searchParams.firma
      ? db.kisi.findMany({
          where: { firmaId: searchParams.firma },
          orderBy: { ad: "asc" },
          select: { id: true, ad: true },
        })
      : Promise.resolve([]),
    db.teklif.count({ where: { createdAt: { gte: yilBasi } } }),
  ]);

  const varsayilanNo = `TKF-${yil}-${String(buYilSayi + 1).padStart(4, "0")}`;

  return (
    <div>
      <Link
        href="/teklifler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Teklifler
      </Link>

      <PageHeader
        title="Yeni Teklif"
        subtitle="Kalemleri girin; toplamlar sunucuda hesaplanıp kaydedilir."
      />

      <TeklifForm
        firmalar={firmalar}
        firsatlar={firsatlar.map((f) => ({
          id: f.id,
          ad: `${f.baslik} — ${f.firma.ad}`,
        }))}
        kisiler={kisiler.length ? kisiler : undefined}
        varsayilanNo={varsayilanNo}
      />
    </div>
  );
}
