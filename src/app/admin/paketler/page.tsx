import { getPlatformDb } from "@/lib/platform-db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import PlanPanel from "@/components/admin/PlanPanel";
import { PAKET_MODULLERI } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Abonelik paketleri (Faz 5 / B4).
 *
 * Paket, bir kiracının kullanıcı ve firma sayısı üst sınırını ve hangi
 * modülleri göreceğini belirler. Paketi olmayan kiracıya sınır uygulanmaz —
 * paket tanımlamadan da sistem çalışır.
 */
export default async function PaketlerPage() {
  const db = await getPlatformDb();

  const planlar = await db.plan.findMany({
    orderBy: { ad: "asc" },
    include: { _count: { select: { kiracilar: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Paketler"
        subtitle={`${planlar.length} paket`}
        action={<PlanPanel />}
      />

      {planlar.length === 0 ? (
        <EmptyState
          title="Henüz paket yok"
          description="Paket, kuruluşların kullanıcı/firma limitlerini ve açık modüllerini belirler."
          action={<PlanPanel />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planlar.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{p.ad}</h3>
                  {p.aciklama && (
                    <p className="text-sm text-muted-foreground">{p.aciklama}</p>
                  )}
                </div>
                <PlanPanel
                  mevcut={{
                    id: p.id,
                    ad: p.ad,
                    aciklama: p.aciklama ?? "",
                    kullaniciLimiti: p.kullaniciLimiti,
                    firmaLimiti: p.firmaLimiti,
                    moduller: p.moduller,
                    kiraciSayisi: p._count.kiracilar,
                  }}
                />
              </div>

              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Kullanıcı
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {p.kullaniciLimiti === 0 ? "Sınırsız" : p.kullaniciLimiti}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    Firma
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {p.firmaLimiti === 0 ? "Sınırsız" : p.firmaLimiti}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-1.5">
                {PAKET_MODULLERI.map((m) => {
                  const acik = p.moduller.includes(m.deger);
                  return (
                    <span
                      key={m.deger}
                      className={
                        acik
                          ? "rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                          : "rounded-lg bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground/60 line-through ring-1 ring-inset ring-border/50"
                      }
                    >
                      {m.etiket}
                    </span>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {p._count.kiracilar} kuruluş kullanıyor
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
