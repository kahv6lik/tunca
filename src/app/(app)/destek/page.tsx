import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { DESTEK_KANAL, DESTEK_ONCELIK, DESTEK_DURUM, durumBadge } from "@/lib/constants";
import { oncelikSirasi } from "@/lib/destek-tanimlar";
import DestekPanel from "@/components/destek/DestekPanel";
import OncelikRozet from "@/components/destek/OncelikRozet";
import OzetDugmesi from "@/components/panel/OzetDugmesi";

export const dynamic = "force-dynamic";

const KANAL_ETIKET = new Map<string, string>(DESTEK_KANAL.map((k) => [k.deger, k.etiket]));

/**
 * Destek kayıtları — Faz 16 / P2.
 *
 * VARSAYILAN GÖRÜNÜM AÇIK İŞLERDİR. Destek ekranı bir arşiv değil bir iş
 * kuyruğudur; kapanmış kayıtlar listeyi doldursaydı "şu an ne var" sorusu
 * her açılışta filtrelemeyi gerektirirdi. Kapananlar `durum=hepsi` ile gelir.
 */
export default async function DestekPage(props: {
  searchParams: Promise<{
    ara?: string;
    durum?: string;
    oncelik?: string;
    kanal?: string;
    atanan?: string;
    firma?: string;
    proje?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.destekGoruntule);
  const [ekleyebilir, projeGorur] = await Promise.all([
    yetkiVarMi(IZIN.destekOlustur),
    yetkiVarMi(IZIN.projeGoruntule),
  ]);

  const db = await getTenantDb();

  const ara = (searchParams.ara ?? "").trim();
  const durumParam = searchParams.durum ?? "";
  const durum = (DESTEK_DURUM as readonly string[]).includes(durumParam)
    ? durumParam
    : durumParam === "hepsi"
      ? "hepsi"
      : "";
  const oncelik = DESTEK_ONCELIK.some((o) => o.deger === searchParams.oncelik)
    ? searchParams.oncelik!
    : "";
  const kanal = KANAL_ETIKET.has(searchParams.kanal ?? "") ? searchParams.kanal! : "";
  const atanan = (searchParams.atanan ?? "").trim();
  const firma = (searchParams.firma ?? "").trim();
  const proje = (searchParams.proje ?? "").trim();

  // Boş durum = açık işler. "hepsi" bilinçli bir seçimdir.
  const durumKosulu: Prisma.DestekKaydiWhereInput =
    durum === "hepsi"
      ? {}
      : durum
        ? { durum }
        : { durum: { in: ["acik", "islemde", "beklemede"] } };

  const where: Prisma.DestekKaydiWhereInput = {
    AND: [
      ara
        ? {
            OR: metinArama<Prisma.DestekKaydiWhereInput>(ara, [
              "no",
              "baslik",
              "aciklama",
              "firma.ad",
            ]),
          }
        : {},
      durumKosulu,
      oncelik ? { oncelik } : {},
      kanal ? { kanal } : {},
      atanan ? (atanan === "yok" ? { atananId: null } : { atananId: atanan }) : {},
      firma ? { firmaId: firma } : {},
      proje ? { projeId: proje } : {},
    ],
  };

  const [kayitlar, firmalar, kisiler, projeler, kullanicilar] = await Promise.all([
    db.destekKaydi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        firma: { select: { id: true, ad: true } },
        proje: { select: { id: true, kod: true } },
        _count: { select: { islemler: true } },
      },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.kisi.findMany({
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    projeGorur
      ? db.proje.findMany({
          orderBy: { kod: "asc" },
          take: 300,
          select: { id: true, kod: true, ad: true },
        })
      : Promise.resolve([]),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Kritik önce: aynı gün açılmış iki kayıttan hangisinin önce ele alınacağı
  // tarihe değil ÖNCELİĞE bakar.
  const sirali = [...kayitlar].sort(
    (a, b) => oncelikSirasi(b.oncelik) - oncelikSirasi(a.oncelik)
  );

  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));
  const panel = (
    <DestekPanel
      firmalar={firmalar}
      kisiler={kisiler}
      projeler={projeler}
      kullanicilar={kullanicilar}
    />
  );
  const filtreVar = Boolean(
    ara || durumParam || oncelik || kanal || atanan || firma || proje
  );

  return (
    <div>
      <PageHeader
        title="Destek Kayıtları"
        subtitle={`${sirali.length} kayıt${durum === "hepsi" ? "" : " (açık işler)"}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/destek/rapor" className="btn-secondary">
              Rapor
            </Link>
            {ekleyebilir ? panel : null}
          </div>
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Kayıt no, konu, firma…"
            className="input"
          />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durumParam} className="input">
            <option value="">Açık işler</option>
            <option value="hepsi">Hepsi</option>
            {DESTEK_DURUM.map((d) => (
              <option key={d} value={d}>{durumBadge(d).label}</option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="label" htmlFor="oncelik">Öncelik</label>
          <select id="oncelik" name="oncelik" defaultValue={oncelik} className="input">
            <option value="">Tümü</option>
            {DESTEK_ONCELIK.map((o) => (
              <option key={o.deger} value={o.deger}>{o.etiket}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="label" htmlFor="kanal">Kanal</label>
          <select id="kanal" name="kanal" defaultValue={kanal} className="input">
            <option value="">Tümü</option>
            {DESTEK_KANAL.map((x) => (
              <option key={x.deger} value={x.deger}>{x.etiket}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="atanan">Atanan</label>
          <select id="atanan" name="atanan" defaultValue={atanan} className="input">
            <option value="">Tümü</option>
            <option value="yok">Atanmamış</option>
            {kullanicilar.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="label" htmlFor="firma">Firma</label>
          <select id="firma" name="firma" defaultValue={firma} className="input">
            <option value="">Tümü</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
        {projeGorur && projeler.length > 0 && (
          <div className="w-48">
            <label className="label" htmlFor="proje">Proje</label>
            <select id="proje" name="proje" defaultValue={proje} className="input">
              <option value="">Tümü</option>
              {projeler.map((p) => (
                <option key={p.id} value={p.id}>{p.kod}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn-primary">Filtrele</button>
        {filtreVar && <Link href="/destek" className="btn-secondary">Temizle</Link>}
      </form>

      {sirali.length === 0 ? (
        <EmptyState
          title="Destek kaydı bulunamadı"
          description="Müşteriden gelen talep, arıza ve başvurular burada takip edilir."
          action={ekleyebilir ? panel : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Kayıt No</th>
                <th className="th">Konu</th>
                <th className="th">Firma</th>
                <th className="th">Kanal</th>
                <th className="th">Öncelik</th>
                <th className="th">Atanan</th>
                <th className="th">Açılış</th>
                <th className="th text-center">İşlem</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sirali.map((d) => (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="td font-mono text-xs">
                    <Link href={`/destek/${d.id}`} className="hover:text-primary">
                      {d.no}
                    </Link>
                  </td>
                  <td className="td">
                    <Link
                      href={`/destek/${d.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {d.baslik}
                    </Link>
                    <OzetDugmesi tur="destek" id={d.id} />
                    {d.proje && (
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                        {d.proje.kod}
                      </span>
                    )}
                  </td>
                  <td className="td">
                    <Link href={`/firmalar/${d.firma.id}`} className="hover:text-primary">
                      {d.firma.ad}
                    </Link>
                  </td>
                  <td className="td text-xs text-muted-foreground">
                    {KANAL_ETIKET.get(d.kanal) ?? d.kanal}
                  </td>
                  <td className="td"><OncelikRozet oncelik={d.oncelik} /></td>
                  <td className="td text-sm">
                    {d.atananId ? adOf.get(d.atananId) ?? "—" : (
                      <span className="text-muted-foreground">Atanmamış</span>
                    )}
                  </td>
                  <td className="td text-xs text-muted-foreground">
                    {formatTarih(d.createdAt)}
                  </td>
                  <td className="td text-center text-xs">{d._count.islemler}</td>
                  <td className="td"><StatusBadge durum={d.durum} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
