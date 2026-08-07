import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import OzelAlanPanel, { OzelAlanIslemleri } from "@/components/ozel-alanlar/OzelAlanPanel";
import {
  OZEL_ALAN_VARLIKLARI,
  VARLIK_ETIKET,
  TIP_ETIKET,
  type OzelAlanTipi,
} from "@/lib/ozel-alan-tanimlar";

export const dynamic = "force-dynamic";

/**
 * Özel alan tanımları (Faz 11 / E6) — kuruluş yöneticisine özel.
 *
 * Alanlar kiracıya özeldir: her kuruluş kendi formunu kendi ihtiyacına göre
 * genişletir. Değerler ilgili kaydın formunda girilir; bu ekran yalnızca
 * TANIM yönetir.
 */
export default async function OzelAlanlarPage() {
  await yetkiGerektir(IZIN.ozelAlanYonet);
  const db = await getTenantDb();

  const alanlar = await db.ozelAlan.findMany({
    orderBy: [{ varlik: "asc" }, { sira: "asc" }],
    include: { _count: { select: { degerler: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Özel Alanlar"
        subtitle={`${alanlar.length} alan tanımlı`}
        action={<OzelAlanPanel />}
      />

      <div className="card mb-6 p-5 text-sm text-muted-foreground">
        <p>
          Özel alan, firma / kişi / fırsat formlarına kuruluşunuza özgü bir giriş ekler
          (ör. &quot;Müşteri No&quot;, &quot;Sözleşme Bitişi&quot;, &quot;Segment&quot;).
          Tanımladığınız alan ilgili formda kendiliğinden görünür, firma detayında
          listelenir ve dışa aktarıma sütun olarak eklenir.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">Silmek geri alınamaz:</strong> alanla
          birlikte bütün kayıtlardaki değerleri de silinir. Seçim tipli firma alanları
          firma listesinde filtre olarak da sunulur.
        </p>
      </div>

      {alanlar.length === 0 ? (
        <EmptyState
          title="Henüz özel alan yok"
          description="İlk alanınızı tanımlayın; ilgili formda kendiliğinden görünecek."
          action={<OzelAlanPanel />}
        />
      ) : (
        OZEL_ALAN_VARLIKLARI.map((varlik) => {
          const grup = alanlar.filter((a) => a.varlik === varlik);
          if (grup.length === 0) return null;
          return (
            <section key={varlik} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {VARLIK_ETIKET[varlik]} alanları
              </h2>
              <div className="card divide-y divide-border/50">
                {grup.map((a, i) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-medium text-foreground">
                        {a.ad}
                        {a.zorunlu && <span className="ml-1 text-rose-400">*</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TIP_ETIKET[a.tip as OzelAlanTipi] ?? a.tip}
                        {a.tip === "secim" && ` · ${a.secenekler.length} seçenek`}
                        {` · ${a._count.degerler} kayıtta dolu`}
                      </p>
                    </div>

                    <OzelAlanIslemleri
                      alan={{
                        id: a.id,
                        varlik: a.varlik,
                        ad: a.ad,
                        tip: a.tip,
                        secenekler: a.secenekler,
                        zorunlu: a.zorunlu,
                        degerSayisi: a._count.degerler,
                      }}
                      ilk={i === 0}
                      son={i === grup.length - 1}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
