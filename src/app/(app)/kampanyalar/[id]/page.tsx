import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPara, formatTarih } from "@/lib/format";
import { KAMPANYA_TIP } from "@/lib/constants";
import KullanimPanel from "@/components/urunler/KullanimPanel";
import { kampanyaKullanimIptal } from "../actions";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

/**
 * Kampanya kullanım dökümü — Faz 14 / T4, T5.
 *
 * "Bu firma bu kampanyadan kaç kez faydalandı, ne kadar hakkı kaldı"
 * sorusunun ekranı. Defter satırları SİLİNMEZ; iptal edilenler üstü çizili
 * gösterilir ve kotaları iade edilmiştir.
 */
export default async function KampanyaDetayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.kampanyaGoruntule);
  const yonetir = await yetkiVarMi(IZIN.kampanyaYonet);

  const db = await getTenantDb();

  // findFirst: kiracı katmanı tenantId ekler, komşunun kampanyası 404 olur.
  const kampanya = await db.kampanya.findFirst({
    where: { id: params.id },
    include: {
      urunler: { include: { urun: { select: { kod: true, ad: true } } } },
      paketler: { include: { paket: { select: { kod: true, ad: true } } } },
      firmalar: { include: { firma: { select: { id: true, ad: true } } } },
      kullanimlar: {
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { firma: { select: { id: true, ad: true, firmaNo: true } } },
      },
    },
  });

  if (!kampanya) notFound();

  const firmalar = await db.firma.findMany({
    where: { durum: "aktif" },
    orderBy: { ad: "asc" },
    take: 500,
    select: { id: true, ad: true },
  });

  const gecerli = kampanya.kullanimlar.filter((k) => !k.iptal);
  const toplamAdet = gecerli.reduce((s, k) => s + k.adet, 0);
  const toplamIndirim = gecerli.reduce((s, k) => s + k.indirimTutari, 0);
  const kalanKota = kampanya.kota === 0 ? null : Math.max(kampanya.kota - kampanya.kullanilan, 0);

  // Firma kırılımı (T5)
  const firmaOzet = new Map<string, { ad: string; adet: number; indirim: number }>();
  for (const k of gecerli) {
    const onceki = firmaOzet.get(k.firmaId) ?? { ad: k.firma.ad, adet: 0, indirim: 0 };
    firmaOzet.set(k.firmaId, {
      ad: k.firma.ad,
      adet: onceki.adet + k.adet,
      indirim: onceki.indirim + k.indirimTutari,
    });
  }
  const kirilim = [...firmaOzet.values()].sort((a, b) => b.indirim - a.indirim);

  const tipEtiket = KAMPANYA_TIP.find((t) => t.deger === kampanya.tip)?.etiket ?? kampanya.tip;

  return (
    <div>
      <Link
        href="/kampanyalar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kampanyalar
      </Link>

      <PageHeader
        title={kampanya.ad}
        subtitle={`${kampanya.kod} · ${tipEtiket} · ${formatTarih(kampanya.baslangic)} – ${formatTarih(kampanya.bitis)}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge durum={kampanya.durum} />
            {kampanya.durum === "aktif" && (
              <KullanimPanel kampanyaId={kampanya.id} firmalar={firmalar} />
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kutu baslik="Kullanım" deger={String(toplamAdet)} alt="adet" />
        <Kutu baslik="Firma" deger={String(kirilim.length)} alt="faydalanan" />
        <Kutu baslik="Toplam İndirim" deger={formatPara(toplamIndirim)} alt="ciro etkisi" />
        <Kutu
          baslik="Kalan Kota"
          deger={kalanKota === null ? "∞" : String(kalanKota)}
          alt={kampanya.kota === 0 ? "sınırsız" : `${kampanya.kota} adetten`}
        />
      </div>

      {/* Kapsam */}
      <div className="card mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Kapsam</h3>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Ürünler</dt>
            <dd className="text-foreground">
              {kampanya.urunler.length === 0
                ? "Tüm ürünler"
                : kampanya.urunler.map((u) => u.urun.ad).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Paketler</dt>
            <dd className="text-foreground">
              {kampanya.paketler.length === 0
                ? "—"
                : kampanya.paketler.map((p) => p.paket.ad).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Firmalar</dt>
            <dd className="text-foreground">
              {kampanya.firmalar.length === 0
                ? "Tüm firmalar"
                : kampanya.firmalar.map((f) => f.firma.ad).join(", ")}
            </dd>
          </div>
        </dl>
      </div>

      {/* Firma kırılımı */}
      {kirilim.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <div className="px-5 pt-5">
            <h3 className="text-sm font-semibold text-foreground">Firma Kırılımı</h3>
          </div>
          <table className="mt-3 min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Firma</th>
                <th className="th text-right">Kullanım</th>
                <th className="th text-right">İndirim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kirilim.map((f) => (
                <tr key={f.ad} className="hover:bg-muted/40">
                  <td className="td">{f.ad}</td>
                  <td className="td text-right">{f.adet}</td>
                  <td className="td text-right">{formatPara(f.indirim)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kullanım defteri */}
      <div className="card overflow-x-auto">
        <div className="px-5 pt-5">
          <h3 className="text-sm font-semibold text-foreground">Kullanım Dökümü</h3>
        </div>
        {kampanya.kullanimlar.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Henüz kullanılmadı"
              description="Kampanya bir satışa uygulandığında kayıt burada görünür."
            />
          </div>
        ) : (
          <table className="mt-3 min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Tarih</th>
                <th className="th">Firma</th>
                <th className="th text-right">Adet</th>
                <th className="th text-right">İndirim</th>
                <th className="th">Referans</th>
                {yonetir && <th className="th text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kampanya.kullanimlar.map((k) => (
                <tr
                  key={k.id}
                  className={`hover:bg-muted/40 ${k.iptal ? "opacity-50 line-through" : ""}`}
                >
                  <td className="td">{formatTarih(k.createdAt)}</td>
                  <td className="td">
                    <Link
                      href={`/firmalar/${k.firma.id}`}
                      className="text-foreground hover:text-primary"
                    >
                      {k.firma.firmaNo ? `${k.firma.firmaNo} · ` : ""}
                      {k.firma.ad}
                    </Link>
                  </td>
                  <td className="td text-right">{k.adet}</td>
                  <td className="td text-right">{formatPara(k.indirimTutari, k.paraBirimi)}</td>
                  <td className="td text-xs text-muted-foreground">{k.referans ?? "—"}</td>
                  {yonetir && (
                    <td className="td text-right">
                      {!k.iptal && (
                        <DeleteButton
                          action={kampanyaKullanimIptal.bind(null, k.id)}
                          label="İptal"
                          confirmText="Bu kullanımı iptal edip kotayı iade etmek istiyor musunuz?"
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kutu({ baslik, deger, alt }: { baslik: string; deger: string; alt: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground">{baslik}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{deger}</p>
      <p className="text-xs text-muted-foreground/70">{alt}</p>
    </div>
  );
}
