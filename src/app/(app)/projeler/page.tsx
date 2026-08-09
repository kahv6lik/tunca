import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPara, formatTarih } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { PROJE_DURUM } from "@/lib/constants";
import ProjePanel from "@/components/projeler/ProjePanel";

export const dynamic = "force-dynamic";

/**
 * Projeler — Faz 16 / P1.
 *
 * Proje, satış ve destek kayıtlarını bir araya toplayan çerçevedir; bu
 * yüzden listede teklif/sipariş/destek SAYILARI görünür — projeye tıklamadan
 * "burada ne var" sorusu yanıtlanır.
 */
export default async function ProjelerPage(props: {
  searchParams: Promise<{ ara?: string; durum?: string; firma?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.projeGoruntule);
  const ekleyebilir = await yetkiVarMi(IZIN.projeOlustur);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = (PROJE_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";
  const firma = (searchParams.firma ?? "").trim();

  const where: Prisma.ProjeWhereInput = {
    AND: [
      ara ? { OR: metinArama<Prisma.ProjeWhereInput>(ara, ["kod", "ad", "firma.ad"]) } : {},
      durum ? { durum } : {},
      firma ? { firmaId: firma } : {},
    ],
  };

  const [projeler, firmalar, kullanicilar] = await Promise.all([
    db.proje.findMany({
      where,
      orderBy: [{ durum: "asc" }, { baslangic: "desc" }],
      take: 200,
      include: {
        firma: { select: { id: true, ad: true, firmaNo: true } },
        _count: { select: { teklifler: true, siparisler: true, destekler: true } },
      },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));

  return (
    <div>
      <PageHeader
        title="Projeler"
        subtitle={`${projeler.length} proje listeleniyor`}
        action={
          ekleyebilir ? (
            <ProjePanel firmalar={firmalar} kullanicilar={kullanicilar} />
          ) : undefined
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Proje kodu, adı, firma…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="planlandi">Planlandı</option>
            <option value="devam">Devam ediyor</option>
            <option value="beklemede">Beklemede</option>
            <option value="tamamlandi">Tamamlandı</option>
            <option value="iptal">İptal</option>
          </select>
        </div>
        <div className="w-56">
          <label className="label" htmlFor="firma">Firma</label>
          <select id="firma" name="firma" defaultValue={firma} className="input">
            <option value="">Tümü</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum || firma) && (
          <Link href="/projeler" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {projeler.length === 0 ? (
        <EmptyState
          title="Proje bulunamadı"
          description="Proje, bir müşterinin teklif, sipariş ve destek kayıtlarını bir arada tutar."
          action={
            ekleyebilir ? (
              <ProjePanel firmalar={firmalar} kullanicilar={kullanicilar} />
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Kod</th>
                <th className="th">Proje</th>
                <th className="th">Firma</th>
                <th className="th">Sorumlu</th>
                <th className="th">Tarih</th>
                <th className="th text-right">Bütçe</th>
                <th className="th text-center">Teklif</th>
                <th className="th text-center">Sipariş</th>
                <th className="th text-center">Destek</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {projeler.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="td font-mono text-xs">{p.kod}</td>
                  <td className="td">
                    <Link
                      href={`/projeler/${p.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {p.ad}
                    </Link>
                  </td>
                  <td className="td">
                    <Link href={`/firmalar/${p.firma.id}`} className="hover:text-primary">
                      {p.firma.ad}
                    </Link>
                  </td>
                  <td className="td">{p.sorumluId ? adOf.get(p.sorumluId) ?? "—" : "—"}</td>
                  <td className="td text-xs text-muted-foreground">
                    {p.baslangic ? formatTarih(p.baslangic) : "—"}
                    {p.bitis ? ` → ${formatTarih(p.bitis)}` : ""}
                  </td>
                  <td className="td text-right">{formatPara(p.butce, p.paraBirimi)}</td>
                  <td className="td text-center">{p._count.teklifler}</td>
                  <td className="td text-center">{p._count.siparisler}</td>
                  <td className="td text-center">{p._count.destekler}</td>
                  <td className="td"><StatusBadge durum={p.durum} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
