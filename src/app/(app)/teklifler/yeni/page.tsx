import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import TeklifForm from "@/components/teklifler/TeklifForm";
import { kampanyaIstemcisi, kampanyaKatalogu } from "@/lib/kampanya";
import { paketIstemcisi, paketKatalogu } from "@/lib/paket";

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

  const [firmalar, firsatlar, buYilSayi] = await Promise.all([
    db.firma.findMany({ orderBy: { ad: "asc" }, take: 500, select: { id: true, ad: true } }),
    db.firsat.findMany({
      where: { durum: "acik" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, baslik: true, firma: { select: { ad: true } } },
    }),
    db.teklif.count({ where: { createdAt: { gte: yilBasi } } }),
  ]);

  const varsayilanNo = `TKF-${yil}-${String(buYilSayi + 1).padStart(4, "0")}`;

  /**
   * Fırsattan gelindiyse (Faz 13 / H7) firma, fırsat ve başlık önceden
   * doldurulur. Fırsat kiracı katmanından okunur — querystring'den gelen id
   * doğrulanmadan forma yazılmaz.
   */
  const kaynakFirsat = searchParams.firsat
    ? await db.firsat.findFirst({
        where: { id: searchParams.firsat },
        select: { id: true, baslik: true, firmaId: true },
      })
    : null;

  // Muhatap listesi, seçili firmaya göre gelir; fırsattan gelindiyse firma
  // artık bellidir.
  const secilenFirmaId = kaynakFirsat?.firmaId ?? searchParams.firma;
  const kisiler = secilenFirmaId
    ? await db.kisi.findMany({
        where: { firmaId: secilenFirmaId },
        orderBy: { ad: "asc" },
        select: { id: true, ad: true },
      })
    : [];


  /*
    Ürün kataloğu ve kampanya kataloğu (v1.23.0).

    Kampanyalar KAPSAMIYLA gönderilir; süzme formda satır satır yapılır —
    sunucuda bir kez süzmek yanlış olurdu, çünkü ilk çizimde firma ve ürün
    henüz seçilmemiştir. İzni olmayan modül HİÇ sorgulanmaz.
  */
  const urunGorur = await yetkiVarMi(IZIN.urunGoruntule);
  const [urunler, kampanyalar, paketler] = await Promise.all([
    urunGorur
      ? db.urun.findMany({
          where: { durum: "aktif" },
          orderBy: { ad: "asc" },
          take: 500,
          select: { id: true, kod: true, ad: true, birim: true, listeFiyat: true, kdvOrani: true },
        })
      : Promise.resolve([]),
    (await yetkiVarMi(IZIN.kampanyaGoruntule))
      ? kampanyaKatalogu(kampanyaIstemcisi(db))
      : Promise.resolve([]),
    /*
      Paket kataloğu KAPSAMIYLA verilir; süzme istemcide yapılır (v1.25.0) —
      kampanyadaki gerekçenin aynısı: seçili firma kullanıcı yazdıkça
      değişir, sunucuda bir kez süzmek firmaya özel her paketi düşürürdü.
      Paket katalogun bir türevidir, izni de katalog iznidir.
    */
    urunGorur ? paketKatalogu(paketIstemcisi(db)) : Promise.resolve([]),
  ]);

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
        urunler={urunler}
        kampanyalar={kampanyalar}
        paketler={paketler}
        varsayilanNo={varsayilanNo}
        varsayilanFirmaId={secilenFirmaId}
        varsayilanFirsatId={kaynakFirsat?.id}
        varsayilanBaslik={kaynakFirsat?.baslik}
      />
    </div>
  );
}
