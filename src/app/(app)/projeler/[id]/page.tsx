import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { formatPara, formatTarih, toDateInput } from "@/lib/format";
import ProjePanel from "@/components/projeler/ProjePanel";
import DeleteButton from "@/components/DeleteButton";
import { projeSil } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Proje detayı — Faz 16 / P1.
 *
 * Projeye bağlı teklif, sipariş ve destek kayıtları burada toplanır; ilgili
 * modülün İZNİ yoksa o bölüm hiç SORGULANMAZ (timeline'daki kural).
 */
export default async function ProjeDetayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.projeGoruntule);

  const [duzenler, siler, teklifGorur, siparisGorur, destekGorur, teklifAcar, siparisAcar] =
    await Promise.all([
      yetkiVarMi(IZIN.projeDuzenle),
      yetkiVarMi(IZIN.projeSil),
      yetkiVarMi(IZIN.teklifGoruntule),
      yetkiVarMi(IZIN.siparisGoruntule),
      yetkiVarMi(IZIN.destekGoruntule),
      yetkiVarMi(IZIN.teklifOlustur),
      yetkiVarMi(IZIN.siparisOlustur),
    ]);

  const db = await getTenantDb();

  const proje = await db.proje.findFirst({
    where: { id: params.id },
    include: {
      firma: { select: { id: true, ad: true, firmaNo: true } },
      teklifler: teklifGorur
        ? { orderBy: { createdAt: "desc" }, select: { id: true, no: true, baslik: true, durum: true, toplam: true, paraBirimi: true } }
        : false,
      siparisler: siparisGorur
        ? { orderBy: { createdAt: "desc" }, select: { id: true, no: true, durum: true, toplam: true, paraBirimi: true, createdAt: true } }
        : false,
      destekler: destekGorur
        ? { orderBy: { createdAt: "desc" }, select: { id: true, no: true, baslik: true, durum: true, oncelik: true } }
        : false,
    },
  });

  if (!proje) notFound();

  const [firmalar, kullanicilar] = await Promise.all([
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    db.user.findMany({
      where: { durum: "aktif" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const teklifler = proje.teklifler ?? [];
  const siparisler = proje.siparisler ?? [];
  const destekler = proje.destekler ?? [];

  // Gerçekleşen: onaylanmış siparişlerin toplamı — bütçeyle karşılaştırılır.
  const gerceklesen = siparisler
    .filter((s) => s.durum === "onaylandi")
    .reduce((t, s) => t + s.toplam, 0);
  const doluluk = proje.butce > 0 ? Math.min((gerceklesen / proje.butce) * 100, 100) : 0;

  return (
    <div>
      <Link
        href="/projeler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Projeler
      </Link>

      <PageHeader
        title={proje.ad}
        subtitle={`${proje.kod} · ${proje.firma.ad}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge durum={proje.durum} />
            {duzenler && (
              <ProjePanel
                firmalar={firmalar}
                kullanicilar={kullanicilar}
                mevcut={{
                  id: proje.id,
                  kod: proje.kod,
                  ad: proje.ad,
                  aciklama: proje.aciklama ?? "",
                  firmaId: proje.firmaId,
                  sorumluId: proje.sorumluId ?? "",
                  durum: proje.durum,
                  baslangic: proje.baslangic ? toDateInput(proje.baslangic) : "",
                  bitis: proje.bitis ? toDateInput(proje.bitis) : "",
                  butce: proje.butce,
                  paraBirimi: proje.paraBirimi,
                }}
              />
            )}
            {siler && (
              <DeleteButton
                action={projeSil.bind(null, proje.id)}
                label="Projeyi Sil"
                confirmText="Proje silinecek; bağlı teklif, sipariş ve destek kayıtları SİLİNMEZ, yalnızca bağları kopar. Onaylıyor musunuz?"
              />
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Firma</dt>
              <dd>
                <Link href={`/firmalar/${proje.firma.id}`} className="hover:text-primary">
                  {proje.firma.firmaNo ? `${proje.firma.firmaNo} · ` : ""}
                  {proje.firma.ad}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sorumlu</dt>
              <dd className="text-foreground">
                {proje.sorumluId
                  ? kullanicilar.find((u) => u.id === proje.sorumluId)?.name ?? "—"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Başlangıç</dt>
              <dd className="text-foreground">
                {proje.baslangic ? formatTarih(proje.baslangic) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bitiş</dt>
              <dd className="text-foreground">
                {proje.bitis ? formatTarih(proje.bitis) : "—"}
              </dd>
            </div>
            {proje.aciklama && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Açıklama</dt>
                <dd className="text-foreground">{proje.aciklama}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <p className="text-xs text-muted-foreground">Bütçe</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatPara(proje.butce, proje.paraBirimi)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Onaylı siparişler: {formatPara(gerceklesen, proje.paraBirimi)}
          </p>
          {proje.butce > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${doluluk >= 100 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${doluluk}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {teklifGorur && (
          <Bolum
            baslik="Teklifler"
            bos="Bu projeye bağlı teklif yok."
            eylem={
              teklifAcar ? (
                <Link
                  href={`/teklifler/yeni?firma=${proje.firmaId}&proje=${proje.id}`}
                  className="btn-secondary h-8 px-2.5 text-xs"
                >
                  + Teklif
                </Link>
              ) : undefined
            }
          >
            {teklifler.map((t) => (
              <Satir
                key={t.id}
                href={`/teklifler/${t.id}`}
                baslik={t.no}
                alt={t.baslik}
                sag={formatPara(t.toplam, t.paraBirimi)}
                durum={t.durum}
              />
            ))}
          </Bolum>
        )}

        {siparisGorur && (
          <Bolum
            baslik="Siparişler"
            bos="Bu projeye bağlı sipariş yok."
            eylem={
              siparisAcar ? (
                <Link
                  href={`/siparisler/yeni?firma=${proje.firmaId}&proje=${proje.id}`}
                  className="btn-secondary h-8 px-2.5 text-xs"
                >
                  + Sipariş
                </Link>
              ) : undefined
            }
          >
            {siparisler.map((s) => (
              <Satir
                key={s.id}
                href={`/siparisler/${s.id}`}
                baslik={s.no}
                alt={formatTarih(s.createdAt)}
                sag={formatPara(s.toplam, s.paraBirimi)}
                durum={s.durum}
              />
            ))}
          </Bolum>
        )}

        {destekGorur && (
          <Bolum
            baslik="Destek Kayıtları"
            bos="Bu projeye bağlı destek kaydı yok."
            eylem={
              <Link
                href={`/destek?proje=${proje.id}`}
                className="btn-secondary h-8 px-2.5 text-xs"
              >
                Tümü
              </Link>
            }
          >
            {destekler.map((d) => (
              <Satir
                key={d.id}
                href={`/destek/${d.id}`}
                baslik={d.no}
                alt={d.baslik}
                sag=""
                durum={d.durum}
              />
            ))}
          </Bolum>
        )}
      </div>
    </div>
  );
}

function Bolum({
  baslik,
  bos,
  eylem,
  children,
}: {
  baslik: string;
  bos: string;
  eylem?: React.ReactNode;
  children: React.ReactNode;
}) {
  const dolu = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{baslik}</h3>
        {eylem}
      </div>
      {dolu ? (
        <ul className="divide-y divide-border/50">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{bos}</p>
      )}
    </div>
  );
}

function Satir({
  href,
  baslik,
  alt,
  sag,
  durum,
}: {
  href: string;
  baslik: string;
  alt: string;
  sag: string;
  durum: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <Link href={href} className="font-mono text-xs text-foreground hover:text-primary">
          {baslik}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{alt}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {sag && <span className="text-xs">{sag}</span>}
        <StatusBadge durum={durum} />
      </div>
    </li>
  );
}
