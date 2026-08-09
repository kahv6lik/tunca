import Link from "next/link";
import { Prisma } from "@prisma/client";
import { MapPin } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import {
  DOGRULAMA_ETIKET,
  haritaBaglantisi,
  sureMetniDakika,
  type DogrulamaDurumu,
} from "@/lib/konum-saf";
import { tarihAraligi, araliktanEtiket, hazirAraliklar } from "@/lib/tarih-araligi";
import ZiyaretBaslat from "@/components/ziyaretler/ZiyaretBaslat";
import ZiyaretBitir from "@/components/ziyaretler/ZiyaretBitir";

export const dynamic = "force-dynamic";

/**
 * Saha ziyaretleri — Faz 17 / A4, A5.
 *
 * Ekranın üstünde AÇIK ziyaret durur: sahadaki kişi uygulamayı açtığında ilk
 * göreceği şey "hâlâ açık bir ziyaretin var" olmalıdır, yoksa kapatmayı
 * unutur ve süre raporu bozulur.
 */
export default async function ZiyaretlerPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; kisi?: string; dogrulama?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.ziyaretGoruntule);
  const acabilir = await yetkiVarMi(IZIN.ziyaretOlustur);

  const { db, session } = await getTenantContext();
  const ayar = await kiraciAyari();

  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const kisi = (searchParams.kisi ?? "").trim();
  const dogrulama = ["dogrulandi", "uzak", "alinamadi"].includes(searchParams.dogrulama ?? "")
    ? searchParams.dogrulama!
    : "";

  const where: Prisma.ZiyaretWhereInput = {
    AND: [
      aralik ? { baslangic: aralik } : {},
      kisi ? { kullaniciId: kisi } : {},
      dogrulama ? { dogrulama } : {},
    ],
  };

  const [acikZiyaret, ziyaretler, firmalar, kullanicilar] = await Promise.all([
    db.ziyaret.findFirst({
      where: { kullaniciId: session.userId, bitis: null },
      include: { firma: { select: { id: true, ad: true } } },
    }),
    db.ziyaret.findMany({
      where,
      orderBy: { baslangic: "desc" },
      take: 200,
      include: { firma: { select: { id: true, ad: true } } },
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

  // Rapor: süre yalnızca BİTMİŞ ziyaretlerden hesaplanır; açık bir ziyaretin
  // süresi henüz gerçekleşmemiş bir sayıdır.
  const bitmisler = ziyaretler.filter((z) => z.sureDakika !== null);
  const toplamDakika = bitmisler.reduce((t, z) => t + (z.sureDakika ?? 0), 0);
  const uzakSayi = ziyaretler.filter((z) => z.dogrulama === "uzak").length;

  return (
    <div>
      <PageHeader
        title="Saha Ziyaretleri"
        subtitle={[
          `${ziyaretler.length} ziyaret`,
          araliktanEtiket(aralik),
          `yarıçap ${ayar.ziyaretYaricapM} m`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {acabilir && (
        <div className="card mb-4 p-5">
          {acikZiyaret ? (
            <>
              <p className="mb-1 text-sm font-semibold text-foreground">
                Açık ziyaret: {acikZiyaret.firma.ad}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {formatTarih(acikZiyaret.baslangic)} tarihinde başladı ·{" "}
                {DOGRULAMA_ETIKET[acikZiyaret.dogrulama as DogrulamaDurumu]?.label ??
                  acikZiyaret.dogrulama}
              </p>
              <ZiyaretBitir id={acikZiyaret.id} />
            </>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-foreground">Yeni ziyaret</p>
              <ZiyaretBaslat firmalar={firmalar} />
            </>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Kutu etiket="Bitmiş ziyaret" deger={String(bitmisler.length)} />
        <Kutu etiket="Toplam süre" deger={sureMetniDakika(toplamDakika)} />
        <Kutu
          etiket="Konumu uyuşmayan"
          deger={String(uzakSayi)}
          vurgu={uzakSayi > 0 ? "text-rose-400" : undefined}
        />
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input id="bas" name="bas" type="date" defaultValue={searchParams.bas ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input id="bit" name="bit" type="date" defaultValue={searchParams.bit ?? ""} className="input" />
        </div>
        <div className="w-48">
          <label className="label" htmlFor="kisi">Personel</label>
          <select id="kisi" name="kisi" defaultValue={kisi} className="input">
            <option value="">Herkes</option>
            {kullanicilar.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="label" htmlFor="dogrulama">Konum</label>
          <select id="dogrulama" name="dogrulama" defaultValue={dogrulama} className="input">
            <option value="">Tümü</option>
            <option value="dogrulandi">Doğrulandı</option>
            <option value="uzak">Uyuşmuyor</option>
            <option value="alinamadi">Doğrulanamadı</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => (
            <Link
              key={h.anahtar}
              href={`/ziyaretler?bas=${h.bas}&bit=${h.bit}`}
              className="rounded-lg border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {h.etiket}
            </Link>
          ))}
        </div>
        {(searchParams.bas || searchParams.bit || kisi || dogrulama) && (
          <Link href="/ziyaretler" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {ziyaretler.length === 0 ? (
        <EmptyState
          title="Ziyaret kaydı yok"
          description="Saha ziyareti başlatıldığında konum doğrulanır, bitirildiğinde süre kendiliğinden hesaplanır."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Firma</th>
                <th className="th">Personel</th>
                <th className="th">Başlangıç</th>
                <th className="th">Süre</th>
                <th className="th">Konum</th>
                <th className="th">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {ziyaretler.map((z) => {
                const rozet =
                  DOGRULAMA_ETIKET[z.dogrulama as DogrulamaDurumu] ??
                  DOGRULAMA_ETIKET.alinamadi;
                return (
                  <tr key={z.id} className="hover:bg-muted/40">
                    <td className="td">
                      <Link href={`/firmalar/${z.firma.id}`} className="hover:text-primary">
                        {z.firma.ad}
                      </Link>
                    </td>
                    <td className="td text-sm">{adOf.get(z.kullaniciId) ?? "—"}</td>
                    <td className="td text-xs text-muted-foreground">
                      {formatTarih(z.baslangic)}
                    </td>
                    <td className="td text-sm">
                      {z.bitis ? sureMetniDakika(z.sureDakika) : (
                        <span className="text-amber-400">devam ediyor</span>
                      )}
                    </td>
                    <td className="td">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${rozet.className}`}
                      >
                        {rozet.label}
                      </span>
                      {z.mesafeM !== null && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {z.mesafeM} m
                        </span>
                      )}
                      {z.enlem !== null && z.boylam !== null && (
                        <a
                          href={haritaBaglantisi(z.enlem, z.boylam)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Haritada göster"
                          className="ml-2 inline-flex text-muted-foreground hover:text-primary"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                    <td className="td max-w-[280px] truncate text-sm text-muted-foreground">
                      {z.not ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kutu({
  etiket,
  deger,
  vurgu,
}: {
  etiket: string;
  deger: string;
  vurgu?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className={`text-xl font-semibold ${vurgu ?? "text-foreground"}`}>{deger}</p>
    </div>
  );
}
