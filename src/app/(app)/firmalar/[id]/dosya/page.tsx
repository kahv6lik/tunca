import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant-db";
import { etkinIzinler, IZIN, yetkiGerektir } from "@/lib/yetki";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { formatPara, formatTarih } from "@/lib/format";
import { durumBadge } from "@/lib/constants";
import { firmaTimeline } from "@/lib/timeline";
import { tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import { haritaBaglantisi } from "@/lib/konum-saf";
import YazdirDugmesi from "@/components/YazdirDugmesi";

export const dynamic = "force-dynamic";

/**
 * Firma dosyası — tek belge (Faz 18 / R4).
 *
 * Bir firma için yapılmış HER ŞEYİN tek çıktısı: künye, kontaklar, satış
 * hattı, teklif, sipariş, proje, destek, saha ziyaretleri, yatırım/eğitim/
 * hizmet kayıtları ve zaman akışı. Müşteri toplantısına elde götürülecek
 * belge budur.
 *
 * PDF, tarayıcının yazdırma motoruyla üretilir (Faz 9 / E5'teki aynı karar
 * ve aynı gerekçeler: Türkçe font ve imaj boyutu).
 *
 * İÇERİK İZİN SÜZGECİNDEN GEÇER: izni olmayan modül HİÇ SORGULANMAZ ve
 * belgeye girmez. Yazdırılan bir belge kolayca elden ele dolaşır; kullanıcının
 * ekranda göremediği veri, kâğıda da düşmemelidir.
 *
 * TARİH ARALIĞI isteğe bağlıdır (`?bas=&bit=`): "bu yıl bu müşteriyle ne
 * yaptık" belgesi için. Künye ve kontaklar aralıktan bağımsızdır — firmanın
 * kimliği bir döneme ait değildir.
 */
export default async function FirmaDosyasiPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.firmaGoruntule);

  const { db } = await getTenantContext();
  const izinler = await etkinIzinler();
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const donem = aralik ? { createdAt: aralik } : {};
  const tarihli = aralik ? { tarih: aralik } : {};

  const gorur = (izin: string) => izinler.has(izin);

  const firma = await db.firma.findFirst({
    where: { id: params.id },
    include: {
      kisiler: gorur(IZIN.kisiGoruntule)
        ? { orderBy: [{ birincil: "desc" }, { ad: "asc" }] }
        : false,
    },
  });
  if (!firma) notFound();

  const [
    firsatlar,
    teklifler,
    siparisler,
    projeler,
    destekler,
    ziyaretler,
    yatirimlar,
    egitimler,
    hizmetler,
    akis,
    ayar,
  ] = await Promise.all([
    gorur(IZIN.firsatGoruntule)
      ? db.firsat.findMany({
          where: { firmaId: firma.id, ...donem },
          orderBy: { createdAt: "desc" },
          include: { asama: { select: { ad: true } } },
        })
      : Promise.resolve([]),
    gorur(IZIN.teklifGoruntule)
      ? db.teklif.findMany({
          where: { firmaId: firma.id, ...donem },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.siparisGoruntule)
      ? db.siparis.findMany({
          where: { firmaId: firma.id, ...donem },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.projeGoruntule)
      ? db.proje.findMany({ where: { firmaId: firma.id }, orderBy: { kod: "asc" } })
      : Promise.resolve([]),
    gorur(IZIN.destekGoruntule)
      ? db.destekKaydi.findMany({
          where: { firmaId: firma.id, ...donem },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.ziyaretGoruntule)
      ? db.ziyaret.findMany({
          where: { firmaId: firma.id, ...(aralik ? { baslangic: aralik } : {}) },
          orderBy: { baslangic: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.yatirimGoruntule)
      ? db.yatirimDestegi.findMany({
          where: { firmaId: firma.id, ...tarihli },
          orderBy: { tarih: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.egitimGoruntule)
      ? db.egitim.findMany({
          where: { firmaId: firma.id, ...tarihli },
          orderBy: { tarih: "desc" },
        })
      : Promise.resolve([]),
    gorur(IZIN.hizmetGoruntule)
      ? db.hizmet.findMany({
          where: { firmaId: firma.id, ...tarihli },
          orderBy: { tarih: "desc" },
        })
      : Promise.resolve([]),
    firmaTimeline(db, firma.id, izinler, 60),
    kiraciAyari(),
  ]);

  const renk = ayar.anaRenk || "#6366f1";
  const kisiler = firma.kisiler ?? [];
  const onayliCiro = siparisler
    .filter((s) => s.durum === "onaylandi")
    .reduce((t, s) => t + s.toplam, 0);
  const aralikEtiketi = araliktanEtiket(aralik);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/firmalar/${firma.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Firmaya dön
        </a>
        <YazdirDugmesi />
      </div>

      <article className="yazdir-sayfa rounded-2xl border border-border/60 bg-white p-10 text-slate-900 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header
          className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b-4 pb-6"
          style={{ borderColor: renk }}
        >
          <div className="flex items-center gap-4">
            {ayar.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ayar.logoUrl}
                alt={ayar.ad}
                className="h-14 w-14 rounded-xl object-contain"
              />
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
              <p className="text-sm text-slate-500">Firma Dosyası</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-lg font-bold" style={{ color: renk }}>
              {firma.ad}
            </p>
            {firma.firmaNo && (
              <p className="font-mono text-sm text-slate-500">{firma.firmaNo}</p>
            )}
            <p className="text-sm text-slate-500">
              {aralikEtiketi ?? "Tüm kayıtlar"} · {formatTarih(new Date())}
            </p>
          </div>
        </header>

        {/* Künye — döneme bağlı DEĞİLDİR */}
        <Bolum baslik="Künye" renk={renk}>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Alan etiket="Vergi No" deger={firma.vergiNo} />
            <Alan etiket="Sektör" deger={firma.sektor} />
            <Alan
              etiket="İl / İlçe"
              deger={[firma.il, firma.ilce].filter(Boolean).join(" / ")}
            />
            <Alan etiket="Telefon" deger={firma.telefon} />
            <Alan etiket="E-posta" deger={firma.email} />
            <Alan etiket="Durum" deger={durumBadge(firma.durum).label} />
            <div className="sm:col-span-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Adres
              </dt>
              <dd>{firma.adres || "—"}</dd>
            </div>
            {firma.enlem !== null && firma.boylam !== null && (
              <div className="sm:col-span-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Konum
                </dt>
                <dd className="text-sm">
                  {firma.enlem.toFixed(5)}, {firma.boylam.toFixed(5)}{" "}
                  <span className="text-slate-500">
                    ({haritaBaglantisi(firma.enlem, firma.boylam)})
                  </span>
                </dd>
              </div>
            )}
            {firma.notlar && (
              <div className="sm:col-span-3">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notlar
                </dt>
                <dd className="whitespace-pre-wrap">{firma.notlar}</dd>
              </div>
            )}
          </dl>
        </Bolum>

        {kisiler.length > 0 && (
          <Bolum baslik={`Kontaklar (${kisiler.length})`} renk={renk}>
            <Tablo
              basliklar={["Ad", "Unvan", "Departman", "Telefon", "E-posta"]}
              satirlar={kisiler.map((k) => [
                `${k.ad}${k.birincil ? " ★" : ""}`,
                k.unvan ?? "—",
                k.departman ?? "—",
                k.telefon ?? "—",
                k.email ?? "—",
              ])}
            />
          </Bolum>
        )}

        {firsatlar.length > 0 && (
          <Bolum baslik={`Fırsatlar (${firsatlar.length})`} renk={renk}>
            <Tablo
              basliklar={["Fırsat", "Aşama", "Tutar", "Olasılık", "Durum"]}
              satirlar={firsatlar.map((f) => [
                f.baslik,
                f.asama.ad,
                formatPara(f.tutar, f.paraBirimi),
                `%${f.olasilik}`,
                durumBadge(f.durum).label,
              ])}
            />
          </Bolum>
        )}

        {teklifler.length > 0 && (
          <Bolum baslik={`Teklifler (${teklifler.length})`} renk={renk}>
            <Tablo
              basliklar={["No", "Başlık", "Tutar", "Durum", "Tarih"]}
              satirlar={teklifler.map((t) => [
                t.no,
                t.baslik,
                formatPara(t.toplam, t.paraBirimi),
                durumBadge(t.durum).label,
                formatTarih(t.createdAt),
              ])}
            />
          </Bolum>
        )}

        {siparisler.length > 0 && (
          <Bolum
            baslik={`Siparişler (${siparisler.length})`}
            renk={renk}
            alt={`Onaylı toplam: ${formatPara(Math.round(onayliCiro))}`}
          >
            <Tablo
              basliklar={["No", "Tutar", "Durum", "Tarih"]}
              satirlar={siparisler.map((s) => [
                s.no,
                formatPara(s.toplam, s.paraBirimi),
                durumBadge(s.durum).label,
                formatTarih(s.createdAt),
              ])}
            />
          </Bolum>
        )}

        {projeler.length > 0 && (
          <Bolum baslik={`Projeler (${projeler.length})`} renk={renk}>
            <Tablo
              basliklar={["Kod", "Proje", "Bütçe", "Durum", "Tarih"]}
              satirlar={projeler.map((p) => [
                p.kod,
                p.ad,
                formatPara(p.butce, p.paraBirimi),
                durumBadge(p.durum).label,
                p.baslangic ? formatTarih(p.baslangic) : "—",
              ])}
            />
          </Bolum>
        )}

        {destekler.length > 0 && (
          <Bolum baslik={`Destek Kayıtları (${destekler.length})`} renk={renk}>
            <Tablo
              basliklar={["No", "Konu", "Kanal", "Öncelik", "Durum"]}
              satirlar={destekler.map((d) => [
                d.no,
                d.baslik,
                d.kanal,
                d.oncelik,
                durumBadge(d.durum).label,
              ])}
            />
          </Bolum>
        )}

        {ziyaretler.length > 0 && (
          <Bolum baslik={`Saha Ziyaretleri (${ziyaretler.length})`} renk={renk}>
            <Tablo
              basliklar={["Tarih", "Süre (dk)", "Konum", "Not"]}
              satirlar={ziyaretler.map((z) => [
                formatTarih(z.baslangic),
                z.sureDakika === null ? "—" : String(z.sureDakika),
                z.dogrulama === "dogrulandi"
                  ? "Doğrulandı"
                  : z.dogrulama === "uzak"
                    ? "Uyuşmuyor"
                    : "Doğrulanamadı",
                z.not ?? "—",
              ])}
            />
          </Bolum>
        )}

        {yatirimlar.length > 0 && (
          <Bolum baslik={`Yatırım Destekleri (${yatirimlar.length})`} renk={renk}>
            <Tablo
              basliklar={["Başlık", "Tür", "Tutar", "Durum", "Tarih"]}
              satirlar={yatirimlar.map((y) => [
                y.baslik,
                y.tur ?? "—",
                formatPara(y.tutar, y.paraBirimi),
                durumBadge(y.durum).label,
                formatTarih(y.tarih),
              ])}
            />
          </Bolum>
        )}

        {egitimler.length > 0 && (
          <Bolum baslik={`Eğitimler (${egitimler.length})`} renk={renk}>
            <Tablo
              basliklar={["Başlık", "Eğitmen", "Süre", "Katılımcı", "Tarih"]}
              satirlar={egitimler.map((e) => [
                e.baslik,
                e.egitmen ?? "—",
                `${e.sureSaat} saat`,
                String(e.katilimci),
                formatTarih(e.tarih),
              ])}
            />
          </Bolum>
        )}

        {hizmetler.length > 0 && (
          <Bolum baslik={`Hizmetler (${hizmetler.length})`} renk={renk}>
            <Tablo
              basliklar={["Başlık", "Tür", "Durum", "Tarih"]}
              satirlar={hizmetler.map((h) => [
                h.baslik,
                h.tur ?? "—",
                durumBadge(h.durum).label,
                formatTarih(h.tarih),
              ])}
            />
          </Bolum>
        )}

        {akis.length > 0 && (
          <Bolum baslik="Zaman Akışı" renk={renk} alt="En eski üstte">
            <ul className="space-y-2 text-sm">
              {akis.map((o) => (
                <li key={o.id} className="flex gap-3 border-b border-slate-100 pb-2">
                  <span className="w-24 shrink-0 text-xs text-slate-500">
                    {formatTarih(o.tarih)}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{o.baslik}</span>
                    {o.aciklama && (
                      <span className="block text-xs text-slate-600">{o.aciklama}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Bolum>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Bu belge {ayar.ad} tarafından {formatTarih(new Date())} tarihinde
          oluşturulmuştur. İçerik, belgeyi oluşturan kullanıcının görüntüleme
          yetkisiyle sınırlıdır.
        </footer>
      </article>
    </div>
  );
}

function Bolum({
  baslik,
  alt,
  renk,
  children,
}: {
  baslik: string;
  alt?: string;
  renk: string;
  children: React.ReactNode;
}) {
  return (
    // `break-inside-avoid`: bir bölüm iki sayfaya bölünmesin — baskıda
    // ortasından kesilen tablo okunmaz hâle gelir.
    <section className="mb-7 break-inside-avoid">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b pb-1" style={{ borderColor: renk }}>
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: renk }}>
          {baslik}
        </h2>
        {alt && <span className="text-xs text-slate-500">{alt}</span>}
      </div>
      {children}
    </section>
  );
}

function Alan({ etiket, deger }: { etiket: string; deger?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {etiket}
      </dt>
      <dd>{deger || "—"}</dd>
    </div>
  );
}

function Tablo({
  basliklar,
  satirlar,
}: {
  basliklar: string[];
  satirlar: string[][];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
          {basliklar.map((b) => (
            <th key={b} className="py-1.5 pr-3 font-semibold">{b}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {satirlar.map((s, i) => (
          <tr key={i} className="border-b border-slate-100 align-top">
            {s.map((h, j) => (
              <td key={j} className="py-1.5 pr-3">{h}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
