import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Settings2, LayoutGrid, List } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Kanban, { HatOzeti } from "@/components/firsatlar/Kanban";
import FirsatPanel from "@/components/firsatlar/FirsatPanel";
import { alanlariGetir } from "@/lib/ozel-alan";
import { formatPara, formatTarih } from "@/lib/format";
import { FIRSAT_DURUM } from "@/lib/constants";
import { durumBadge } from "@/lib/constants";
import DisaAktarDugmesi from "@/components/DisaAktarDugmesi";
import GorunumBar from "@/components/GorunumBar";
import { gorunumleriGetir, varsayilanaYonlendir } from "@/lib/gorunum";
import { metinArama } from "@/lib/arama";

export const dynamic = "force-dynamic";

/**
 * Satış hattı (Faz 6 / C2, C3).
 *
 * İki görünüm: kanban (varsayılan) ve liste. Kanban yalnızca AÇIK fırsatları
 * gösterir — kapanmış işler hattı tıkamasın diye; kapananlar liste
 * görünümünde durum filtresiyle görülür.
 */
export default async function FirsatlarPage(
  props: {
    searchParams: Promise<{ gorunum?: string; ara?: string; durum?: string; sorumlu?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.firsatGoruntule);

  await varsayilanaYonlendir("firsatlar", searchParams);
  const gorunumler = await gorunumleriGetir("firsatlar");

  const [ekleyebilir, duzenleyebilir, asamaYonetir] = await Promise.all([
    yetkiVarMi(IZIN.firsatOlustur),
    yetkiVarMi(IZIN.firsatDuzenle),
    yetkiVarMi(IZIN.asamaYonet),
  ]);

  const db = await getTenantDb();

  const liste = searchParams.gorunum === "liste";
  const ara = (searchParams.ara ?? "").trim();
  const durum = FIRSAT_DURUM.includes(searchParams.durum as never)
    ? searchParams.durum
    : "";
  const sorumlu = (searchParams.sorumlu ?? "").trim();

  const filtre: Prisma.FirsatWhereInput = {
    AND: [
      ara
        ? {
            OR: metinArama<Prisma.FirsatWhereInput>(ara, ["baslik", "firma.ad"]),
          }
        : {},
      sorumlu ? { sorumluId: sorumlu } : {},
      // Kanban görünümünde durum filtresi yerine "yalnızca açık" kuralı geçerli.
      liste ? (durum ? { durum } : {}) : { durum: "acik" },
    ],
  };

  const [asamalar, firsatlar, kullanicilar, firmalar, ozet] = await Promise.all([
    db.asama.findMany({ orderBy: { sira: "asc" } }),
    db.firsat.findMany({
      where: filtre,
      orderBy: [{ kapanisTarihi: "asc" }, { createdAt: "desc" }],
      take: liste ? 200 : 500,
      include: {
        firma: { select: { id: true, ad: true } },
        kisi: { select: { id: true, ad: true } },
        asama: { select: { id: true, ad: true, renk: true } },
      },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.firma.findMany({
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.firsat.groupBy({ by: ["durum"], _sum: { tutar: true }, _count: { _all: true } }),
  ]);

  const sorumluAdi = new Map(kullanicilar.map((k) => [k.id, k.name]));

  const acik = firsatlar.filter((f) => f.durum === "acik");
  const toplamOf = (d: string) => ozet.find((o) => o.durum === d)?._sum.tutar ?? 0;

  const acikToplam = acik.reduce((s, f) => s + f.tutar, 0);
  const beklenen = acik.reduce((s, f) => s + (f.tutar * f.olasilik) / 100, 0);

  const gorunumQs = (g: string) => {
    const qs = new URLSearchParams();
    if (g) qs.set("gorunum", g);
    if (ara) qs.set("ara", ara);
    if (sorumlu) qs.set("sorumlu", sorumlu);
    if (durum) qs.set("durum", durum);
    return `/firsatlar?${qs.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Fırsatlar"
        subtitle={`${ozet.reduce((s, o) => s + o._count._all, 0)} fırsat · ${asamalar.length} aşama`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-border/70">
              <Link
                href={gorunumQs("")}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
                  liste ? "text-muted-foreground hover:text-foreground" : "bg-secondary/70 text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" /> Kanban
              </Link>
              <Link
                href={gorunumQs("liste")}
                className={`flex items-center gap-1.5 border-l border-border/70 px-3 py-2 text-sm ${
                  liste ? "bg-secondary/70 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" /> Liste
              </Link>
            </div>

            <GorunumBar
              liste="firsatlar"
              gorunumler={gorunumler}
              filtreler={{
                gorunum: liste ? "liste" : undefined,
                ara,
                durum: durum || undefined,
                sorumlu,
              }}
            />
            <DisaAktarDugmesi
              tur="firsatlar"
              filtreler={{ ara, durum: durum || undefined, sorumlu }}
            />

            {asamaYonetir && (
              <Link href="/firsatlar/asamalar" className="btn-secondary">
                <Settings2 className="h-4 w-4" /> Aşamalar
              </Link>
            )}

            {ekleyebilir && asamalar.length > 0 && (
              <FirsatPanel
                asamalar={asamalar.map((a) => ({ id: a.id, ad: a.ad, olasilik: a.olasilik }))}
                firmalar={firmalar}
                kullanicilar={kullanicilar}
                ozelAlanlar={await alanlariGetir("firsat")}
              />
            )}
          </div>
        }
      />

      {asamalar.length === 0 ? (
        <EmptyState
          title="Satış hattı kurulmamış"
          description="Fırsat ekleyebilmek için önce en az bir aşama tanımlayın."
          action={
            asamaYonetir ? (
              <Link href="/firsatlar/asamalar" className="btn-primary">
                Aşamaları Tanımla
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <HatOzeti
            acikSayi={acik.length}
            acikToplam={acikToplam}
            beklenen={beklenen}
            kazanilan={toplamOf("kazanildi")}
            kaybedilen={toplamOf("kaybedildi")}
          />

          <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
            {liste && <input type="hidden" name="gorunum" value="liste" />}
            <div className="min-w-[200px] flex-1">
              <label className="label" htmlFor="ara">
                Ara
              </label>
              <input
                id="ara"
                name="ara"
                defaultValue={ara}
                placeholder="Fırsat başlığı veya firma…"
                className="input"
              />
            </div>
            <div className="w-52">
              <label className="label" htmlFor="sorumlu">
                Sorumlu
              </label>
              <select id="sorumlu" name="sorumlu" defaultValue={sorumlu} className="input">
                <option value="">Herkes</option>
                {kullanicilar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            {liste && (
              <div className="w-44">
                <label className="label" htmlFor="durum">
                  Durum
                </label>
                <select id="durum" name="durum" defaultValue={durum} className="input">
                  <option value="">Tümü</option>
                  {FIRSAT_DURUM.map((d) => (
                    <option key={d} value={d}>
                      {durumBadge(d).label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="btn-primary">
              Filtrele
            </button>
            {(ara || sorumlu || durum) && (
              <Link href={gorunumQs(liste ? "liste" : "")} className="btn-secondary">
                Temizle
              </Link>
            )}
          </form>

          {liste ? (
            firsatlar.length === 0 ? (
              <EmptyState title="Fırsat bulunamadı" description="Filtreleri değiştirin." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="min-w-full divide-y divide-border/60">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="th">Fırsat</th>
                      <th className="th">Firma</th>
                      <th className="th">Kişi</th>
                      <th className="th">Aşama</th>
                      <th className="th">Tutar</th>
                      <th className="th">Olasılık</th>
                      <th className="th">Kapanış</th>
                      <th className="th">Sorumlu</th>
                      <th className="th">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {firsatlar.map((f) => (
                      <tr key={f.id} className="hover:bg-muted/40">
                        <td className="td font-medium">{f.baslik}</td>
                        <td className="td">
                          <Link
                            href={`/firmalar/${f.firma.id}`}
                            className="text-foreground hover:text-primary"
                          >
                            {f.firma.ad}
                          </Link>
                        </td>
                        <td className="td">{f.kisi?.ad ?? "—"}</td>
                        <td className="td">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: f.asama.renk ?? "#6366f1" }}
                              aria-hidden
                            />
                            {f.asama.ad}
                          </span>
                        </td>
                        <td className="td">{formatPara(f.tutar, f.paraBirimi)}</td>
                        <td className="td">%{f.olasilik}</td>
                        <td className="td">
                          {f.kapanisTarihi ? formatTarih(f.kapanisTarihi) : "—"}
                        </td>
                        <td className="td">
                          {f.sorumluId ? sorumluAdi.get(f.sorumluId) ?? "—" : "—"}
                        </td>
                        <td className="td">
                          <StatusBadge durum={f.durum} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /**
             * Kanban, sayfanın yatay dolgusunu da kullanarak TAM genişliğe
             * yayılır (negatif margin + eş dolgu). Beş sütunlu varsayılan hat
             * 13" ekrana kaydırmasız sığar; daha çok aşamada yatay kaydırma
             * kanbanın kendi içindedir, sayfa genişlemez.
             */
            <div className="-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            <Kanban
              duzenleyebilir={duzenleyebilir}
              asamalar={asamalar.map((a) => ({ id: a.id, ad: a.ad, renk: a.renk }))}
              firsatlar={firsatlar.map((f) => ({
                id: f.id,
                asamaId: f.asamaId,
                baslik: f.baslik,
                tutar: f.tutar,
                paraBirimi: f.paraBirimi,
                olasilik: f.olasilik,
                kapanisTarihi: f.kapanisTarihi?.toISOString() ?? null,
                firmaAd: f.firma.ad,
                firmaId: f.firma.id,
                kisiAd: f.kisi?.ad ?? null,
                sorumluAd: f.sorumluId ? sorumluAdi.get(f.sorumluId) ?? null : null,
              }))}
            />
            </div>
          )}
        </>
      )}
    </div>
  );
}
