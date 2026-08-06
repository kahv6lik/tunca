import Link from "next/link";
import { getPlatformDb } from "@/lib/platform-db";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/ui/badge";
import { formatTarih } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Platform genel durumu (Faz 5 / B6).
 *
 * Buradaki sayılar kiracılar ÖTESİdir — platform sahibinin bakışı. Kiracı
 * arayüzünde böyle bir toplam asla gösterilmez.
 */
export default async function AdminGenelPage() {
  const db = await getPlatformDb();

  const [kiracilar, kullaniciSayisi, firmaSayisi, planlar, sonKiracilar] =
    await Promise.all([
      db.tenant.groupBy({ by: ["durum"], _count: { _all: true } }),
      db.user.count(),
      db.firma.count(),
      db.plan.findMany({
        orderBy: { ad: "asc" },
        include: { _count: { select: { kiracilar: true } } },
      }),
      db.tenant.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          plan: { select: { ad: true } },
          _count: { select: { kullanicilar: true, firmalar: true } },
        },
      }),
    ]);

  const sayi = (durum: string) =>
    kiracilar.find((k) => k.durum === durum)?._count._all ?? 0;

  const toplamKiraci = kiracilar.reduce((t, k) => t + k._count._all, 0);
  const plansiz = sonKiracilar.length; // yalnızca liste için

  return (
    <div>
      <PageHeader
        title="Platform Genel Durumu"
        subtitle={`${toplamKiraci} kuruluş · ${kullaniciSayisi} kullanıcı · ${firmaSayisi} firma`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Aktif Kuruluş"
          value={sayi("aktif")}
          icon="building"
          accent="#10b981"
          href="/admin/kiracilar"
          index={0}
        />
        <KpiCard
          label="Askıda / Pasif"
          value={sayi("askida") + sayi("pasif")}
          icon="clock"
          accent="#f59e0b"
          href="/admin/kiracilar"
          index={1}
        />
        <KpiCard
          label="Toplam Kullanıcı"
          value={kullaniciSayisi}
          icon="users"
          accent="#6366f1"
          index={2}
        />
        <KpiCard
          label="Toplam Firma"
          value={firmaSayisi}
          icon="trending"
          accent="#a855f7"
          index={3}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/60 p-5">
            <h2 className="font-semibold text-foreground">Son eklenen kuruluşlar</h2>
            <Link href="/admin/kiracilar" className="text-sm text-primary hover:underline">
              Tümü
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/60">
                <tr>
                  <th className="th">Kuruluş</th>
                  <th className="th">Paket</th>
                  <th className="th">Kullanıcı</th>
                  <th className="th">Firma</th>
                  <th className="th">Durum</th>
                  <th className="th">Eklendi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sonKiracilar.map((k) => (
                  <tr key={k.id} className="transition-colors hover:bg-accent/40">
                    <td className="td">
                      <Link
                        href={`/admin/kiracilar/${k.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {k.ad}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{k.slug}</span>
                    </td>
                    <td className="td text-muted-foreground">{k.plan?.ad ?? "—"}</td>
                    <td className="td">{k._count.kullanicilar}</td>
                    <td className="td">{k._count.firmalar}</td>
                    <td className="td">
                      <StatusBadge durum={k.durum} />
                    </td>
                    <td className="td text-muted-foreground">{formatTarih(k.createdAt)}</td>
                  </tr>
                ))}
                {plansiz === 0 && (
                  <tr>
                    <td className="td text-muted-foreground" colSpan={6}>
                      Henüz kuruluş eklenmedi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Paket dağılımı</h2>
            <Link href="/admin/paketler" className="text-sm text-primary hover:underline">
              Yönet
            </Link>
          </div>
          {planlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz paket tanımlı değil. Paketler kullanıcı ve firma limitlerini belirler.
            </p>
          ) : (
            <ul className="space-y-3">
              {planlar.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.ad}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.kullaniciLimiti === 0 ? "Sınırsız" : `${p.kullaniciLimiti}`} kullanıcı ·{" "}
                      {p.firmaLimiti === 0 ? "Sınırsız" : `${p.firmaLimiti}`} firma
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {p._count.kiracilar} kuruluş
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
