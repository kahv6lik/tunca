import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatPara } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { URUN_DURUM } from "@/lib/constants";
import { stokDurumu, STOK_DURUM_ETIKET, kdvDahil } from "@/lib/urun-tanimlar";
import UrunPanel from "@/components/urunler/UrunPanel";
import DeleteButton from "@/components/DeleteButton";
import { urunSil } from "./actions";

export const dynamic = "force-dynamic";

const SAYFA_BOYUTU = 25;

/**
 * Ürün / hizmet kataloğu — Faz 14 / T1.
 *
 * Görüntüleme ve yönetim AYRI izinlerdir: satış temsilcisi fiyatı görmeli
 * (müşteriye söyleyecek), ama değiştirememeli.
 */
export default async function UrunlerPage(props: {
  searchParams: Promise<{ ara?: string; durum?: string; kategori?: string; sayfa?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.urunGoruntule);

  const [yonetir, stokGorur] = await Promise.all([
    yetkiVarMi(IZIN.urunYonet),
    yetkiVarMi(IZIN.stokGoruntule),
  ]);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = (URUN_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";
  const kategori = (searchParams.kategori ?? "").trim();
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.UrunWhereInput = {
    AND: [
      ara ? { OR: metinArama<Prisma.UrunWhereInput>(ara, ["kod", "ad", "kategori"]) } : {},
      durum ? { durum } : {},
      kategori ? { kategori } : {},
    ],
  };

  const [toplam, urunler, kategoriler] = await Promise.all([
    db.urun.count({ where }),
    db.urun.findMany({
      where,
      orderBy: [{ durum: "asc" }, { ad: "asc" }],
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: { _count: { select: { paketKalemleri: true } } },
    }),
    db.urun.findMany({
      where: { kategori: { not: null } },
      distinct: ["kategori"],
      select: { kategori: true },
      orderBy: { kategori: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  if (durum) qs.set("durum", durum);
  if (kategori) qs.set("kategori", kategori);
  const baseUrl = `/urunler?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader
        title="Ürünler ve Hizmetler"
        subtitle={`${toplam} kalem listeleniyor`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {stokGorur && (
              <Link href="/stok" className="btn-secondary">
                Stok Durumu
              </Link>
            )}
            <Link href="/paketler" className="btn-secondary">
              Paketler
            </Link>
            {yonetir && <UrunPanel />}
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
            placeholder="Kod, ad, kategori…"
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
        <div className="w-48">
          <label className="label" htmlFor="kategori">Kategori</label>
          <select id="kategori" name="kategori" defaultValue={kategori} className="input">
            <option value="">Tümü</option>
            {kategoriler
              .map((k) => k.kategori)
              .filter((x): x is string => !!x)
              .map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum || kategori) && (
          <Link href="/urunler" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {urunler.length === 0 ? (
        <EmptyState
          title="Ürün bulunamadı"
          description="Katalog boş ya da filtreye uyan kalem yok."
          action={yonetir ? <UrunPanel /> : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Kod</th>
                <th className="th">Ad</th>
                <th className="th">Kategori</th>
                <th className="th">Birim</th>
                <th className="th text-right">Liste Fiyatı</th>
                <th className="th text-right">KDV Dahil</th>
                {stokGorur && <th className="th text-right">Stok</th>}
                <th className="th">Durum</th>
                {yonetir && <th className="th text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {urunler.map((u) => {
                const sd = stokDurumu(u);
                return (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="td font-mono text-xs">{u.kod}</td>
                    <td className="td">
                      <span className="font-medium text-foreground">{u.ad}</span>
                      {u._count.paketKalemleri > 0 && (
                        <p className="text-xs text-muted-foreground/70">
                          {u._count.paketKalemleri} pakette kullanılıyor
                        </p>
                      )}
                    </td>
                    <td className="td">{u.kategori ?? "—"}</td>
                    <td className="td">{u.birim}</td>
                    <td className="td text-right">
                      {formatPara(u.listeFiyat, u.paraBirimi)}
                    </td>
                    <td className="td text-right text-muted-foreground">
                      {formatPara(kdvDahil(u.listeFiyat, u.kdvOrani), u.paraBirimi)}
                    </td>
                    {stokGorur && (
                      <td className="td text-right">
                        {u.stokTakibi ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs ring-1 ${STOK_DURUM_ETIKET[sd].className}`}
                          >
                            {u.stokMiktar} {u.birim}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="td">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs ring-1 ${
                          u.durum === "aktif"
                            ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25"
                            : "bg-slate-500/15 text-slate-400 ring-slate-500/25"
                        }`}
                      >
                        {u.durum === "aktif" ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    {yonetir && (
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <UrunPanel
                            mevcut={{
                              id: u.id,
                              kod: u.kod,
                              ad: u.ad,
                              aciklama: u.aciklama ?? "",
                              kategori: u.kategori ?? "",
                              birim: u.birim,
                              listeFiyat: u.listeFiyat,
                              paraBirimi: u.paraBirimi,
                              kdvOrani: u.kdvOrani,
                              durum: u.durum,
                              stokTakibi: u.stokTakibi,
                              kritikStok: u.kritikStok,
                            }}
                          />
                          <DeleteButton
                            action={urunSil.bind(null, u.id)}
                            confirmText={`"${u.ad}" ürününü silmek istediğinize emin misiniz?`}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
