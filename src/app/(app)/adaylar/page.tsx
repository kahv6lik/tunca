import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import LeadPanel, { DonusturPanel, LeadSilDugmesi } from "@/components/adaylar/LeadPanel";
import { formatTarih } from "@/lib/format";
import { LEAD_DURUM, durumBadge } from "@/lib/constants";
import DisaAktarDugmesi from "@/components/DisaAktarDugmesi";

export const dynamic = "force-dynamic";

/**
 * Adaylar / Lead listesi (Faz 7 / C5).
 *
 * Aday, henüz firma olmamış bir ilgidir. Üstteki şerit hunidir: hangi
 * aşamada kaç aday var ve kaçı işe dönüştü.
 */
export default async function AdaylarPage({
  searchParams,
}: {
  searchParams: { ara?: string; durum?: string; kaynak?: string };
}) {
  await yetkiGerektir(IZIN.leadGoruntule);

  const [ekleyebilir, duzenleyebilir, silebilir, donusturebilir, firsatGorur] =
    await Promise.all([
      yetkiVarMi(IZIN.leadOlustur),
      yetkiVarMi(IZIN.leadDuzenle),
      yetkiVarMi(IZIN.leadSil),
      yetkiVarMi(IZIN.leadDonustur),
      yetkiVarMi(IZIN.firsatGoruntule),
    ]);

  const db = await getTenantDb();

  const ara = (searchParams.ara ?? "").trim();
  const durum = LEAD_DURUM.includes(searchParams.durum as never) ? searchParams.durum : "";
  const kaynak = (searchParams.kaynak ?? "").trim();

  const where: Prisma.LeadWhereInput = {
    AND: [
      ara
        ? {
            OR: [
              { ad: { contains: ara, mode: "insensitive" as const } },
              { firmaAd: { contains: ara, mode: "insensitive" as const } },
              { email: { contains: ara, mode: "insensitive" as const } },
              { telefon: { contains: ara } },
            ],
          }
        : {},
      durum ? { durum } : {},
      kaynak ? { kaynak } : {},
    ],
  };

  const [leadler, kullanicilar, asamalar, hunidekiler, kaynaklar] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { donusenFirma: { select: { id: true, ad: true } } },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    firsatGorur
      ? db.asama.findMany({ orderBy: { sira: "asc" }, select: { id: true, ad: true } })
      : Promise.resolve([]),
    db.lead.groupBy({ by: ["durum"], _count: { _all: true } }),
    db.lead.groupBy({ by: ["kaynak"], _count: { _all: true } }),
  ]);

  const kullaniciAdi = new Map(kullanicilar.map((k) => [k.id, k.name]));
  const sayiOf = (d: string) => hunidekiler.find((h) => h.durum === d)?._count._all ?? 0;
  const toplam = hunidekiler.reduce((s, h) => s + h._count._all, 0);
  const donusen = sayiOf("donusturuldu");
  const donusumOrani = toplam > 0 ? Math.round((donusen / toplam) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Adaylar"
        subtitle={`${toplam} aday · %${donusumOrani} dönüşüm`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DisaAktarDugmesi tur="adaylar" filtreler={{ ara, durum, kaynak }} />
            {ekleyebilir && <LeadPanel kullanicilar={kullanicilar} />}
          </div>
        }
      />

      {/* Huni — hangi durumda kaç aday var */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-5">
        {LEAD_DURUM.map((d) => (
          <Link
            key={d}
            href={`/adaylar?durum=${d}`}
            className="rounded-xl px-2 py-1 transition-colors hover:bg-accent/40"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {durumBadge(d).label}
            </p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{sayiOf(d)}</p>
          </Link>
        ))}
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="ara">
            Ara
          </label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Ad, firma, e-posta veya telefon…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">
            Durum
          </label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            {LEAD_DURUM.map((d) => (
              <option key={d} value={d}>
                {durumBadge(d).label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="kaynak">
            Kaynak
          </label>
          <select id="kaynak" name="kaynak" defaultValue={kaynak} className="input">
            <option value="">Tümü</option>
            {kaynaklar
              .filter((k) => k.kaynak)
              .map((k) => (
                <option key={k.kaynak!} value={k.kaynak!}>
                  {k.kaynak} ({k._count._all})
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Filtrele
        </button>
        {(ara || durum || kaynak) && (
          <Link href="/adaylar" className="btn-secondary">
            Temizle
          </Link>
        )}
      </form>

      {leadler.length === 0 ? (
        <EmptyState
          title="Aday bulunamadı"
          description="Fuardan, web sitesinden ya da referanstan gelen ilgileri aday olarak kaydedin; nitelendiğinde tek tıkla firmaya dönüştürün."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Aday</th>
                <th className="th">Firma</th>
                <th className="th">İletişim</th>
                <th className="th">Kaynak</th>
                <th className="th">Atanan</th>
                <th className="th">Eklendi</th>
                <th className="th">Durum</th>
                <th className="th">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {leadler.map((l) => (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className="td">
                    <p className="font-medium text-foreground">{l.ad}</p>
                    {l.unvan && <p className="text-xs text-muted-foreground">{l.unvan}</p>}
                  </td>
                  <td className="td">
                    {l.donusenFirma ? (
                      <Link
                        href={`/firmalar/${l.donusenFirma.id}`}
                        className="text-primary hover:underline"
                      >
                        {l.donusenFirma.ad}
                      </Link>
                    ) : (
                      l.firmaAd ?? "—"
                    )}
                  </td>
                  <td className="td text-xs">
                    {l.email && <p>{l.email}</p>}
                    {l.telefon && <p className="text-muted-foreground">{l.telefon}</p>}
                    {!l.email && !l.telefon && "—"}
                  </td>
                  <td className="td">{l.kaynak ?? "—"}</td>
                  <td className="td">{l.atananId ? kullaniciAdi.get(l.atananId) ?? "—" : "—"}</td>
                  <td className="td text-muted-foreground">{formatTarih(l.createdAt)}</td>
                  <td className="td">
                    <StatusBadge durum={l.durum} />
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1">
                      {donusturebilir && !l.donusenFirmaId && (
                        <DonusturPanel
                          lead={{ id: l.id, ad: l.ad, firmaAd: l.firmaAd ?? "" }}
                          asamalar={asamalar}
                        />
                      )}
                      {duzenleyebilir && (
                        <LeadPanel
                          kullanicilar={kullanicilar}
                          mevcut={{
                            id: l.id,
                            ad: l.ad,
                            firmaAd: l.firmaAd ?? "",
                            unvan: l.unvan ?? "",
                            email: l.email ?? "",
                            telefon: l.telefon ?? "",
                            il: l.il ?? "",
                            sektor: l.sektor ?? "",
                            kaynak: l.kaynak ?? "",
                            durum: l.durum,
                            notlar: l.notlar ?? "",
                            atananId: l.atananId ?? "",
                          }}
                        />
                      )}
                      {silebilir && <LeadSilDugmesi id={l.id} ad={l.ad} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
