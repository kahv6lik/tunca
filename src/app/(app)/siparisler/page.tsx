import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatPara, formatTarih } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { SIPARIS_DURUM } from "@/lib/constants";
import { tarihAraligi } from "@/lib/tarih-araligi";
import OzetDugmesi from "@/components/panel/OzetDugmesi";

export const dynamic = "force-dynamic";

const SAYFA_BOYUTU = 25;

/**
 * Siparişler — Faz 15 / S1.
 *
 * ONAY KUYRUĞU en üsttedir: onay yetkisi olan kullanıcı ekranı açtığında
 * ilk göreceği şey, kendisini bekleyen iştir.
 */
export default async function SiparislerPage(props: {
  searchParams: Promise<{
    ara?: string; durum?: string; bas?: string; bit?: string; sayfa?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.siparisGoruntule);

  const [ekleyebilir, onaylayabilir] = await Promise.all([
    yetkiVarMi(IZIN.siparisOlustur),
    yetkiVarMi(IZIN.siparisOnayla),
  ]);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = (SIPARIS_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.SiparisWhereInput = {
    AND: [
      ara ? { OR: metinArama<Prisma.SiparisWhereInput>(ara, ["no", "firma.ad"]) } : {},
      durum ? { durum } : {},
      aralik ? { createdAt: aralik } : {},
    ],
  };

  const [toplam, siparisler, onayBekleyen] = await Promise.all([
    db.siparis.count({ where }),
    db.siparis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: {
        firma: { select: { id: true, ad: true, firmaNo: true } },
        _count: { select: { kalemler: true, sevkiyatlar: true } },
      },
    }),
    // Onay kuyruğu — durum süzgecinden BAĞIMSIZ, her zaman görünür.
    onaylayabilir
      ? db.siparis.findMany({
          where: { durum: "onaybekliyor" },
          orderBy: { createdAt: "asc" },
          take: 10,
          include: { firma: { select: { ad: true } } },
        })
      : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  if (durum) qs.set("durum", durum);
  if (searchParams.bas) qs.set("bas", searchParams.bas);
  if (searchParams.bit) qs.set("bit", searchParams.bit);
  const baseUrl = `/siparisler?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader
        title="Siparişler"
        subtitle={`${toplam} sipariş listeleniyor`}
        action={
          ekleyebilir ? (
            <Link href="/siparisler/yeni" className="btn-primary">
              + Yeni Sipariş
            </Link>
          ) : undefined
        }
      />

      {/* Onay kuyruğu (S3) */}
      {onayBekleyen.length > 0 && (
        <div className="card mb-6 border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-amber-400">
            Onayınızı bekleyen {onayBekleyen.length} sipariş
          </h3>
          <ul className="divide-y divide-border/40">
            {onayBekleyen.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/siparisler/${s.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {s.no}
                  </Link>
                  <span className="ml-2 text-sm text-muted-foreground">{s.firma.ad}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium">
                    {formatPara(s.toplam, s.paraBirimi)}
                  </span>
                  <Link href={`/siparisler/${s.id}`} className="btn-secondary h-8 px-3 text-xs">
                    İncele
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Sipariş no, firma…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="onaybekliyor">Onay bekliyor</option>
            <option value="onaylandi">Onaylandı</option>
            <option value="reddedildi">Reddedildi</option>
            <option value="iptal">İptal</option>
            <option value="taslak">Taslak</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input id="bas" name="bas" type="date" defaultValue={searchParams.bas ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input id="bit" name="bit" type="date" defaultValue={searchParams.bit ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum || searchParams.bas || searchParams.bit) && (
          <Link href="/siparisler" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {siparisler.length === 0 ? (
        <EmptyState
          title="Sipariş bulunamadı"
          description="Filtreleri değiştirin ya da yeni sipariş oluşturun."
          action={
            ekleyebilir ? (
              <Link href="/siparisler/yeni" className="btn-primary">+ Yeni Sipariş</Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Sipariş No</th>
                <th className="th">Firma</th>
                <th className="th">Tarih</th>
                <th className="th text-center">Kalem</th>
                <th className="th text-right">Toplam</th>
                <th className="th">Durum</th>
                <th className="th text-center">Sevkiyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {siparisler.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="td">
                    <Link
                      href={`/siparisler/${s.id}`}
                      className="font-mono text-xs font-medium text-foreground hover:text-primary"
                    >
                      {s.no}
                    </Link>
                    <OzetDugmesi tur="siparis" id={s.id} />
                  </td>
                  <td className="td">
                    <Link
                      href={`/firmalar/${s.firma.id}`}
                      className="text-foreground hover:text-primary"
                    >
                      {s.firma.firmaNo ? `${s.firma.firmaNo} · ` : ""}
                      {s.firma.ad}
                    </Link>
                  </td>
                  <td className="td">{formatTarih(s.createdAt)}</td>
                  <td className="td text-center">{s._count.kalemler}</td>
                  <td className="td text-right font-medium">
                    {formatPara(s.toplam, s.paraBirimi)}
                  </td>
                  <td className="td">
                    <StatusBadge durum={s.durum} />
                  </td>
                  <td className="td text-center">
                    {s._count.sevkiyatlar > 0 ? (
                      <Link href={`/sevkiyat?siparis=${s.id}`} className="text-primary hover:underline">
                        {s._count.sevkiyatlar}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
