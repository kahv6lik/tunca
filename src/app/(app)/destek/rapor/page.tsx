import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import RaporBasligi from "@/components/raporlar/RaporBasligi";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { DESTEK_KANAL, DESTEK_ONCELIK } from "@/lib/constants";
import { destekOzeti, sureMetni, cozumSuresiSaat } from "@/lib/destek-tanimlar";
import { tarihAraligi, araliktanEtiket, hazirAraliklar } from "@/lib/tarih-araligi";

export const dynamic = "force-dynamic";

const KANAL_ETIKET = new Map<string, string>(DESTEK_KANAL.map((k) => [k.deger, k.etiket]));
const ONCELIK_ETIKET = new Map<string, string>(
  DESTEK_ONCELIK.map((o) => [o.deger, o.etiket])
);

/**
 * Destek raporu — Faz 16 / P3.
 *
 * Hesap SAF fonksiyondadır (`destekOzeti`): testler veritabanı olmadan aynı
 * mantığı sınar. Ekran yalnızca satırları çeker ve sonucu çizer.
 *
 * Süzgeç kaydın AÇILIŞ tarihine bakar; "ağustosta kaç talep geldi" sorusu
 * budur, kaydın ne zaman çözüldüğü değil.
 */
export default async function DestekRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.destekGoruntule);

  const db = await getTenantDb();
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const aralikEtiketi = araliktanEtiket(aralik);
  const firma = (searchParams.firma ?? "").trim();

  const [kayitlar, kullanicilar, firmalar] = await Promise.all([
    db.destekKaydi.findMany({
      where: {
        AND: [aralik ? { createdAt: aralik } : {}, firma ? { firmaId: firma } : {}],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        no: true,
        baslik: true,
        kanal: true,
        oncelik: true,
        durum: true,
        atananId: true,
        createdAt: true,
        cozumTarihi: true,
        firma: { select: { ad: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
  ]);

  const ozet = destekOzeti(kayitlar);
  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));

  // En uzun bekleyen açık kayıtlar: rapor "neyi kaçırıyoruz" sorusunu da
  // yanıtlamalı, yalnızca geçmişi özetlememeli.
  const bekleyenler = kayitlar
    .filter((k) => k.cozumTarihi === null && k.durum !== "kapandi")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 10);

  const simdi = Date.now();
  const firmaAdi = firma ? firmalar.find((f) => f.id === firma)?.ad ?? null : null;

  return (
    <div>
      <Link
        href="/destek"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Destek Kayıtları
      </Link>

      <RaporBasligi
        baslik="Destek Raporu"
        donem={[firmaAdi, aralikEtiketi].filter(Boolean).join(" · ") || null}
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input
            id="bas"
            name="bas"
            type="date"
            defaultValue={searchParams.bas ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input
            id="bit"
            name="bit"
            type="date"
            defaultValue={searchParams.bit ?? ""}
            className="input"
          />
        </div>
        <div className="w-52">
          <label className="label" htmlFor="firma">Firma</label>
          <select id="firma" name="firma" defaultValue={firma} className="input">
            <option value="">Tüm firmalar</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Uygula</button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => {
            const secili = searchParams.bas === h.bas && searchParams.bit === h.bit;
            return (
              <Link
                key={h.anahtar}
                href={`/destek/rapor?bas=${h.bas}&bit=${h.bit}${
                  firma ? `&firma=${firma}` : ""
                }`}
                className={`rounded-lg border px-2 py-1 transition-colors ${
                  secili
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.etiket}
              </Link>
            );
          })}
        </div>
        {(searchParams.bas || searchParams.bit || firma) && (
          <Link href="/destek/rapor" className="btn-secondary">Temizle</Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Toplam Kayıt" value={ozet.toplam} icon="chart" accent="#6366f1" />
        <KpiCard index={1} label="Açık Kayıt" value={ozet.acik} icon="clock" accent="#f59e0b" />
        <KpiCard index={2} label="Çözülen" value={ozet.cozulen} icon="trending" accent="#10b981" />
        <KpiCard
          index={3}
          label="Ort. Çözüm Süresi"
          value={ozet.ortalamaCozumSaat ?? 0}
          suffix=" saat"
          icon="clock"
          accent="#0ea5e9"
          hint={
            ozet.ortalamaCozumSaat === null
              ? "Henüz çözülen kayıt yok"
              : sureMetni(ozet.ortalamaCozumSaat)
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Geliş Kanalı" subtitle="Talepler hangi kanaldan geliyor">
          <DonutChart
            data={ozet.kanalDagilimi.map((k) => ({
              label: KANAL_ETIKET.get(k.kanal) ?? k.kanal,
              value: k.adet,
            }))}
          />
        </ChartCard>

        <ChartCard title="Öncelik Dağılımı" subtitle="Kritikten düşüğe">
          <BarChart
            data={ozet.oncelikDagilimi.map((o) => ({
              label: ONCELIK_ETIKET.get(o.oncelik) ?? o.oncelik,
              value: o.adet,
            }))}
            horizontal
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-1 font-semibold tracking-tight text-foreground">Kişi Yükü</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Yalnızca AÇIK kayıtlar sayılır — kapanmış iş kimsenin üzerinde yük değildir.
          </p>
          {ozet.kisiYuku.length === 0 ? (
            <p className="text-sm text-muted-foreground">Açık kayıt yok.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {ozet.kisiYuku.map((k) => (
                <li
                  key={k.kullaniciId ?? "yok"}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className={k.kullaniciId ? "text-foreground" : "text-muted-foreground"}>
                    {k.kullaniciId ? adOf.get(k.kullaniciId) ?? "—" : "Atanmamış"}
                  </span>
                  <span className="font-medium text-foreground">{k.adet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-1 font-semibold tracking-tight text-foreground">
            En Uzun Bekleyen Açık Kayıtlar
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Çözüm damgası atılmamış kayıtlar, en eskisi başta.
          </p>
          {bekleyenler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bekleyen kayıt yok.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {bekleyenler.map((k) => {
                const gecen = cozumSuresiSaat({
                  createdAt: k.createdAt,
                  cozumTarihi: new Date(simdi),
                });
                return (
                  <li key={k.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/destek/${k.id}`}
                        className="font-mono text-xs text-foreground hover:text-primary"
                      >
                        {k.no}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {k.firma.ad} — {k.baslik}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-amber-400">
                      {sureMetni(gecen)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
