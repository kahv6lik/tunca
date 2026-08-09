import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi, etkinIzinler } from "@/lib/yetki";
import { zinciriKur } from "@/lib/zincir";
import { PageHeader } from "@/components/layout/page-header";
import ZincirSeridi from "@/components/zincir/ZincirSeridi";
import { StatusBadge } from "@/components/ui/badge";
import { formatPara, formatTarih } from "@/lib/format";
import OnayPanel from "@/components/siparisler/OnayPanel";
import SevkiyatPanel from "@/components/siparisler/SevkiyatPanel";
import { sevkiyatAcilabilirMi } from "@/lib/siparis";
import EkPaneli from "@/components/ekler/EkPaneli";

export const dynamic = "force-dynamic";

/**
 * Sipariş detayı — Faz 15 / S1, S3, S4.
 *
 * Sevkiyat bölümü, siparişin durumu ne olursa olsun GÖRÜNÜR; ama sevkiyat
 * AÇMA düğmesi yalnızca onaylanmış siparişte çıkar ve gerekçesi ekranda
 * yazılıdır. Düğmeyi gizlemek koruma değildir — asıl kontrol action'ın
 * içindedir (`sevkiyatAcilabilirMi`).
 */
export default async function SiparisDetayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.siparisGoruntule);

  const [
    onaylayabilir, duzenleyebilir, sevkiyatYonetir, sevkiyatGorur,
    ekGorur, ekYukler, ekSiler,
  ] = await Promise.all([
    yetkiVarMi(IZIN.siparisOnayla),
    yetkiVarMi(IZIN.siparisDuzenle),
    yetkiVarMi(IZIN.sevkiyatYonet),
    yetkiVarMi(IZIN.sevkiyatGoruntule),
    yetkiVarMi(IZIN.dosyaGoruntule),
    yetkiVarMi(IZIN.dosyaYukle),
    yetkiVarMi(IZIN.dosyaSil),
  ]);

  const db = await getTenantDb();

  const siparis = await db.siparis.findFirst({
    where: { id: params.id },
    include: {
      firma: { select: { id: true, ad: true, firmaNo: true, adres: true } },
      kisi: { select: { ad: true } },
      teklif: { select: { id: true, no: true } },
      kalemler: {
        orderBy: { sira: "asc" },
        include: {
          urun: { select: { kod: true, stokTakibi: true, stokMiktar: true } },
          kampanya: { select: { kod: true, ad: true } },
        },
      },
      sevkiyatlar: { orderBy: { createdAt: "desc" } },
      // İmzalı sipariş formu, irsaliye görüntüsü (Faz 17 / A1).
      ekler: ekGorur ? { orderBy: { createdAt: "desc" as const } } : (false as const),
    },
  });

  if (!siparis) notFound();

  // İlişkili kayıt zinciri (Faz 20 / U4) — izni olmayan halka sorgulanmaz.
  const zincir = await zinciriKur(db, { tur: "siparis", id: siparis.id }, await etkinIzinler());

  const kullanicilar = await db.user.findMany({ select: { id: true, name: true } });
  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));

  const kapi = sevkiyatAcilabilirMi(siparis.durum);

  return (
    <div>
      <Link
        href="/siparisler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Siparişler
      </Link>

      <PageHeader
        title={siparis.no}
        subtitle={`${siparis.firma.ad} · ${formatTarih(siparis.createdAt)}`}
        action={
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge durum={siparis.durum} />
              {duzenleyebilir && siparis.durum !== "onaylandi" && siparis.durum !== "iptal" && (
                <Link
                  href={`/siparisler/${siparis.id}/duzenle`}
                  className="btn-secondary text-sm"
                >
                  Düzenle
                </Link>
              )}
            </div>
            {onaylayabilir && <OnayPanel siparisId={siparis.id} durum={siparis.durum} />}
          </div>
        }
      />

      {/* Ret gerekçesi */}
      {siparis.durum === "reddedildi" && siparis.redSebebi && (
        <div className="card mb-6 border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-sm font-medium text-rose-400">Ret gerekçesi</p>
          <p className="mt-1 text-sm text-muted-foreground">{siparis.redSebebi}</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Bilgi
              etiket="Firma"
              deger={
                <Link href={`/firmalar/${siparis.firma.id}`} className="hover:text-primary">
                  {siparis.firma.firmaNo ? `${siparis.firma.firmaNo} · ` : ""}
                  {siparis.firma.ad}
                </Link>
              }
            />
            <Bilgi etiket="Muhatap" deger={siparis.kisi?.ad ?? "—"} />
            <Bilgi
              etiket="Kaynak teklif"
              deger={
                siparis.teklif ? (
                  <Link href={`/teklifler/${siparis.teklif.id}`} className="hover:text-primary">
                    {siparis.teklif.no}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Bilgi
              etiket="Oluşturan"
              deger={siparis.olusturanId ? adOf.get(siparis.olusturanId) ?? "—" : "—"}
            />
            <Bilgi
              etiket="Onaylayan"
              deger={siparis.onaylayanId ? adOf.get(siparis.onaylayanId) ?? "—" : "—"}
            />
            <Bilgi
              etiket="Onay tarihi"
              deger={siparis.onayTarihi ? formatTarih(siparis.onayTarihi) : "—"}
            />
            {siparis.notlar && (
              <div className="sm:col-span-2">
                <Bilgi etiket="Notlar" deger={siparis.notlar} />
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <dl className="space-y-1 text-sm">
            <Toplam etiket="Ara toplam" deger={formatPara(siparis.araToplam, siparis.paraBirimi)} />
            <Toplam etiket="İndirim" deger={`− ${formatPara(siparis.indirimTutari, siparis.paraBirimi)}`} />
            <Toplam etiket="KDV" deger={formatPara(siparis.kdvTutari, siparis.paraBirimi)} />
            <div className="border-t border-border/60 pt-1">
              <Toplam
                etiket="Genel toplam"
                deger={formatPara(siparis.toplam, siparis.paraBirimi)}
                kalin
              />
            </div>
          </dl>
        </div>
      </div>

      {/* İlişkili kayıt zinciri (Faz 20 / U4) */}
      <ZincirSeridi halkalar={zincir} />

      {/* Kalemler */}
      <div className="card mb-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-border/60">
          <thead className="bg-muted/30">
            <tr>
              <th className="th">Açıklama</th>
              <th className="th text-right">Miktar</th>
              <th className="th text-right">Birim Fiyat</th>
              <th className="th">Kampanya</th>
              <th className="th text-right">İndirim</th>
              <th className="th text-right">Net Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {siparis.kalemler.map((k) => (
              <tr key={k.id} className="hover:bg-muted/40">
                <td className="td">
                  {k.aciklama}
                  {k.urun?.kod && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {k.urun.kod}
                    </span>
                  )}
                  {/* Onay öncesi stok uyarısı — yönetici karar verirken görsün. */}
                  {siparis.durum === "onaybekliyor" &&
                    k.urun?.stokTakibi &&
                    k.urun.stokMiktar < k.miktar && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        stok {k.urun.stokMiktar}
                      </span>
                    )}
                </td>
                <td className="td text-right">{k.miktar} {k.birim}</td>
                <td className="td text-right">{formatPara(k.birimFiyat, siparis.paraBirimi)}</td>
                <td className="td text-xs text-muted-foreground">
                  {k.kampanya ? `${k.kampanya.kod}` : "—"}
                </td>
                <td className="td text-right text-emerald-500">
                  {k.indirimTutari > 0 ? `− ${formatPara(k.indirimTutari, siparis.paraBirimi)}` : "—"}
                </td>
                <td className="td text-right font-medium">
                  {formatPara(k.tutar, siparis.paraBirimi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sevkiyat (S4) */}
      {sevkiyatGorur && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Sevkiyatlar</h3>
            {sevkiyatYonetir && kapi.ok && (
              <SevkiyatPanel
                siparisId={siparis.id}
                varsayilanAdres={siparis.firma.adres ?? ""}
              />
            )}
          </div>

          {!kapi.ok && (
            <p className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {kapi.hata}
            </p>
          )}

          {siparis.sevkiyatlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz sevkiyat kaydı yok.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {siparis.sevkiyatlar.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <span className="font-mono text-xs text-foreground">{s.no}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {s.tasiyici ?? "—"}
                      {s.takipNo ? ` · ${s.takipNo}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {s.sevkTarihi ? formatTarih(s.sevkTarihi) : formatTarih(s.createdAt)}
                    </span>
                    <StatusBadge durum={s.durum} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ekGorur && (
        <div className="card mt-6 p-5">
          <EkPaneli
            bag={{ siparisId: siparis.id }}
            ekler={(siparis.ekler ?? []).map((d) => ({
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
    </div>
  );
}

function Bilgi({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiket}</dt>
      <dd className="text-foreground">{deger}</dd>
    </div>
  );
}

function Toplam({
  etiket,
  deger,
  kalin,
}: {
  etiket: string;
  deger: string;
  kalin?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${kalin ? "font-semibold text-foreground" : "text-muted-foreground"}`}
    >
      <dt>{etiket}</dt>
      <dd>{deger}</dd>
    </div>
  );
}
