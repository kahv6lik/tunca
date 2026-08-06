import Link from "next/link";
import { Settings2 } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BildirimSatiri, TopluIslemler } from "@/components/bildirimler/BildirimListesi";

export const dynamic = "force-dynamic";

/**
 * Bildirim merkezi (Faz 8 / D5).
 *
 * Bildirimler kişiseldir — ayrı bir izin anahtarı yoktur; sorgu oturumdaki
 * kullanıcıyla sınırlanır. Bu sayfa paket kısıtına da tabi değildir: hangi
 * modüller açık olursa olsun kullanıcı kendi bildirimini görebilmelidir.
 */
export default async function BildirimlerPage({
  searchParams,
}: {
  searchParams: { filtre?: string };
}) {
  const { db, session } = await getTenantContext();

  const yalnizOkunmamis = searchParams.filtre === "okunmamis";

  const [bildirimler, okunmamisSayi] = await Promise.all([
    db.bildirim.findMany({
      where: {
        kullaniciId: session.userId,
        ...(yalnizOkunmamis ? { okundu: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.bildirim.count({ where: { kullaniciId: session.userId, okundu: null } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Bildirimler"
        subtitle={okunmamisSayi > 0 ? `${okunmamisSayi} okunmamış` : "Hepsi okundu"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/bildirimler/tercihler" className="btn-secondary">
              <Settings2 className="h-4 w-4" /> Tercihler
            </Link>
            <TopluIslemler okunmamis={okunmamisSayi} />
          </div>
        }
      />

      <div className="mb-4 flex overflow-hidden rounded-xl border border-border/70">
        <Link
          href="/bildirimler"
          className={`px-3 py-2 text-sm ${
            yalnizOkunmamis
              ? "text-muted-foreground hover:text-foreground"
              : "bg-secondary/70 text-foreground"
          }`}
        >
          Tümü
        </Link>
        <Link
          href="/bildirimler?filtre=okunmamis"
          className={`border-l border-border/70 px-3 py-2 text-sm ${
            yalnizOkunmamis
              ? "bg-secondary/70 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Okunmamış ({okunmamisSayi})
        </Link>
      </div>

      {bildirimler.length === 0 ? (
        <EmptyState
          title={yalnizOkunmamis ? "Okunmamış bildirim yok" : "Bildirim yok"}
          description="Size görev atandığında, fırsatınız aşama değiştirdiğinde ya da bir iş akışı kuralı çalıştığında burada görürsünüz."
        />
      ) : (
        <div className="card divide-y divide-border/50">
          {bildirimler.map((b) => (
            <BildirimSatiri
              key={b.id}
              b={{
                id: b.id,
                tur: b.tur,
                baslik: b.baslik,
                mesaj: b.mesaj,
                link: b.link,
                okundu: b.okundu?.toISOString() ?? null,
                createdAt: b.createdAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
