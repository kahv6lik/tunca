import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { formatPara, formatTarih } from "@/lib/format";
import { durumBadge } from "@/lib/constants";
import YazdirDugmesi from "@/components/YazdirDugmesi";

export const dynamic = "force-dynamic";

/**
 * Teklif PDF çıktısı — Faz 9 / E5.
 *
 * PDF, tarayıcının kendi "Yazdır → PDF olarak kaydet" motoruyla üretilir.
 * Sunucu tarafında PDF kütüphanesi KULLANILMADI ve bu bilinçli bir tercih:
 *
 *   - Sunucu taraflı PDF kütüphaneleri (PDFKit, react-pdf) Türkçe karakter
 *     için gömülü TTF font ister; depoya birkaç yüz KB'lık ikili font dosyası
 *     eklemek gerekirdi. Aksi halde ş/ğ/İ/ı bozuk çıkar.
 *   - Headless tarayıcı (Puppeteer/Playwright) ile üretmek üretim imajına
 *     ~300 MB Chromium ekler.
 *   - Tarayıcının çıktısı zaten gerçek bir PDF'tir, Türkçe karakterler
 *     kusursuzdur ve kullanıcı sayfa boyutunu/kenar boşluğunu kendi seçer.
 *
 * Sayfa `@media print` ile hazırlanmıştır: arayüz kabuğu, düğmeler ve
 * gölgeler baskıda görünmez.
 */
export default async function TeklifYazdirPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await yetkiGerektir(IZIN.teklifGoruntule);
  const { db, session } = await getTenantContext();

  const teklif = await db.teklif.findFirst({
    where: { id: params.id },
    include: {
      firma: true,
      kalemler: {
        orderBy: { sira: "asc" },
        include: { kampanya: { select: { kod: true, ad: true } } },
      },
    },
  });

  if (!teklif) notFound();

  /*
    İndirim tutarı ARTIK İKİ PARÇADIR (v1.23.0): kalemlere uygulanan
    kampanya indirimi + belgeye elle yazılan iskonto. Tek satırda
    "İndirim (%10)" yazmak, kampanyadan gelen tutarı da yüzdeyle
    açıklanmış gibi gösterirdi.
  */
  const kampanyaIndirimi = teklif.kalemler.reduce(
    (s, k) => s + (k.indirimTutari ?? 0),
    0
  );
  const belgeIskontosu = Math.max(teklif.indirimTutari - kampanyaIndirimi, 0);

  // `Teklif.kisiId` bilinçli olarak ilişki değil düz alandır (muhatap
  // silinse bile teklif belgesi ayakta kalmalı); bu yüzden ayrı okunur.
  const kisi = teklif.kisiId
    ? await db.kisi.findFirst({
        where: { id: teklif.kisiId },
        select: { ad: true, unvan: true },
      })
    : null;

  const ayar = await kiraciAyari();
  const renk = ayar.anaRenk || "#6366f1";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Baskıda görünmeyen araç çubuğu */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/teklifler/${teklif.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Teklife dön
        </a>
        <YazdirDugmesi />
      </div>

      <article className="yazdir-sayfa rounded-2xl border border-border/60 bg-white p-10 text-slate-900 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Başlık — kiracı markası */}
        <header
          className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b-4 pb-6"
          style={{ borderColor: renk }}
        >
          <div className="flex items-center gap-4">
            {ayar.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              (<img
                src={ayar.logoUrl}
                alt={ayar.ad}
                className="h-14 w-14 rounded-xl object-contain"
              />)
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{ background: renk }}
              >
                {ayar.ad.slice(0, 2).toLocaleUpperCase("tr")}
              </div>
            )}
            <div>
              <p className="text-xl font-bold">{ayar.ad}</p>
              <p className="text-sm text-slate-500">Teklif Belgesi</p>
            </div>
          </div>

          <div className="text-right">
            <p className="font-mono text-lg font-bold" style={{ color: renk }}>
              {teklif.no}
            </p>
            <p className="text-sm text-slate-500">{formatTarih(teklif.createdAt)}</p>
            <p className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">
              {durumBadge(teklif.durum).label}
              {teklif.revizyonNo > 1 && ` · ${teklif.revizyonNo}. revizyon`}
            </p>
          </div>
        </header>

        {/* Taraflar */}
        <section className="mb-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sayın
            </p>
            <p className="font-semibold">{teklif.firma.ad}</p>
            {kisi && (
              <p className="text-sm text-slate-600">
                {kisi.ad}
                {kisi.unvan && ` — ${kisi.unvan}`}
              </p>
            )}
            {teklif.firma.adres && (
              <p className="mt-1 text-sm text-slate-600">{teklif.firma.adres}</p>
            )}
            {teklif.firma.vergiNo && (
              <p className="text-sm text-slate-600">Vergi No: {teklif.firma.vergiNo}</p>
            )}
          </div>

          <div className="sm:text-right">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Teklif Konusu
            </p>
            <p className="font-semibold">{teklif.baslik}</p>
            {teklif.gecerlilikTarihi && (
              <p className="mt-1 text-sm text-slate-600">
                Geçerlilik: {formatTarih(teklif.gecerlilikTarihi)}
              </p>
            )}
            <p className="text-sm text-slate-600">Hazırlayan: {teklif.olusturanEmail ?? "—"}</p>
          </div>
        </section>

        {/* Kalemler */}
        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: `${renk}14` }}>
              <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                Açıklama
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                Miktar
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                Birim Fiyat
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                Tutar
              </th>
            </tr>
          </thead>
          <tbody>
            {teklif.kalemler.map((k) => (
              <tr key={k.id} className="break-inside-avoid">
                <td className="border-b border-slate-100 px-3 py-2.5">
                  {k.aciklama}
                  {/* Uygulanan kampanya müşteriye giden belgede de yazar:
                      indirimin sebebi görünmeden verilen fiyat savunulamaz. */}
                  {k.kampanya && (
                    <span className="block text-xs text-slate-500">
                      {k.kampanya.ad} ({k.kampanya.kod})
                    </span>
                  )}
                </td>
                <td className="border-b border-slate-100 px-3 py-2.5 text-right">
                  {k.miktar} {k.birim}
                </td>
                <td className="border-b border-slate-100 px-3 py-2.5 text-right">
                  {formatPara(k.birimFiyat, teklif.paraBirimi)}
                </td>
                <td className="border-b border-slate-100 px-3 py-2.5 text-right font-medium">
                  {formatPara(k.tutar, teklif.paraBirimi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Toplamlar */}
        <div className="mb-8 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Satir etiket="Ara toplam" deger={formatPara(teklif.araToplam, teklif.paraBirimi)} />
            {kampanyaIndirimi > 0 && (
              <Satir
                etiket="Kampanya indirimi"
                deger={`- ${formatPara(kampanyaIndirimi, teklif.paraBirimi)}`}
              />
            )}
            {belgeIskontosu > 0 && (
              <Satir
                etiket={`İskonto (%${teklif.indirimOrani})`}
                deger={`- ${formatPara(teklif.indirimTutari, teklif.paraBirimi)}`}
              />
            )}
            <Satir
              etiket={`KDV (%${teklif.kdvOrani})`}
              deger={formatPara(teklif.kdvTutari, teklif.paraBirimi)}
            />
            <div
              className="mt-2 flex items-center justify-between border-t-2 pt-2"
              style={{ borderColor: renk }}
            >
              <dt className="font-bold">Genel Toplam</dt>
              <dd className="text-lg font-bold" style={{ color: renk }}>
                {formatPara(teklif.toplam, teklif.paraBirimi)}
              </dd>
            </div>
          </dl>
        </div>

        {(teklif.sartlar || teklif.notlar) && (
          <section className="mb-8 space-y-4 break-inside-avoid text-sm">
            {teklif.sartlar && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Şartlar
                </p>
                <p className="whitespace-pre-wrap text-slate-700">{teklif.sartlar}</p>
              </div>
            )}
            {teklif.notlar && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notlar
                </p>
                <p className="whitespace-pre-wrap text-slate-700">{teklif.notlar}</p>
              </div>
            )}
          </section>
        )}

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>
            {ayar.ad}
            {session.tenantSlug && ` · ${session.tenantSlug}`} — Bu belge Gezegen CRM
            tarafından {formatTarih(new Date())} tarihinde üretilmiştir.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-600">{etiket}</dt>
      <dd>{deger}</dd>
    </div>
  );
}
