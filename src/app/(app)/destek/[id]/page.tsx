import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { formatTarih } from "@/lib/format";
import { DESTEK_KANAL, AKTIVITE_TUR } from "@/lib/constants";
import { cozumSuresiSaat, sureMetni } from "@/lib/destek-tanimlar";
import DestekPanel from "@/components/destek/DestekPanel";
import DestekDurumDugmeleri from "@/components/destek/DestekDurumDugmeleri";
import OncelikRozet from "@/components/destek/OncelikRozet";
import IslemFormu from "@/components/destek/IslemFormu";
import DeleteButton from "@/components/DeleteButton";
import { destekSil } from "../actions";

export const dynamic = "force-dynamic";

const KANAL_ETIKET = new Map<string, string>(DESTEK_KANAL.map((k) => [k.deger, k.etiket]));
const TUR_ETIKET = new Map<string, string>(AKTIVITE_TUR.map((t) => [t.deger, t.etiket]));

/**
 * Destek kaydı detayı — Faz 16 / P2.
 *
 * İşlem geçmişi KRONOLOJİKTİR (en eski üstte): bir destek kaydı bir hikâyedir,
 * baştan okunur (v1.11.1'de zaman akışı için verilen aynı karar).
 */
export default async function DestekDetayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.destekGoruntule);

  const [duzenler, siler, projeGorur, sssGorur] = await Promise.all([
    yetkiVarMi(IZIN.destekDuzenle),
    yetkiVarMi(IZIN.destekSil),
    yetkiVarMi(IZIN.projeGoruntule),
    yetkiVarMi(IZIN.sssGoruntule),
  ]);

  const db = await getTenantDb();

  const kayit = await db.destekKaydi.findFirst({
    where: { id: params.id },
    include: {
      firma: { select: { id: true, ad: true, firmaNo: true } },
      kisi: { select: { id: true, ad: true } },
      proje: { select: { id: true, kod: true, ad: true } },
      islemler: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!kayit) notFound();

  const [firmalar, kisiler, projeler, kullanicilar] = await Promise.all([
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.kisi.findMany({
      where: { firmaId: kayit.firmaId },
      orderBy: { ad: "asc" },
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

  const adOf = new Map(kullanicilar.map((u) => [u.id, u.name]));
  const sure = cozumSuresiSaat(kayit);

  return (
    <div>
      <Link
        href="/destek"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Destek Kayıtları
      </Link>

      <PageHeader
        title={kayit.baslik}
        subtitle={`${kayit.no} · ${kayit.firma.ad}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OncelikRozet oncelik={kayit.oncelik} />
            <StatusBadge durum={kayit.durum} />
            {duzenler && (
              <DestekPanel
                firmalar={firmalar}
                kisiler={kisiler}
                projeler={projeler}
                kullanicilar={kullanicilar}
                mevcut={{
                  id: kayit.id,
                  firmaId: kayit.firmaId,
                  kisiId: kayit.kisiId ?? "",
                  projeId: kayit.projeId ?? "",
                  baslik: kayit.baslik,
                  aciklama: kayit.aciklama ?? "",
                  kanal: kayit.kanal,
                  oncelik: kayit.oncelik,
                  durum: kayit.durum,
                  atananId: kayit.atananId ?? "",
                }}
              />
            )}
            {siler && (
              <DeleteButton
                action={destekSil.bind(null, kayit.id)}
                label="Kaydı Sil"
                confirmText="Destek kaydı ve işlem geçmişi silinecek. Onaylıyor musunuz?"
              />
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Firma</dt>
              <dd>
                <Link href={`/firmalar/${kayit.firma.id}`} className="hover:text-primary">
                  {kayit.firma.firmaNo ? `${kayit.firma.firmaNo} · ` : ""}
                  {kayit.firma.ad}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bildiren</dt>
              <dd className="text-foreground">{kayit.kisi?.ad ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kanal</dt>
              <dd className="text-foreground">
                {KANAL_ETIKET.get(kayit.kanal) ?? kayit.kanal}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Atanan</dt>
              <dd className="text-foreground">
                {kayit.atananId ? adOf.get(kayit.atananId) ?? "—" : "Atanmamış"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Açan</dt>
              <dd className="text-foreground">
                {kayit.acanId ? adOf.get(kayit.acanId) ?? "—" : "—"}
              </dd>
            </div>
            {kayit.proje && (
              <div>
                <dt className="text-xs text-muted-foreground">Proje</dt>
                <dd>
                  <Link href={`/projeler/${kayit.proje.id}`} className="hover:text-primary">
                    {kayit.proje.kod} — {kayit.proje.ad}
                  </Link>
                </dd>
              </div>
            )}
            {kayit.aciklama && (
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted-foreground">Açıklama</dt>
                <dd className="whitespace-pre-wrap text-foreground">{kayit.aciklama}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <p className="text-xs text-muted-foreground">Açılış</p>
          <p className="text-foreground">{formatTarih(kayit.createdAt)}</p>
          <p className="mt-3 text-xs text-muted-foreground">Çözüm</p>
          <p className="text-foreground">
            {kayit.cozumTarihi ? formatTarih(kayit.cozumTarihi) : "—"}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Çözüm süresi</p>
          <p className="text-lg font-semibold text-foreground">{sureMetni(sure)}</p>
          {kayit.kapanisTarihi && (
            <p className="mt-3 text-xs text-muted-foreground">
              Kapanış: {formatTarih(kayit.kapanisTarihi)}
            </p>
          )}
        </div>
      </div>

      {duzenler && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Durum</h3>
            <DestekDurumDugmeleri id={kayit.id} durum={kayit.durum} />
          </div>
          {sssGorur && (
            /**
             * Bilgi bankasına hızlı erişim (P4): kaydın KONUSU arama terimi
             * olarak taşınır. Boş bir SSS ekranı açmak, temsilciyi aramayı
             * elle yazmaya zorlardı — asıl kazanç aynı soruya ikinci kez
             * cevap yazmamaktır.
             */
            <Link
              href={`/sss?ara=${encodeURIComponent(kayit.baslik)}`}
              className="btn-secondary h-8 px-2.5 text-xs"
            >
              <BookOpen className="h-3.5 w-3.5" /> SSS&apos;de ara
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Yapılan İşlemler ({kayit.islemler.length})
          </h3>
          {kayit.islemler.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz işlem girilmedi. Yapılan her adım burada kayda geçer ve firma
              zaman akışında da görünür.
            </p>
          ) : (
            <ol className="space-y-3">
              {kayit.islemler.map((i) => (
                <li key={i.id} className="border-l-2 border-border/60 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{i.baslik}</span>
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {TUR_ETIKET.get(i.tur) ?? i.tur}
                    </span>
                  </div>
                  {i.aciklama && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {i.aciklama}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTarih(i.createdAt)}
                    {i.olusturanId ? ` · ${adOf.get(i.olusturanId) ?? i.olusturanEmail ?? ""}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {duzenler && (
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">İşlem Ekle</h3>
            <IslemFormu destekId={kayit.id} />
          </div>
        )}
      </div>
    </div>
  );
}
