import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { formatPara } from "@/lib/format";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import {
  donemKarsilastir,
  kirilim,
  maliOzet,
  oranMetni,
  oncekiDonem,
  type DonemFarki,
} from "@/lib/rapor-saf";
import { raporBul } from "@/lib/rapor-tanimlar";
import RaporSuzgeci from "@/components/raporlar/RaporSuzgeci";
import RaporBasligi from "@/components/raporlar/RaporBasligi";

export const dynamic = "force-dynamic";

/**
 * Mali rapor — Faz 18 / R2.
 *
 * CİRO = ONAYLANMIŞ SİPARİŞ. Teklif bir niyet, fırsat bir tahmindir; ikisini
 * ciroya saymak rakamı şişirirdi. Onay anı, stok ve kampanya kotasının
 * düştüğü (Faz 15), yani kuruluşun taahhüde girdiği andır.
 *
 * BEKLENEN TAHSİLAT bir TAHMİNDİR ve ekranda öyle etiketlenir: sistemde
 * ödeme/fatura kaydı YOKTUR (karar: v1.18.0). "Kim ne zaman ödedi" sorusu
 * bu raporda yanıtlanmaz; yanıtlanıyormuş gibi göstermek daha kötü olurdu.
 */
export default async function MaliRaporPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.siparisGoruntule);

  const [teklifGorur, firsatGorur] = await Promise.all([
    yetkiVarMi(IZIN.teklifGoruntule),
    yetkiVarMi(IZIN.firsatGoruntule),
  ]);

  const db = await getTenantDb();
  const filtre = { bas: searchParams.bas, bit: searchParams.bit, firma: searchParams.firma };
  const aralik = tarihAraligi(filtre.bas, filtre.bit);
  const onceki = oncekiDonem(aralik);
  const firma = (filtre.firma ?? "").trim();

  const firmaKosulu: Prisma.SiparisWhereInput = firma ? { firmaId: firma } : {};
  const donem = (a?: { gte?: Date; lte?: Date } | null) =>
    a ? { createdAt: a } : {};

  const [
    onayliSiparisler,
    bekleyenSiparisler,
    kabulEdilenTeklifler,
    acikFirsatlar,
    oncekiOnayli,
    kalemler,
    firmalar,
  ] = await Promise.all([
    db.siparis.findMany({
      where: { AND: [{ durum: "onaylandi" }, firmaKosulu, donem(aralik)] },
      select: {
        toplam: true, araToplam: true, indirimTutari: true, createdAt: true,
        firma: { select: { ad: true } },
      },
    }),
    db.siparis.findMany({
      where: { AND: [{ durum: "onaybekliyor" }, firmaKosulu, donem(aralik)] },
      select: { toplam: true },
    }),
    // Kabul edilmiş teklif: müşteri "evet" dedi ama sipariş henüz açılmadı.
    teklifGorur
      ? db.teklif.findMany({
          where: {
            AND: [
              { durum: "kabul" },
              firma ? { firmaId: firma } : {},
              donem(aralik),
            ],
          },
          select: { toplam: true },
        })
      : Promise.resolve([]),
    firsatGorur
      ? db.firsat.findMany({
          where: { AND: [{ durum: "acik" }, firma ? { firmaId: firma } : {}] },
          select: { tutar: true, olasilik: true },
        })
      : Promise.resolve([]),
    // Önceki dönem YALNIZCA kapalı bir aralık seçilmişse hesaplanır.
    onceki
      ? db.siparis.findMany({
          where: { AND: [{ durum: "onaylandi" }, firmaKosulu, { createdAt: onceki }] },
          select: { toplam: true },
        })
      : Promise.resolve([]),
    db.siparisKalemi.findMany({
      where: {
        siparis: { AND: [{ durum: "onaylandi" }, firmaKosulu, donem(aralik)] },
      },
      select: {
        tutar: true,
        miktar: true,
        aciklama: true,
        urun: { select: { ad: true, kategori: true } },
      },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
  ]);

  const ozet = maliOzet({
    onayliSiparisler,
    bekleyenSiparisler,
    kabulEdilenTeklifler,
    acikFirsatlar,
  });

  const oncekiCiro = oncekiOnayli.reduce((t, s) => t + s.toplam, 0);
  const karsilastirma = onceki ? donemKarsilastir(ozet.ciro, Math.round(oncekiCiro)) : null;

  const firmaKirilimi = kirilim(
    onayliSiparisler,
    (s) => s.firma.ad,
    (s) => s.toplam,
    8
  );
  const urunKirilimi = kirilim(
    kalemler,
    (k) => k.urun?.ad ?? k.aciklama,
    (k) => k.tutar,
    8
  );
  const kategoriKirilimi = kirilim(
    kalemler,
    (k) => k.urun?.kategori ?? "Kategorisiz",
    (k) => k.tutar,
    8
  );

  return (
    <div>
      <Link
        href="/raporlar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Rapor Merkezi
      </Link>

      <RaporBasligi baslik="Mali Rapor" donem={araliktanEtiket(aralik)} />

      <RaporSuzgeci
        rapor={raporBul("mali")!}
        filtre={filtre}
        firmalar={firmalar}
        kullanicilar={[]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kutu
          etiket="Ciro (onaylı sipariş)"
          deger={formatPara(ozet.ciro)}
          alt={`${ozet.siparisAdedi} sipariş`}
          fark={karsilastirma}
        />
        <Kutu
          etiket="Beklenen tahsilat"
          deger={formatPara(ozet.beklenenTahsilat)}
          alt="Tahmindir — ödeme kaydı tutulmaz"
        />
        <Kutu
          etiket="Verilen indirim"
          deger={formatPara(ozet.indirim)}
          alt={`Brütün ${oranMetni(ozet.indirimOrani)}'i`}
        />
        <Kutu etiket="Ortalama sipariş" deger={formatPara(ozet.ortalamaSepet)} />
      </div>

      <div className="card mt-4 p-5">
        <h3 className="mb-1 font-semibold tracking-tight text-foreground">
          Beklenen tahsilat neyden oluşuyor?
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Sistemde ödeme/fatura kaydı tutulmaz; bu rakam eldeki veriden
          türetilen bir TAHMİNDİR.
        </p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Satir
            etiket="Onay bekleyen siparişler"
            deger={formatPara(ozet.bekleyen)}
            aciklama="Onaylanınca ciroya geçer"
          />
          <Satir
            etiket="Kabul edilen teklifler"
            deger={formatPara(ozet.kabulEdilenTeklif)}
            aciklama="Müşteri kabul etti, sipariş açılmadı"
          />
          <Satir
            etiket="Açık fırsatlar (ağırlıklı)"
            deger={formatPara(ozet.agirlikliFirsat)}
            aciklama="Tutar × olasılık"
          />
        </dl>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Firma Bazında Ciro" subtitle="Onaylı siparişlerin toplamı">
          {firmaKirilimi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu dönemde onaylı sipariş yok.</p>
          ) : (
            <BarChart data={firmaKirilimi} horizontal format="currency" />
          )}
        </ChartCard>

        <ChartCard title="Ürün Bazında Satış" subtitle="Kalem tutarlarına göre">
          {urunKirilimi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu dönemde satış kalemi yok.</p>
          ) : (
            <BarChart data={urunKirilimi} horizontal format="currency" />
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Kategori Dağılımı" subtitle="Onaylı siparişlerin kalem kategorileri">
          {kategoriKirilimi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu dönemde satış kalemi yok.</p>
          ) : (
            <BarChart data={kategoriKirilimi} format="currency" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/**
 * KPI kutusu.
 *
 * Dönem karşılaştırması YALNIZCA kapalı bir aralık seçildiğinde gösterilir;
 * açık uçlu aralıkta "önceki dönem" diye bir şey yoktur (bkz. `oncekiDonem`).
 */
function Kutu({
  etiket,
  deger,
  alt,
  fark,
}: {
  etiket: string;
  deger: string;
  alt?: string;
  fark?: DonemFarki | null;
}) {
  const Ikon =
    fark?.yon === "artis" ? TrendingUp : fark?.yon === "azalis" ? TrendingDown : Minus;
  const renk =
    fark?.yon === "artis"
      ? "text-emerald-500"
      : fark?.yon === "azalis"
        ? "text-rose-400"
        : "text-muted-foreground";

  return (
    <div className="card p-5">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{deger}</p>
      {fark && (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs ${renk}`}>
          <Ikon className="h-3.5 w-3.5" />
          {fark.yuzde === null
            ? "önceki dönemde kayıt yok"
            : `${fark.yuzde > 0 ? "+" : ""}${fark.yuzde.toLocaleString("tr-TR")}% önceki döneme göre`}
        </p>
      )}
      {alt && !fark && <p className="mt-1 text-xs text-muted-foreground">{alt}</p>}
    </div>
  );
}

function Satir({
  etiket,
  deger,
  aciklama,
}: {
  etiket: string;
  deger: string;
  aciklama: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiket}</dt>
      <dd className="text-lg font-semibold text-foreground">{deger}</dd>
      <p className="text-[11px] text-muted-foreground/70">{aciklama}</p>
    </div>
  );
}
