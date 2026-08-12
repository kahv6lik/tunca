import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import SiparisForm from "@/components/siparisler/SiparisForm";
import { kampanyaIstemcisi, kampanyaKatalogu } from "@/lib/kampanya";
import { paketIstemcisi, paketKatalogu } from "@/lib/paket";

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
  /*
    Kampanya KATALOĞU (kapsamıyla birlikte) istemciye verilir; süzme orada
    satır satır yapılır. Sunucuda bir kez süzülmüş liste yanlıştı: ilk
    çizimde firma ve ürün henüz boş olduğu için firma ya da ürün kapsamlı
    hiçbir kampanya listeye giremiyordu.
  */
  const kampanyalar = await kampanyaKatalogu(kampanyaIstemcisi(db));

  /*
    Paket kataloğu da KAPSAMIYLA verilir (v1.25.0) ve süzme istemcide
    yapılır — kampanyadaki gerekçenin aynısı: seçili firma kullanıcı
    yazdıkça değişir, sunucuda bir kez süzmek firmaya özel her paketi
    listeden düşürürdü.
  */
  const paketler = await paketKatalogu(paketIstemcisi(db));

  /*
    Tekliften siparişe geçişte ÜRÜN ve KAMPANYA da taşınır (v1.23.0).
    Eskiden boş geçiliyordu: müşteriye kampanyalı bir teklif verilip sipariş
    aşamasında indirim kayboluyordu — zincirin (Faz 20 / U4) anlamı buydu.
  */
  const teklifKalemleri = (teklif?.kalemler ?? []).map((k) => ({
    urunId: k.urunId ?? "",
    // Paket damgası tekliften siparişe TAŞINIR: taşınmasaydı paketli bir
    // teklif siparişe dönerken "bu fiyat nereden geldi" bilgisi kaybolurdu
    // (v1.23.0'da kampanya için verilen kararın aynısı).
    paketId: k.paketId ?? "",
    aciklama: k.aciklama,
    miktar: k.miktar,
    birim: k.birim,
    birimFiyat: k.birimFiyat,
    iskontoOrani: 0,
    kdvOrani: teklif?.kdvOrani ?? 20,
    kampanyaId: k.kampanyaId ?? "",
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
        paketler={paketler}
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
