import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import AsamaPanel, { AsamaIslemleri } from "@/components/firsatlar/AsamaPanel";
import { formatPara } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Satış hattı aşamaları (Faz 6 / C2).
 *
 * Aşamalar kiracıya özeldir — her kuruluş kendi sürecini kurar. Hattın biçimi
 * kuruluş çapında bir karar olduğu için `firsat.asama` izni gerekir.
 */
export default async function AsamalarPage() {
  await yetkiGerektir(IZIN.asamaYonet);
  const db = await getTenantDb();

  const asamalar = await db.asama.findMany({
    orderBy: { sira: "asc" },
    include: { _count: { select: { firsatlar: true } } },
  });

  const toplamlar = await db.firsat.groupBy({
    by: ["asamaId"],
    where: { durum: "acik" },
    _sum: { tutar: true },
  });
  const tutarOf = (id: string) =>
    toplamlar.find((t) => t.asamaId === id)?._sum.tutar ?? 0;

  return (
    <div>
      <Link
        href="/firsatlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Fırsatlar
      </Link>

      <PageHeader
        title="Satış Hattı Aşamaları"
        subtitle={`${asamalar.length} aşama · soldan sağa sıralanır`}
        action={<AsamaPanel />}
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-semibold text-foreground">Aşama nedir?</h2>
        <p className="text-sm text-muted-foreground">
          Aşama, bir fırsatın satış sürecinde nerede olduğunu gösterir ve kanban&apos;daki
          sütunlara karşılık gelir. Her aşamanın <strong>varsayılan olasılığı</strong>{" "}
          vardır; beklenen ciro <em>tutar × olasılık</em> ile hesaplanır. İçinde fırsat
          olan bir aşama silinemez — önce fırsatları başka aşamaya taşıyın.
        </p>
      </div>

      {asamalar.length === 0 ? (
        <EmptyState
          title="Henüz aşama yok"
          description="Satış sürecinizin adımlarını tanımlayın: ör. Yeni → Teklif → Müzakere → Sonuç."
          action={<AsamaPanel />}
        />
      ) : (
        <div className="card divide-y divide-border/50">
          {asamalar.map((a, i) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: a.renk ?? "#6366f1" }}
                aria-hidden
              />
              <div className="min-w-[160px] flex-1">
                <p className="font-medium text-foreground">
                  <span className="mr-2 text-xs text-muted-foreground/60">{i + 1}.</span>
                  {a.ad}
                </p>
                <p className="text-xs text-muted-foreground">
                  Varsayılan olasılık %{a.olasilik} · {a._count.firsatlar} fırsat
                  {a._count.firsatlar > 0 && ` · açık ${formatPara(tutarOf(a.id))}`}
                </p>
              </div>

              <AsamaIslemleri
                asama={{
                  id: a.id,
                  ad: a.ad,
                  olasilik: a.olasilik,
                  renk: a.renk,
                  firsatSayisi: a._count.firsatlar,
                }}
                ilk={i === 0}
                son={i === asamalar.length - 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
