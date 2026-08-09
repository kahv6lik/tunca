import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff, Trash2 } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { formatTarih, toDateInput } from "@/lib/format";
import { soruTipi, yanitOrani } from "@/lib/anket-tanimlar";
import AnketPanel from "@/components/anketler/AnketPanel";
import SoruFormu from "@/components/anketler/SoruFormu";
import GonderimPanel from "@/components/anketler/GonderimPanel";
import DeleteButton from "@/components/DeleteButton";
import { anketSil, soruSil } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Anket detayı — Faz 19 / N1, N2.
 *
 * Anonim ankette gönderim listesi "kime gönderdik ve yanıtladı mı" bilgisini
 * gösterir ama "ne yanıtladı" bilgisini GÖSTEREMEZ — yanıt satırında kimlik
 * bağı hiç yazılmadı. İkisi ayrı sorulardır ve ekran bunu açıkça söyler.
 */
export default async function AnketDetayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  await yetkiGerektir(IZIN.anketGoruntule);

  const [yonetir, gonderir] = await Promise.all([
    yetkiVarMi(IZIN.anketYonet),
    yetkiVarMi(IZIN.anketGonder),
  ]);

  const db = await getTenantDb();

  const anket = await db.anket.findFirst({
    where: { id: params.id },
    include: {
      sorular: { orderBy: { sira: "asc" } },
      gonderimler: {
        orderBy: { createdAt: "desc" },
        include: { firma: { select: { ad: true } } },
      },
      _count: { select: { yanitlar: true } },
    },
  });
  if (!anket) notFound();

  // Gönderim panelinde yalnızca e-postası olan kontaklar listelenir; e-posta
  // yoksa gönderilecek bir yer yoktur.
  const kisiler = gonderir
    ? await db.kisi.findMany({
        where: { email: { not: null } },
        orderBy: { ad: "asc" },
        take: 500,
        select: { id: true, ad: true, email: true, firma: { select: { ad: true } } },
      })
    : [];

  const gonderilmis = new Set(anket.gonderimler.map((g) => g.kisiId).filter(Boolean));
  const yanitlayan = anket.gonderimler.filter((g) => g.yanitTarihi).length;
  const oran = yanitOrani(anket.gonderimler.length, yanitlayan);
  const yanitVar = anket._count.yanitlar > 0;

  return (
    <div>
      <Link
        href="/anketler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Anketler
      </Link>

      <PageHeader
        title={anket.baslik}
        subtitle={anket.aciklama ?? undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {anket.anonim && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" /> Anonim
              </span>
            )}
            <StatusBadge durum={anket.durum} />
            {anket.gonderimler.length > 0 && (
              <Link href={`/anketler/${anket.id}/rapor`} className="btn-secondary text-sm">
                Sonuçlar
              </Link>
            )}
            {gonderir && anket.durum === "yayinda" && (
              <GonderimPanel
                anketId={anket.id}
                kisiler={kisiler.map((k) => ({
                  id: k.id,
                  ad: k.ad,
                  email: k.email!,
                  firmaAd: k.firma.ad,
                  gonderildi: gonderilmis.has(k.id),
                }))}
              />
            )}
            {yonetir && (
              <AnketPanel
                mevcut={{
                  id: anket.id,
                  baslik: anket.baslik,
                  aciklama: anket.aciklama ?? "",
                  durum: anket.durum,
                  anonim: anket.anonim,
                  bitisTarihi: anket.bitisTarihi ? toDateInput(anket.bitisTarihi) : "",
                }}
              />
            )}
            {yonetir && (
              <DeleteButton
                action={anketSil.bind(null, anket.id)}
                label="Anketi Sil"
                confirmText="Anket, soruları ve toplanan tüm yanıtlar silinecek. Onaylıyor musunuz?"
              />
            )}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Kutu etiket="Soru" deger={String(anket.sorular.length)} />
        <Kutu etiket="Gönderim" deger={String(anket.gonderimler.length)} />
        <Kutu etiket="Yanıtlayan" deger={String(yanitlayan)} />
        <Kutu
          etiket="Yanıtlama oranı"
          deger={oran === null ? "—" : `%${oran.toLocaleString("tr-TR")}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Sorular ({anket.sorular.length})
          </h3>

          {anket.sorular.length === 0 ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Henüz soru eklenmedi. Sorusuz anket gönderilemez.
            </p>
          ) : (
            <ol className="mb-4 space-y-2">
              {anket.sorular.map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 border-b border-border/50 pb-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {i + 1}. {s.metin}
                      {s.zorunlu && <span className="ml-1 text-rose-400">*</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {soruTipi(s.tip)?.etiket ?? s.tip}
                      {s.secenekler.length > 0 && ` · ${s.secenekler.join(" / ")}`}
                    </p>
                  </div>
                  {yonetir && !yanitVar && (
                    <form action={soruSil.bind(null, anket.id, s.id)}>
                      <button
                        type="submit"
                        aria-label="Soruyu sil"
                        className="text-muted-foreground hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
          )}

          {yonetir && !yanitVar && <SoruFormu anketId={anket.id} />}
          {yonetir && yanitVar && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              Yanıt toplanmaya başladığı için sorular değiştirilemez — sonradan
              eklenen bir soru, önceki yanıtlayanlarda boş kalır ve raporu bozar.
            </p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Gönderimler ({anket.gonderimler.length})
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            {anket.anonim
              ? "Anket anonimdir: kime gönderildiği ve yanıtlayıp yanıtlamadığı bilinir, NE yanıtladığı bilinmez."
              : "Yanıtlar kişiye bağlıdır."}
          </p>

          {anket.gonderimler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz gönderim yok.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border/50 overflow-y-auto">
              {anket.gonderimler.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{g.ad ?? g.email}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {g.firma?.ad ?? "—"} · {g.email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs ${
                      g.yanitTarihi ? "text-emerald-500" : "text-muted-foreground"
                    }`}
                  >
                    {g.yanitTarihi ? formatTarih(g.yanitTarihi) : "bekliyor"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Kutu({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="text-xl font-semibold text-foreground">{deger}</p>
    </div>
  );
}
