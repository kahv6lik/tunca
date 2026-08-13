import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi, etkinIzinler } from "@/lib/yetki";
import { zinciriKur } from "@/lib/zincir";
import { PageHeader } from "@/components/layout/page-header";
import ZincirSeridi from "@/components/zincir/ZincirSeridi";
import { StatusBadge } from "@/components/ui/badge";
import TeklifForm from "@/components/teklifler/TeklifForm";
import TeklifIslemleri from "@/components/teklifler/TeklifIslemleri";
import { formatPara, formatTarih, toDateInput } from "@/lib/format";
import EkPaneli from "@/components/ekler/EkPaneli";
import { kampanyaIstemcisi, kampanyaKatalogu } from "@/lib/kampanya";
import { paketIstemcisi, paketKatalogu } from "@/lib/paket";

export const dynamic = "force-dynamic";

/**
 * Teklif detayı (Faz 7 / C7).
 *
 * Revize edilmiş (`revizyon`) bir sürüm SALT OKUNURDUR: form yerine dondurulmuş
 * kalemler gösterilir. Geçmiş bir sürümü düzenleyebilmek, revizyon zincirinin
 * anlamını ortadan kaldırırdı.
 */
export default async function TeklifDetayPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await yetkiGerektir(IZIN.teklifGoruntule);

  const [
    duzenleyebilir, olusturabilir, silebilir, siparisAcabilir,
    ekGorur, ekYukler, ekSiler,
  ] = await Promise.all([
    yetkiVarMi(IZIN.teklifDuzenle),
    yetkiVarMi(IZIN.teklifOlustur),
    yetkiVarMi(IZIN.teklifSil),
    yetkiVarMi(IZIN.siparisOlustur),
    yetkiVarMi(IZIN.dosyaGoruntule),
    yetkiVarMi(IZIN.dosyaYukle),
    yetkiVarMi(IZIN.dosyaSil),
  ]);

  const db = await getTenantDb();

  const teklif = await db.teklif.findFirst({
    where: { id: params.id },
    include: {
      firma: { select: { id: true, ad: true } },
      firsat: { select: { id: true, baslik: true } },
      kalemler: {
        orderBy: { sira: "asc" },
        include: {
          kampanya: { select: { kod: true, ad: true } },
          // Paket damgası (v1.25.0) belgede de görünür: birim fiyat liste
          // fiyatından farklıysa müşteriye de sebebi gösterilir.
          paket: { select: { kod: true, ad: true } },
        },
      },
      ustTeklif: { select: { id: true, no: true, revizyonNo: true } },
      revizyonlar: { select: { id: true, no: true, revizyonNo: true, durum: true } },
      // Müşterinin imzalayıp geri gönderdiği teklif belgesi (Faz 17 / A1).
      ekler: ekGorur ? { orderBy: { createdAt: "desc" as const } } : (false as const),
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

  // İlişkili kayıt zinciri (Faz 20 / U4) — izni olmayan halka sorgulanmaz.
  const zincir = await zinciriKur(db, { tur: "teklif", id: teklif.id }, await etkinIzinler());

  const [firmalar, firsatlar, kisiler] = await Promise.all([
    db.firma.findMany({ orderBy: { ad: "asc" }, take: 500, select: { id: true, ad: true } }),
    db.firsat.findMany({
      where: { firmaId: teklif.firmaId },
      orderBy: { createdAt: "desc" },
      select: { id: true, baslik: true },
    }),
    db.kisi.findMany({
      where: { firmaId: teklif.firmaId },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
  ]);

  const dondurulmus = teklif.durum === "revizyon";
  const duzenlenebilir = duzenleyebilir && !dondurulmus;


  /*
    Ürün kataloğu ve kampanya kataloğu (v1.23.0).

    Kampanyalar KAPSAMIYLA gönderilir; süzme formda satır satır yapılır —
    sunucuda bir kez süzmek yanlış olurdu, çünkü ilk çizimde firma ve ürün
    henüz seçilmemiştir. İzni olmayan modül HİÇ sorgulanmaz.
  */
  const urunGorur = await yetkiVarMi(IZIN.urunGoruntule);
  const [urunler, kampanyalar, paketler] = await Promise.all([
    urunGorur
      ? db.urun.findMany({
          where: { durum: "aktif" },
          orderBy: { ad: "asc" },
          take: 500,
          select: { id: true, kod: true, ad: true, birim: true, listeFiyat: true, kdvOrani: true },
        })
      : Promise.resolve([]),
    (await yetkiVarMi(IZIN.kampanyaGoruntule))
      ? kampanyaKatalogu(kampanyaIstemcisi(db))
      : Promise.resolve([]),
    /*
      Paket kataloğu KAPSAMIYLA verilir; süzme istemcide yapılır (v1.25.0) —
      kampanyadaki gerekçenin aynısı: seçili firma kullanıcı yazdıkça
      değişir, sunucuda bir kez süzmek firmaya özel her paketi düşürürdü.
      Paket katalogun bir türevidir, izni de katalog iznidir.
    */
    urunGorur ? paketKatalogu(paketIstemcisi(db)) : Promise.resolve([]),
  ]);

  return (
    <div>
      <Link
        href="/teklifler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Teklifler
      </Link>

      <PageHeader
        title={`${teklif.no} — ${teklif.baslik}`}
        subtitle={`${teklif.firma.ad} · ${formatPara(teklif.toplam, teklif.paraBirimi)}${
          teklif.revizyonNo > 1 ? ` · ${teklif.revizyonNo}. revizyon` : ""
        }`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge durum={teklif.durum} />
            <TeklifIslemleri
              id={teklif.id}
              no={teklif.no}
              durum={teklif.durum}
              duzenleyebilir={duzenleyebilir}
              olusturabilir={olusturabilir}
              silebilir={silebilir}
              siparisAcabilir={siparisAcabilir}
            />
          </div>
        }
      />

      {/* İlişkili kayıt zinciri (Faz 20 / U4) */}
      <ZincirSeridi halkalar={zincir} />

      {/* Revizyon zinciri */}
      {(teklif.ustTeklif || teklif.revizyonlar.length > 0) && (
        <div className="card mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 p-4 text-sm">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Revizyon zinciri:</span>
          {teklif.ustTeklif && (
            <Link
              href={`/teklifler/${teklif.ustTeklif.id}`}
              className="rounded-lg border border-border/60 px-2 py-1 font-mono text-xs hover:border-primary/50 hover:text-primary"
            >
              ← {teklif.ustTeklif.no}
            </Link>
          )}
          <span className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
            {teklif.no} (bu sürüm)
          </span>
          {teklif.revizyonlar.map((r) => (
            <Link
              key={r.id}
              href={`/teklifler/${r.id}`}
              className="rounded-lg border border-border/60 px-2 py-1 font-mono text-xs hover:border-primary/50 hover:text-primary"
            >
              {r.no} →
            </Link>
          ))}
        </div>
      )}

      {dondurulmus && (
        <div className="card mb-6 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
          Bu sürüm revize edildiği için <strong>salt okunurdur</strong>. Değişiklikleri
          yeni revizyon üzerinde yapın — böylece hangi rakamın görüşüldüğü kayıtlı kalır.
        </div>
      )}

      {duzenlenebilir ? (
        <TeklifForm
          firmalar={firmalar}
          firsatlar={firsatlar.map((f) => ({ id: f.id, ad: f.baslik }))}
          kisiler={kisiler}
          urunler={urunler}
          kampanyalar={kampanyalar}
        paketler={paketler}
          mevcut={{
            id: teklif.id,
            firmaId: teklif.firmaId,
            firsatId: teklif.firsatId ?? "",
            kisiId: teklif.kisiId ?? "",
            no: teklif.no,
            baslik: teklif.baslik,
            durum: teklif.durum,
            paraBirimi: teklif.paraBirimi,
            indirimOrani: teklif.indirimOrani,
            kdvOrani: teklif.kdvOrani,
            gecerlilikTarihi: teklif.gecerlilikTarihi
              ? toDateInput(teklif.gecerlilikTarihi)
              : "",
            notlar: teklif.notlar ?? "",
            sartlar: teklif.sartlar ?? "",
            kalemler: teklif.kalemler.map((k) => ({
              aciklama: k.aciklama,
              miktar: k.miktar,
              birim: k.birim,
              birimFiyat: k.birimFiyat,
              urunId: k.urunId ?? "",
              paketId: k.paketId ?? "",
              paketAdedi: k.paketAdedi ?? 0,
              kampanyaId: k.kampanyaId ?? "",
            })),
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60">
              <thead className="bg-muted/30">
                <tr>
                  <th className="th">Açıklama</th>
                  <th className="th">Miktar</th>
                  <th className="th">Birim Fiyat</th>
                  <th className="th">Kampanya</th>
                  <th className="th">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {teklif.kalemler.map((k) => (
                  <tr key={k.id}>
                    <td className="td">
                      {k.aciklama}
                      {k.paket && (
                        <span className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-500">
                          {k.paket.kod} paketi
                        </span>
                      )}
                    </td>
                    <td className="td">
                      {k.miktar} {k.birim}
                    </td>
                    <td className="td">{formatPara(k.birimFiyat, teklif.paraBirimi)}</td>
                    <td className="td">
                      {k.kampanya ? (
                        <span className="text-emerald-500">
                          {k.kampanya.kod}
                          <span className="ml-1 text-xs">
                            (-{formatPara(k.indirimTutari, teklif.paraBirimi)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="td font-medium">{formatPara(k.tutar, teklif.paraBirimi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card ml-auto max-w-sm space-y-2 p-5 text-sm">
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
                deger={`- ${formatPara(belgeIskontosu, teklif.paraBirimi)}`}
              />
            )}
            <Satir
              etiket={`KDV (%${teklif.kdvOrani})`}
              deger={formatPara(teklif.kdvTutari, teklif.paraBirimi)}
            />
            <div className="border-t border-border/60 pt-2">
              <Satir
                etiket="Genel toplam"
                deger={formatPara(teklif.toplam, teklif.paraBirimi)}
                kalin
              />
            </div>
          </div>

          {(teklif.notlar || teklif.sartlar) && (
            <div className="card grid gap-4 p-5 sm:grid-cols-2">
              {teklif.notlar && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground/70">
                    Notlar
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{teklif.notlar}</p>
                </div>
              )}
              {teklif.sartlar && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground/70">
                    Şartlar
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{teklif.sartlar}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {ekGorur && (
        <div className="card mt-6 p-5">
          <EkPaneli
            bag={{ teklifId: teklif.id }}
            ekler={(teklif.ekler ?? []).map((d) => ({
              id: d.id,
              ad: d.ad,
              mimeTuru: d.mimeTuru,
              boyut: d.boyut,
              yukleyen: d.yukleyenEmail,
              tarih: formatTarih(d.createdAt),
            }))}
            yukleyebilir={ekYukler}
            silebilir={ekSiler}
          />
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Oluşturan: {teklif.olusturanEmail ?? "—"} · {formatTarih(teklif.createdAt)}
        {teklif.gonderimTarihi && ` · Gönderim: ${formatTarih(teklif.gonderimTarihi)}`}
      </p>
    </div>
  );
}

function Satir({ etiket, deger, kalin }: { etiket: string; deger: string; kalin?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={kalin ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {etiket}
      </span>
      <span className={kalin ? "text-base font-bold text-foreground" : "text-foreground"}>
        {deger}
      </span>
    </div>
  );
}
