import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import SiparisForm from "@/components/siparisler/SiparisForm";
import { kampanyaIstemcisi, gecerliKampanyalar } from "@/lib/kampanya";

export const dynamic = "force-dynamic";

/**
 * Yeni sipariş — Faz 15 / S1, S2.
 *
 * Tekliften gelindiyse (`?teklif=`) firma ve kalemler teklifin kalemlerinden
 * hazır gelir: satış kabul edilen teklifi elle yeniden yazmak zorunda
 * kalmamalıdır (Faz 13 / H7'deki fırsat→teklif geçişiyle aynı gerekçe).
 */
export default async function YeniSiparisPage(props: {
  searchParams: Promise<{ firma?: string; teklif?: string; proje?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.siparisOlustur);

  const db = await getTenantDb();

  // Teklif kiracı katmanından okunur: querystring'den gelen id doğrulanmadan
  // forma yazılmaz.
  const teklif = searchParams.teklif
    ? await db.teklif.findFirst({
        where: { id: searchParams.teklif },
        include: { kalemler: { orderBy: { sira: "asc" } } },
      })
    : null;

  const firmaId = teklif?.firmaId ?? searchParams.firma;

  const [firmalar, urunler, kisiler, projeler] = await Promise.all([
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.urun.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: {
        id: true, kod: true, ad: true, birim: true,
        listeFiyat: true, kdvOrani: true, stokTakibi: true, stokMiktar: true,
      },
    }),
    firmaId
      ? db.kisi.findMany({
          where: { firmaId },
          orderBy: { ad: "asc" },
          select: { id: true, ad: true },
        })
      : Promise.resolve([]),
    // Proje bağı opsiyoneldir; liste boşsa seçici hiç görünmez.
    db.proje.findMany({
      where: { durum: { in: ["planlandi", "devam", "beklemede"] } },
      orderBy: { ad: "asc" },
      take: 300,
      select: { id: true, kod: true, ad: true },
    }),
  ]);

  // Firma için geçerli kampanyalar — kapsam ve tarih süzgeci saf katmanda.
  const kampanyalar = await gecerliKampanyalar(kampanyaIstemcisi(db), {
    firmaId: firmaId ?? null,
  });

  const teklifKalemleri = (teklif?.kalemler ?? []).map((k) => ({
    urunId: "",
    aciklama: k.aciklama,
    miktar: k.miktar,
    birim: k.birim,
    birimFiyat: k.birimFiyat,
    iskontoOrani: 0,
    kdvOrani: teklif?.kdvOrani ?? 20,
    kampanyaId: "",
  }));

  return (
    <div>
      <Link
        href="/siparisler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Siparişler
      </Link>

      <PageHeader
        title="Yeni Sipariş"
        subtitle={
          teklif
            ? `${teklif.no} numaralı tekliften oluşturuluyor`
            : "Kaydedildiğinde yöneticinin onayına düşer"
        }
      />

      <SiparisForm
        firmalar={firmalar}
        urunler={urunler}
        kampanyalar={kampanyalar}
        kisiler={kisiler}
        varsayilanFirmaId={firmaId}
        varsayilanTeklifId={teklif?.id}
        varsayilanKalemler={teklifKalemleri.length > 0 ? teklifKalemleri : undefined}
        varsayilanKisiId={teklif?.kisiId ?? undefined}
        varsayilanParaBirimi={teklif?.paraBirimi}
        projeler={projeler}
        varsayilanProjeId={teklif?.projeId ?? searchParams.proje}
      />
    </div>
  );
}
