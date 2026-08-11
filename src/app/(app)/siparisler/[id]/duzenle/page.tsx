import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import SiparisForm from "@/components/siparisler/SiparisForm";
import { kampanyaIstemcisi, kampanyaKatalogu } from "@/lib/kampanya";

export const dynamic = "force-dynamic";

/**
 * Sipariş düzenleme — Faz 15 / S1.
 *
 * ONAYLANMIŞ sipariş düzenlenemez: onaylanan rakam, stok ve kota düşümünün
 * dayandığı rakamdır. Bu sayfa da action da aynı kuralı uygular.
 */
export default async function SiparisDuzenlePage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.siparisDuzenle);

  const db = await getTenantDb();
  const siparis = await db.siparis.findFirst({
    where: { id: params.id },
    include: { kalemler: { orderBy: { sira: "asc" } } },
  });

  if (!siparis) notFound();

  if (siparis.durum === "onaylandi" || siparis.durum === "iptal") {
    return (
      <div>
        <Link
          href={`/siparisler/${siparis.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Siparişe dön
        </Link>
        <PageHeader title={siparis.no} subtitle="Bu sipariş düzenlenemez" />
        <div className="card p-6 text-sm text-muted-foreground">
          {siparis.durum === "onaylandi"
            ? "Onaylanmış sipariş düzenlenemez — onaylanan rakam, stok ve kota düşümünün dayandığı rakamdır. Değişiklik için siparişi iptal edip yenisini oluşturun."
            : "İptal edilmiş sipariş düzenlenemez."}
        </div>
      </div>
    );
  }

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
    db.kisi.findMany({
      where: { firmaId: siparis.firmaId },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
    db.proje.findMany({
      where: { durum: { in: ["planlandi", "devam", "beklemede"] } },
      orderBy: { ad: "asc" },
      take: 300,
      select: { id: true, kod: true, ad: true },
    }),
  ]);

  /*
    Kampanya KATALOĞU (kapsamıyla birlikte) istemciye verilir; süzme orada
    satır satır yapılır. Sunucuda bir kez süzülmüş liste yanlıştı: ilk
    çizimde firma ve ürün henüz boş olduğu için firma ya da ürün kapsamlı
    hiçbir kampanya listeye giremiyordu.
  */
  const kampanyalar = await kampanyaKatalogu(kampanyaIstemcisi(db));

  return (
    <div>
      <Link
        href={`/siparisler/${siparis.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Siparişe dön
      </Link>

      <PageHeader
        title={`${siparis.no} — Düzenle`}
        subtitle="Kaydedildiğinde sipariş yeniden onaya düşer"
      />

      <SiparisForm
        firmalar={firmalar}
        urunler={urunler}
        kampanyalar={kampanyalar}
        kisiler={kisiler}
        projeler={projeler}
        mevcut={{
          id: siparis.id,
          firmaId: siparis.firmaId,
          kisiId: siparis.kisiId ?? "",
          projeId: siparis.projeId ?? "",
          paraBirimi: siparis.paraBirimi,
          notlar: siparis.notlar ?? "",
          kalemler: siparis.kalemler.map((k) => ({
            urunId: k.urunId ?? "",
            aciklama: k.aciklama,
            miktar: k.miktar,
            birim: k.birim,
            birimFiyat: k.birimFiyat,
            iskontoOrani: k.iskontoOrani,
            kdvOrani: k.kdvOrani,
            kampanyaId: k.kampanyaId ?? "",
          })),
        }}
      />
    </div>
  );
}
