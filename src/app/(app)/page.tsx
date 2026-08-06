import Link from "next/link";
import { Building2, CheckSquare } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { etkinIzinler } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import PanoDuzenle from "@/components/dashboard/PanoDuzenle";
import { formatTarih } from "@/lib/format";
import { DURUM_RENK } from "@/lib/chart-theme";
import { durumBadge } from "@/lib/constants";
import { PANO_KARTLARI, etkinKartlar } from "@/lib/pano-tanimlar";

export const dynamic = "force-dynamic";

const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/**
 * Genel Bakış — Faz 10 / E3 ile kişiselleştirilebilir.
 *
 * Kartlar `src/lib/pano-tanimlar.ts` içinde tanımlıdır; kullanıcı hangi
 * kartların görüneceğini ve sırasını seçer (tercih `PanoTercihi`nde durur,
 * kayıt yoksa varsayılan düzen geçerlidir).
 *
 * Faz 4'ten beri geçerli kural korunur: izni olmayan modülün kartı çizilmez
 * ve SORGUSU HİÇ ÇALIŞTIRILMAZ. Seçilmeyen kartın sorgusu da çalışmaz —
 * kişiselleştirme aynı zamanda gereksiz sorguları da eler.
 */
export default async function DashboardPage() {
  const { db, session } = await getTenantContext();
  const izinler = await etkinIzinler();

  const tercih = await db.panoTercihi.findFirst({
    where: { kullaniciId: session.userId },
  });
  const kartlar = etkinKartlar(tercih?.kartlar ?? null, izinler);
  const secili = new Set(kartlar);

  // Düzenleme panelinin listesi: kullanıcının İZİNLİ olduğu bütün kartlar
  // (seçili olmayanlar da — açabilsin diye).
  const izinliKartlar = PANO_KARTLARI.filter((k) => izinler.has(k.izin)).map(
    (k) => k.anahtar
  );

  const now = new Date();
  const oniki = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const bugunSonu = new Date();
  bugunSonu.setHours(23, 59, 59, 999);

  // Yalnızca SEÇİLİ kartların sorguları çalışır.
  const [
    firmaSayisi,
    aktifFirma,
    yatirimAgg,
    egitimSayisi,
    hizmetSayisi,
    acikFirsatlar,
    acikGorevSayisi,
    yatirimByDurum,
    yatirimSeri,
    sonFirmalar,
    yaklasanEgitimler,
    bugunGorevler,
  ] = await Promise.all([
    secili.has("kpi-firma") ? db.firma.count() : Promise.resolve(0),
    secili.has("kpi-firma")
      ? db.firma.count({ where: { durum: "aktif" } })
      : Promise.resolve(0),
    secili.has("kpi-yatirim")
      ? db.yatirimDestegi.aggregate({
          _sum: { tutar: true },
          where: { durum: { in: ["onaylandi", "tamamlandi"] }, paraBirimi: "TRY" },
        })
      : Promise.resolve({ _sum: { tutar: 0 } }),
    secili.has("kpi-egitim") ? db.egitim.count() : Promise.resolve(0),
    secili.has("kpi-hizmet") ? db.hizmet.count() : Promise.resolve(0),
    secili.has("kpi-firsat")
      ? db.firsat.findMany({
          where: { durum: "acik" },
          select: { tutar: true, olasilik: true },
        })
      : Promise.resolve([] as { tutar: number; olasilik: number }[]),
    secili.has("kpi-gorev")
      ? db.aktivite.count({
          where: { atananId: session.userId, tamamlandi: null, sonTarih: { not: null } },
        })
      : Promise.resolve(0),
    secili.has("grafik-yatirim-durum")
      ? db.yatirimDestegi.groupBy({ by: ["durum"], _count: { _all: true } })
      : Promise.resolve([] as { durum: string; _count: { _all: number } }[]),
    secili.has("grafik-yatirim-trend")
      ? db.yatirimDestegi.findMany({
          where: { tarih: { gte: oniki }, paraBirimi: "TRY" },
          select: { tarih: true, tutar: true },
        })
      : Promise.resolve([] as { tarih: Date; tutar: number }[]),
    secili.has("liste-son-firmalar")
      ? db.firma.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, ad: true, il: true, durum: true, createdAt: true, sektor: true },
        })
      : Promise.resolve(
          [] as { id: string; ad: string; il: string | null; durum: string; createdAt: Date; sektor: string | null }[]
        ),
    secili.has("liste-yaklasan-egitimler")
      ? db.egitim.findMany({
          where: { durum: "planlandi" },
          orderBy: { tarih: "asc" },
          take: 6,
          include: { firma: { select: { ad: true } } },
        })
      : Promise.resolve(
          [] as { id: string; baslik: string; tarih: Date; firma: { ad: string } }[]
        ),
    secili.has("liste-bugun-gorevler")
      ? db.aktivite.findMany({
          where: {
            atananId: session.userId,
            tamamlandi: null,
            sonTarih: { not: null, lte: bugunSonu },
          },
          orderBy: { sonTarih: "asc" },
          take: 6,
          include: { firma: { select: { ad: true } } },
        })
      : Promise.resolve(
          [] as { id: string; baslik: string; sonTarih: Date | null; firma: { ad: string } | null }[]
        ),
  ]);

  const toplamYatirim = yatirimAgg._sum.tutar ?? 0;
  const beklenenCiro = Math.round(
    acikFirsatlar.reduce((s, f) => s + (f.tutar * f.olasilik) / 100, 0)
  );

  const seri: { label: string; value: number }[] = [];
  if (secili.has("grafik-yatirim-trend")) {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const toplam = yatirimSeri
        .filter((y) => {
          const t = new Date(y.tarih);
          return `${t.getFullYear()}-${t.getMonth()}` === key;
        })
        .reduce((s, y) => s + y.tutar, 0);
      seri.push({ label: AY_KISA[d.getMonth()], value: Math.round(toplam) });
    }
  }

  const donutData = yatirimByDurum.map((y) => ({
    label: durumBadge(y.durum).label,
    value: y._count._all,
    color: DURUM_RENK[y.durum],
  }));
  const yatirimToplamAdet = donutData.reduce((s, d) => s + d.value, 0);

  // Kartlar yerleşim grubuna göre ayrılır; grup içi sıra tercihinkidir.
  const kpiKartlari = kartlar.filter(
    (k) => PANO_KARTLARI.find((x) => x.anahtar === k)?.tur === "kpi"
  );
  const grafikKartlari = kartlar.filter(
    (k) => PANO_KARTLARI.find((x) => x.anahtar === k)?.tur === "grafik"
  );
  const listeKartlari = kartlar.filter(
    (k) => PANO_KARTLARI.find((x) => x.anahtar === k)?.tur === "liste"
  );

  const kpiOf: Record<string, React.ReactNode> = {
    "kpi-firma": (
      <KpiCard
        label="Toplam Firma"
        value={firmaSayisi}
        icon="building"
        accent="#6366f1"
        hint={`${aktifFirma} aktif firma`}
        href="/firmalar"
      />
    ),
    "kpi-yatirim": (
      <KpiCard
        label="Onaylı Yatırım (TRY)"
        value={toplamYatirim}
        prefix="₺"
        icon="wallet"
        accent="#10b981"
        hint="Onaylanan + tamamlanan"
        href="/yatirim-destekleri"
      />
    ),
    "kpi-egitim": (
      <KpiCard
        label="Eğitim"
        value={egitimSayisi}
        icon="graduation"
        accent="#f59e0b"
        hint="Toplam kayıt"
        href="/egitimler"
      />
    ),
    "kpi-hizmet": (
      <KpiCard
        label="Hizmet"
        value={hizmetSayisi}
        icon="wrench"
        accent="#0ea5e9"
        hint="Toplam kayıt"
        href="/hizmetler"
      />
    ),
    "kpi-firsat": (
      <KpiCard
        label="Açık Fırsatlar"
        value={acikFirsatlar.length}
        icon="trending"
        accent="#a855f7"
        hint={`Beklenen ciro ₺${beklenenCiro.toLocaleString("tr-TR")}`}
        href="/firsatlar"
      />
    ),
    "kpi-gorev": (
      <KpiCard
        label="Açık Görevlerim"
        value={acikGorevSayisi}
        icon="clock"
        accent="#ef4444"
        hint="Bana atanmış, tamamlanmamış"
        href="/aktiviteler"
      />
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genel Bakış"
        subtitle="Firmalara verilen destek, eğitim ve hizmetlerin canlı özeti"
        action={<PanoDuzenle izinliKartlar={izinliKartlar} secili={kartlar} />}
      />

      {kartlar.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted-foreground">
          Panonuzda görünür kart yok. Sağ üstteki <strong>Panoyu Düzenle</strong> ile
          kart seçin.
        </div>
      )}

      {/* KPI şeridi */}
      {kpiKartlari.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiKartlari.map((anahtar, i) => (
            <div key={anahtar}>{kpiOf[anahtar]}</div>
          ))}
        </div>
      )}

      {/* Grafikler */}
      {grafikKartlari.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {grafikKartlari.includes("grafik-yatirim-trend") && (
            <ChartCard
              title="Aylık Yatırım Trendi"
              subtitle="Son 12 ay · TRY"
              href="/raporlar"
              className={
                grafikKartlari.includes("grafik-yatirim-durum") ? "lg:col-span-2" : "lg:col-span-3"
              }
            >
              <AreaChart data={seri} color="#6366f1" format="currency" />
            </ChartCard>
          )}

          {grafikKartlari.includes("grafik-yatirim-durum") && (
            <ChartCard
              title="Yatırım Durumları"
              subtitle="Dağılım"
              className={
                grafikKartlari.includes("grafik-yatirim-trend") ? "" : "lg:col-span-3"
              }
            >
              {yatirimToplamAdet === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <DonutChart
                  data={donutData}
                  height={210}
                  centerValue={String(yatirimToplamAdet)}
                  centerLabel="kayıt"
                />
              )}
            </ChartCard>
          )}
        </div>
      )}

      {/* Listeler */}
      {listeKartlari.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {listeKartlari.includes("liste-son-firmalar") && (
            <ChartCard title="Son Eklenen Firmalar" href="/firmalar">
              {sonFirmalar.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Henüz firma eklenmemiş.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {sonFirmalar.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/firmalar/${f.id}`}
                            className="block truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {f.ad}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {[f.sektor, f.il].filter(Boolean).join(" · ") || "—"} ·{" "}
                            {formatTarih(f.createdAt)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge durum={f.durum} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          )}

          {listeKartlari.includes("liste-yaklasan-egitimler") && (
            <ChartCard title="Yaklaşan Eğitimler" href="/egitimler">
              {yaklasanEgitimler.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Planlanmış eğitim yok.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {yaklasanEgitimler.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {e.baslik}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{e.firma.ad}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                        {formatTarih(e.tarih)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          )}

          {listeKartlari.includes("liste-bugun-gorevler") && (
            <ChartCard title="Bugünkü Görevlerim" href="/aktiviteler">
              {bugunGorevler.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Vadesi gelmiş açık göreviniz yok. 🎉
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {bugunGorevler.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                          <CheckSquare className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {g.baslik}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {g.firma?.ad ?? "—"}
                          </p>
                        </div>
                      </div>
                      {g.sonTarih && (
                        <span className="shrink-0 rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                          {formatTarih(g.sonTarih)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}
