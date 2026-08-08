import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { STOK_HAREKET_TUR } from "@/lib/constants";
import { stokDurumu, STOK_DURUM_ETIKET } from "@/lib/urun-tanimlar";
import { stokIstemcisi, kritikStoktakiUrunler } from "@/lib/stok";
import StokPanel from "@/components/urunler/StokPanel";
import { tarihAraligi } from "@/lib/tarih-araligi";

export const dynamic = "force-dynamic";

/**
 * Stok durumu ve hareket dökümü — Faz 14 / T7, T8.
 *
 * Bakiye ürün kartındaki özetten okunur; DÖKÜM ise hareket defterinden
 * gelir. İkisi ekranda yan yana durur çünkü "bakiye niye bu?" sorusunun
 * yanıtı her zaman defterdedir.
 */
export default async function StokPage(props: {
  searchParams: Promise<{ urun?: string; bas?: string; bit?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.stokGoruntule);
  const hareketGirer = await yetkiVarMi(IZIN.stokHareket);

  const db = await getTenantDb();
  const urunSuzgeci = (searchParams.urun ?? "").trim();
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);

  const [urunler, hareketler, kritikler, kullanicilar] = await Promise.all([
    db.urun.findMany({
      where: { stokTakibi: true },
      orderBy: { ad: "asc" },
      take: 500,
      select: {
        id: true, kod: true, ad: true, birim: true,
        stokMiktar: true, kritikStok: true, stokTakibi: true, durum: true,
      },
    }),
    db.stokHareketi.findMany({
      where: {
        ...(urunSuzgeci ? { urunId: urunSuzgeci } : {}),
        ...(aralik ? { createdAt: aralik } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { urun: { select: { id: true, kod: true, ad: true, birim: true } } },
    }),
    kritikStoktakiUrunler(stokIstemcisi(db)),
    db.user.findMany({ select: { id: true, name: true }, take: 500 }),
  ]);

  const kullaniciAdi = new Map(kullanicilar.map((u) => [u.id, u.name]));
  const turEtiket = (t: string) =>
    STOK_HAREKET_TUR.find((x) => x.deger === t)?.etiket ?? t;

  const toplamKalem = urunler.length;
  const stoksuz = urunler.filter((u) => u.stokMiktar <= 0).length;

  return (
    <div>
      <PageHeader
        title="Stok"
        subtitle={`${toplamKalem} takipli ürün · ${kritikler.length} kritik · ${stoksuz} tükendi`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/urunler" className="btn-secondary">Katalog</Link>
            {hareketGirer && (
              <>
                <StokPanel urunler={urunler} sayim />
                <StokPanel urunler={urunler} />
              </>
            )}
          </div>
        }
      />

      {/* T8 — kritik stok uyarısı */}
      {kritikler.length > 0 && (
        <div className="card mb-6 border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Kritik stok seviyesi</h3>
          </div>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {kritikler.map((u) => (
              <li key={u.id} className="flex justify-between gap-2">
                <span className="text-foreground">{u.ad}</span>
                <span className="text-muted-foreground">
                  {u.stokMiktar} / {u.kritikStok} {u.birim}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stok durumu */}
      {urunler.length === 0 ? (
        <EmptyState
          title="Takip edilen ürün yok"
          description="Ürün kartındaki 'Stok takibi yapılsın' seçeneğini açın."
          action={<Link href="/urunler" className="btn-primary">Katalog</Link>}
        />
      ) : (
        <div className="card mb-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Kod</th>
                <th className="th">Ürün</th>
                <th className="th text-right">Bakiye</th>
                <th className="th text-right">Kritik Seviye</th>
                <th className="th">Durum</th>
                <th className="th text-right">Hareketler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {urunler.map((u) => {
                const sd = stokDurumu(u);
                return (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="td font-mono text-xs">{u.kod}</td>
                    <td className="td font-medium text-foreground">{u.ad}</td>
                    <td className="td text-right">
                      {u.stokMiktar} {u.birim}
                    </td>
                    <td className="td text-right text-muted-foreground">
                      {u.kritikStok > 0 ? `${u.kritikStok} ${u.birim}` : "—"}
                    </td>
                    <td className="td">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs ring-1 ${STOK_DURUM_ETIKET[sd].className}`}
                      >
                        {STOK_DURUM_ETIKET[sd].label}
                      </span>
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/stok?urun=${u.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Döküm
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hareket defteri */}
      <div className="card overflow-x-auto">
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border/60 p-4">
          <div className="w-64">
            <label className="label" htmlFor="urun">Ürün</label>
            <select id="urun" name="urun" defaultValue={urunSuzgeci} className="input">
              <option value="">Tüm ürünler</option>
              {urunler.map((u) => (
                <option key={u.id} value={u.id}>{u.kod} — {u.ad}</option>
              ))}
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
          {(urunSuzgeci || searchParams.bas || searchParams.bit) && (
            <Link href="/stok" className="btn-secondary">Temizle</Link>
          )}
        </form>

        {hareketler.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Hareket yok"
              description="Mal kabul, sevkiyat ve sayım kayıtları burada listelenir."
            />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Tarih</th>
                <th className="th">Ürün</th>
                <th className="th">Tür</th>
                <th className="th text-right">Miktar</th>
                <th className="th text-right">Sonraki Bakiye</th>
                <th className="th">Referans</th>
                <th className="th">Kullanıcı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {hareketler.map((h) => (
                <tr key={h.id} className="hover:bg-muted/40">
                  <td className="td whitespace-nowrap">{formatTarih(h.createdAt)}</td>
                  <td className="td">{h.urun.ad}</td>
                  <td className="td">{turEtiket(h.tur)}</td>
                  <td
                    className={`td text-right font-medium ${
                      h.miktar > 0 ? "text-emerald-500" : "text-rose-400"
                    }`}
                  >
                    {h.miktar > 0 ? "+" : ""}
                    {h.miktar} {h.urun.birim}
                  </td>
                  <td className="td text-right text-muted-foreground">{h.sonrakiBakiye}</td>
                  <td className="td text-xs text-muted-foreground">
                    {h.referans ?? h.aciklama ?? "—"}
                  </td>
                  <td className="td text-xs text-muted-foreground">
                    {h.kullaniciId ? kullaniciAdi.get(h.kullaniciId) ?? "—" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
