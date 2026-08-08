import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPara, formatTarih } from "@/lib/format";
import { metinArama } from "@/lib/arama";
import { SEVKIYAT_DURUM } from "@/lib/constants";
import { tarihAraligi, hazirAraliklar } from "@/lib/tarih-araligi";
import DurumDugmeleri from "@/components/siparisler/DurumDugmeleri";

export const dynamic = "force-dynamic";

/** Bir sevkiyatın açılışından bu yana geçen gün. */
function beklemeGunu(baslangic: Date, bitis?: Date | null): number {
  const son = bitis ?? new Date();
  return Math.max(0, Math.floor((son.getTime() - baslangic.getTime()) / 86_400_000));
}

/**
 * Sevkiyat kuyruğu ve raporu — Faz 15 / S4, S5.
 *
 * Kuyruk, onaylanmış siparişlerden doğan sevkiyatları gösterir. GECİKENLER
 * ayrı bir bant değil, listede işaretlidir: depo ekibi tek listeye bakar.
 */
export default async function SevkiyatPage(props: {
  searchParams: Promise<{
    ara?: string; durum?: string; siparis?: string; bas?: string; bit?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.sevkiyatGoruntule);
  const yonetir = await yetkiVarMi(IZIN.sevkiyatYonet);

  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = (SEVKIYAT_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);

  const where: Prisma.SevkiyatWhereInput = {
    AND: [
      ara
        ? {
            OR: metinArama<Prisma.SevkiyatWhereInput>(ara, [
              "no",
              "takipNo",
              "tasiyici",
              "siparis.no",
              "siparis.firma.ad",
            ]),
          }
        : {},
      durum ? { durum } : {},
      searchParams.siparis ? { siparisId: searchParams.siparis } : {},
      aralik ? { createdAt: aralik } : {},
    ],
  };

  const [sevkiyatlar, ozet, bekleyenSiparis] = await Promise.all([
    db.sevkiyat.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        siparis: {
          select: {
            id: true, no: true, toplam: true, paraBirimi: true,
            firma: { select: { id: true, ad: true } },
          },
        },
      },
    }),
    db.sevkiyat.groupBy({ by: ["durum"], _count: { _all: true } }),
    /**
     * Sevkiyatı henüz açılmamış ONAYLI siparişler — depo ekibinin asıl
     * iş listesi. Onaysız siparişler buraya HİÇ girmez; akışın sözü budur.
     */
    db.siparis.findMany({
      where: { durum: "onaylandi", sevkiyatlar: { none: {} } },
      orderBy: { onayTarihi: "asc" },
      take: 20,
      include: { firma: { select: { ad: true } } },
    }),
  ]);

  const sayi = (d: string) => ozet.find((o) => o.durum === d)?._count._all ?? 0;
  const geciken = sevkiyatlar.filter(
    (s) => s.durum === "hazirlaniyor" && beklemeGunu(s.createdAt) >= 3
  ).length;

  return (
    <div>
      <PageHeader
        title="Sevkiyat"
        subtitle={`${sevkiyatlar.length} kayıt · ${bekleyenSiparis.length} sipariş sevkiyat bekliyor`}
      />

      {/* S5 — durum kırılımı */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kutu baslik="Hazırlanıyor" deger={sayi("hazirlaniyor")} />
        <Kutu baslik="Sevk edildi" deger={sayi("sevkedildi")} />
        <Kutu baslik="Teslim edildi" deger={sayi("teslim")} />
        <Kutu baslik="Geciken" deger={geciken} vurgu={geciken > 0} />
      </div>

      {/* Sevkiyat bekleyen onaylı siparişler */}
      {bekleyenSiparis.length > 0 && (
        <div className="card mb-6 border-sky-500/30 bg-sky-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-sky-400">
            Sevkiyat bekleyen onaylı siparişler
          </h3>
          <ul className="divide-y divide-border/40">
            {bekleyenSiparis.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <Link
                    href={`/siparisler/${s.id}`}
                    className="font-mono text-xs font-medium text-foreground hover:text-primary"
                  >
                    {s.no}
                  </Link>
                  <span className="ml-2 text-sm text-muted-foreground">{s.firma.ad}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {s.onayTarihi
                      ? `${beklemeGunu(s.onayTarihi)} gündür bekliyor`
                      : "onaylandı"}
                  </span>
                  <Link href={`/siparisler/${s.id}`} className="btn-secondary h-8 px-3 text-xs">
                    Aç
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
            placeholder="Sevkiyat no, takip no, firma…"
            className="input"
          />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="hazirlaniyor">Hazırlanıyor</option>
            <option value="sevkedildi">Sevk edildi</option>
            <option value="teslim">Teslim edildi</option>
            <option value="iptal">İptal</option>
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
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => (
            <Link
              key={h.anahtar}
              href={`/sevkiyat?bas=${h.bas}&bit=${h.bit}`}
              className="rounded-lg border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {h.etiket}
            </Link>
          ))}
        </div>
      </form>

      {sevkiyatlar.length === 0 ? (
        <EmptyState
          title="Sevkiyat kaydı yok"
          description="Sevkiyat, onaylanmış bir siparişin detay ekranından açılır."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Sevkiyat</th>
                <th className="th">Sipariş</th>
                <th className="th">Firma</th>
                <th className="th">Taşıyıcı / Takip</th>
                <th className="th text-right">Bekleme</th>
                <th className="th">Durum</th>
                {yonetir && <th className="th text-right">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sevkiyatlar.map((s) => {
                const gun = beklemeGunu(
                  s.createdAt,
                  s.teslimTarihi ?? s.sevkTarihi ?? null
                );
                const gecikti = s.durum === "hazirlaniyor" && gun >= 3;
                return (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="td font-mono text-xs">{s.no}</td>
                    <td className="td">
                      <Link
                        href={`/siparisler/${s.siparis.id}`}
                        className="font-mono text-xs text-foreground hover:text-primary"
                      >
                        {s.siparis.no}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatPara(s.siparis.toplam, s.siparis.paraBirimi)}
                      </p>
                    </td>
                    <td className="td">{s.siparis.firma.ad}</td>
                    <td className="td text-xs text-muted-foreground">
                      {s.tasiyici ?? "—"}
                      {s.takipNo && <p className="font-mono">{s.takipNo}</p>}
                    </td>
                    <td className={`td text-right ${gecikti ? "text-amber-400" : ""}`}>
                      {gun} gün
                    </td>
                    <td className="td">
                      <StatusBadge durum={s.durum} />
                    </td>
                    {yonetir && (
                      <td className="td text-right">
                        <DurumDugmeleri id={s.id} durum={s.durum} />
                      </td>
                    )}
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
  baslik,
  deger,
  vurgu,
}: {
  baslik: string;
  deger: number;
  vurgu?: boolean;
}) {
  return (
    <div className={`card p-4 ${vurgu ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{baslik}</p>
      <p className={`mt-1 text-2xl font-semibold ${vurgu ? "text-amber-400" : "text-foreground"}`}>
        {deger}
      </p>
    </div>
  );
}
