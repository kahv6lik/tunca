import { PageHeader } from "@/components/layout/page-header";
import YazdirDugmesi from "@/components/YazdirDugmesi";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { formatTarih } from "@/lib/format";

/**
 * Rapor başlığı ve PDF çıktısı — v1.23.0.
 *
 * İKİ BAŞLIK ÇİZER:
 *   1. Ekranda görünen normal sayfa başlığı + "Yazdır / PDF" düğmesi,
 *   2. YALNIZCA BASKIDA görünen künye: kuruluş adı, rapor adı, uygulanan
 *      dönem ve çıktı tarihi.
 *
 * İkincisi şart: baskıda kabuk (sol menü, üst çubuk) ve süzgeç formu
 * gizlenir, dolayısıyla kâğıda düşen sayfada hangi kuruluşun hangi dönemine
 * ait olduğu YAZMAZ. Elden ele dolaşan bir çıktıda bu bilgi olmadan rakamlar
 * anlamsızdır — firma dosyasındaki (Faz 18 / R4) aynı gerekçe.
 *
 * PDF, tarayıcının yazdırma motoruyla üretilir (Faz 9 / E5 kararı): sunucuya
 * PDF kütüphanesi ya da headless tarayıcı eklenmez, Türkçe karakterler
 * kusursuz çıkar.
 */
export default async function RaporBasligi({
  baslik,
  donem,
  ek,
}: {
  baslik: string;
  /** Uygulanan tarih aralığının okunur hâli; yoksa "Tüm zamanlar". */
  donem?: string | null;
  /** Başlığın sağında duracak ek düğmeler (dışa aktarım gibi). */
  ek?: React.ReactNode;
}) {
  const ayar = await kiraciAyari();
  const donemMetni = donem ?? "Tüm zamanlar";

  return (
    <>
      <PageHeader
        title={baslik}
        subtitle={donemMetni}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {ek}
            <YazdirDugmesi />
          </div>
        }
      />

      {/* Yalnızca baskıda: çıktının künyesi. */}
      <div className="hidden print:mb-6 print:block">
        <p className="text-lg font-semibold">{ayar.ad}</p>
        <h1 className="mt-1 text-2xl font-bold">{baslik}</h1>
        <p className="mt-1 text-sm">
          Dönem: {donemMetni} · Çıktı tarihi: {formatTarih(new Date())}
        </p>
      </div>
    </>
  );
}
