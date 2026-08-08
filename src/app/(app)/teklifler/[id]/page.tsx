import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import TeklifForm from "@/components/teklifler/TeklifForm";
import TeklifIslemleri from "@/components/teklifler/TeklifIslemleri";
import { formatPara, formatTarih, toDateInput } from "@/lib/format";

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

  const [duzenleyebilir, olusturabilir, silebilir, siparisAcabilir] =
    await Promise.all([
      yetkiVarMi(IZIN.teklifDuzenle),
      yetkiVarMi(IZIN.teklifOlustur),
      yetkiVarMi(IZIN.teklifSil),
      yetkiVarMi(IZIN.siparisOlustur),
    ]);

  const db = await getTenantDb();

  const teklif = await db.teklif.findFirst({
    where: { id: params.id },
    include: {
      firma: { select: { id: true, ad: true } },
      firsat: { select: { id: true, baslik: true } },
      kalemler: { orderBy: { sira: "asc" } },
      ustTeklif: { select: { id: true, no: true, revizyonNo: true } },
      revizyonlar: { select: { id: true, no: true, revizyonNo: true, durum: true } },
    },
  });

  if (!teklif) notFound();

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
                  <th className="th">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {teklif.kalemler.map((k) => (
                  <tr key={k.id}>
                    <td className="td">{k.aciklama}</td>
                    <td className="td">
                      {k.miktar} {k.birim}
                    </td>
                    <td className="td">{formatPara(k.birimFiyat, teklif.paraBirimi)}</td>
                    <td className="td font-medium">{formatPara(k.tutar, teklif.paraBirimi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card ml-auto max-w-sm space-y-2 p-5 text-sm">
            <Satir etiket="Ara toplam" deger={formatPara(teklif.araToplam, teklif.paraBirimi)} />
            <Satir
              etiket={`İndirim (%${teklif.indirimOrani})`}
              deger={`- ${formatPara(teklif.indirimTutari, teklif.paraBirimi)}`}
            />
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
