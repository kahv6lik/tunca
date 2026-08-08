import Link from "next/link";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPara } from "@/lib/format";
import PaketPanel from "@/components/urunler/PaketPanel";
import DeleteButton from "@/components/DeleteButton";
import { paketSil } from "./actions";
import { paketBirimFiyati } from "@/lib/fiyat-saf";

export const dynamic = "force-dynamic";

/**
 * Paketler — Faz 14 / T2.
 *
 * Menüde kendi başlığı yoktur; "Ürünler" ekranından açılır. Paket, katalogun
 * bir türevidir — ayrı bir menü öğesi, günde bir kez kullanılan bir ekrana
 * kalıcı yer ayırmak olurdu.
 */
export default async function PaketlerPage(props: {
  searchParams: Promise<{ firma?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.urunGoruntule);
  const yonetir = await yetkiVarMi(IZIN.urunYonet);

  const db = await getTenantDb();
  const firmaSuzgeci = (searchParams.firma ?? "").trim();

  const [paketler, urunler, firmalar] = await Promise.all([
    db.paket.findMany({
      where: firmaSuzgeci
        ? firmaSuzgeci === "genel"
          ? { firmaId: null }
          : { firmaId: firmaSuzgeci }
        : {},
      orderBy: [{ durum: "asc" }, { ad: "asc" }],
      take: 300,
      include: {
        firma: { select: { id: true, ad: true } },
        kalemler: {
          orderBy: { sira: "asc" },
          include: { urun: { select: { id: true, kod: true, ad: true, listeFiyat: true } } },
        },
      },
    }),
    db.urun.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, kod: true, ad: true, listeFiyat: true },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Paketler"
        subtitle={`${paketler.length} paket · ürün gruplarına özel fiyat`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/urunler" className="btn-secondary">Ürünler</Link>
            {yonetir && <PaketPanel urunler={urunler} firmalar={firmalar} />}
          </div>
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="w-64">
          <label className="label" htmlFor="firma">Firma</label>
          <select id="firma" name="firma" defaultValue={firmaSuzgeci} className="input">
            <option value="">Tümü</option>
            <option value="genel">Genel paketler (firmasız)</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {firmaSuzgeci && <Link href="/paketler" className="btn-secondary">Temizle</Link>}
      </form>

      {paketler.length === 0 ? (
        <EmptyState
          title="Paket yok"
          description="Bir paket, birden çok ürünü tek fiyatla sunmanızı sağlar."
          action={yonetir ? <PaketPanel urunler={urunler} firmalar={firmalar} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {paketler.map((p) => {
            const onizleme = {
              paketId: p.id,
              sabitFiyat: p.sabitFiyat,
              fiyat: p.fiyat,
              iskontoOrani: p.iskontoOrani,
              kalemler: p.kalemler.map((k) => ({
                urunId: k.urunId,
                miktar: k.miktar,
                listeFiyat: k.urun.listeFiyat,
              })),
            };
            const listeToplam = p.kalemler.reduce(
              (s, k) => s + k.urun.listeFiyat * k.miktar,
              0
            );
            const paketToplam = p.kalemler.reduce((s, k) => {
              const birim = paketBirimFiyati(onizleme, k.urunId, k.urun.listeFiyat);
              return s + (birim ?? 0) * k.miktar;
            }, 0);

            return (
              <div key={p.id} className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.kod}</p>
                    <h3 className="text-base font-semibold text-foreground">{p.ad}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.firma ? `Yalnızca: ${p.firma.ad}` : "Tüm firmalara açık"}
                      {p.durum === "pasif" && " · pasif"}
                    </p>
                  </div>
                  {yonetir && (
                    <div className="flex items-center gap-1">
                      <PaketPanel
                        urunler={urunler}
                        firmalar={firmalar}
                        mevcut={{
                          id: p.id,
                          kod: p.kod,
                          ad: p.ad,
                          aciklama: p.aciklama ?? "",
                          firmaId: p.firmaId ?? "",
                          paraBirimi: p.paraBirimi,
                          sabitFiyat: p.sabitFiyat,
                          fiyat: p.fiyat,
                          iskontoOrani: p.iskontoOrani,
                          durum: p.durum,
                          kalemler: p.kalemler.map((k) => ({
                            urunId: k.urunId,
                            miktar: k.miktar,
                          })),
                        }}
                      />
                      <DeleteButton
                        action={paketSil.bind(null, p.id)}
                        confirmText={`"${p.ad}" paketini silmek istediğinize emin misiniz?`}
                      />
                    </div>
                  )}
                </div>

                <ul className="mb-3 space-y-1 text-sm">
                  {p.kalemler.map((k) => (
                    <li key={k.id} className="flex justify-between text-muted-foreground">
                      <span>
                        {k.urun.ad}
                        <span className="text-xs"> × {k.miktar}</span>
                      </span>
                      <span>
                        {formatPara(
                          (paketBirimFiyati(onizleme, k.urunId, k.urun.listeFiyat) ?? 0) *
                            k.miktar,
                          p.paraBirimi
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border/60 pt-3 text-sm">
                  <div className="flex justify-between text-muted-foreground line-through">
                    <span>Liste</span>
                    <span>{formatPara(listeToplam, p.paraBirimi)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>Paket fiyatı</span>
                    <span>{formatPara(paketToplam, p.paraBirimi)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
