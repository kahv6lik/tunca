import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import DisaAktarDugmesi from "@/components/DisaAktarDugmesi";
import GorunumBar from "@/components/GorunumBar";
import { gorunumleriGetir, varsayilanaYonlendir } from "@/lib/gorunum";

export const dynamic = "force-dynamic";

const SAYFA_BOYUTU = 20;

type SearchParams = {
  ara?: string;
  durum?: string;
  il?: string;
  sayfa?: string;
};

export default async function FirmalarPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.firmaGoruntule);
  await varsayilanaYonlendir("firmalar", searchParams);
  const ekleyebilir = await yetkiVarMi(IZIN.firmaOlustur);
  const gorunumler = await gorunumleriGetir("firmalar");
  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = searchParams.durum ?? "";
  const il = (searchParams.il ?? "").trim();
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.FirmaWhereInput = {
    AND: [
      ara
        ? {
            OR: [
              { ad: { contains: ara } },
              { vergiNo: { contains: ara } },
              { yetkiliAd: { contains: ara } },
              { sektor: { contains: ara } },
            ],
          }
        : {},
      durum ? { durum } : {},
      il ? { il: { contains: il } } : {},
    ],
  };

  const [toplam, firmalar, iller] = await Promise.all([
    db.firma.count({ where }),
    db.firma.findMany({
      where,
      orderBy: { ad: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: {
        _count: { select: { yatirimlar: true, egitimler: true, hizmetler: true } },
      },
    }),
    db.firma.findMany({
      where: { il: { not: null } },
      distinct: ["il"],
      select: { il: true },
      orderBy: { il: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));

  // Sayfalama linki için mevcut filtreleri koru
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  if (durum) qs.set("durum", durum);
  if (il) qs.set("il", il);
  const baseUrl = `/firmalar?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader
        title="Firmalar"
        subtitle={`${toplam} firma listeleniyor`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <GorunumBar liste="firmalar" gorunumler={gorunumler} filtreler={{ ara, durum, il }} />
            <DisaAktarDugmesi tur="firmalar" filtreler={{ ara, durum, il }} />
            {ekleyebilir && (
            <Link href="/firmalar/yeni" className="btn-primary">
              + Yeni Firma
            </Link>
            )}
          </div>
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Firma adı, vergi no, yetkili…"
            className="input"
          />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="il">İl</label>
          <select id="il" name="il" defaultValue={il} className="input">
            <option value="">Tümü</option>
            {iller
              .map((r) => r.il)
              .filter((x): x is string => !!x)
              .map((ilAdi) => (
                <option key={ilAdi} value={ilAdi}>
                  {ilAdi}
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum || il) && (
          <Link href="/firmalar" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {firmalar.length === 0 ? (
        <EmptyState
          title="Firma bulunamadı"
          description="Arama kriterlerinizi değiştirin veya yeni firma ekleyin."
          action={
            ekleyebilir ? (
              <Link href="/firmalar/yeni" className="btn-primary">
                + Yeni Firma
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Firma</th>
                <th className="th">Sektör</th>
                <th className="th">İl</th>
                <th className="th">Yetkili</th>
                <th className="th text-center">Yatırım</th>
                <th className="th text-center">Eğitim</th>
                <th className="th text-center">Hizmet</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {firmalar.map((f) => (
                <tr key={f.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/firmalar/${f.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {f.ad}
                    </Link>
                    <p className="text-xs text-muted-foreground/70">
                      Eklendi: {formatTarih(f.createdAt)}
                    </p>
                  </td>
                  <td className="td">{f.sektor ?? "—"}</td>
                  <td className="td">{f.il ?? "—"}</td>
                  <td className="td">{f.yetkiliAd ?? "—"}</td>
                  <td className="td text-center">{f._count.yatirimlar}</td>
                  <td className="td text-center">{f._count.egitimler}</td>
                  <td className="td text-center">{f._count.hizmetler}</td>
                  <td className="td">
                    <StatusBadge durum={f.durum} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
