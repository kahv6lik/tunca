import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { etkinIzinler, IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { hazirAraliklar, tarihAraligi, araliktanEtiket } from "@/lib/tarih-araligi";
import { RAPORLAR, RAPOR_GRUPLARI, raporSorgusu } from "@/lib/rapor-tanimlar";
import { gorunumleriGetir, varsayilanaYonlendir } from "@/lib/gorunum";
import GorunumBar from "@/components/GorunumBar";

export const dynamic = "force-dynamic";

/**
 * Rapor merkezi — Faz 18 / R1.
 *
 * Bütün raporlar tek çatı altında listelenir. Merkez KENDİ rakamını
 * hesaplamaz: hiçbir sorgu çalıştırmaz, yalnızca kayıt defterini okur ve
 * seçilen ortak süzgeci raporlara taşır. Böylece hub açmak, kullanıcının
 * görmeyeceği onlarca sorgu tetiklemez.
 *
 * İZNİ OLMAYAN RAPOR LİSTEDE GÖRÜNMEZ. Paket kısıtı `etkinIzinler()` içinde
 * uygulandığı için kapalı modülün raporu da kendiliğinden düşer — burada
 * ayrıca paket kontrolü yazmak gerekmez.
 */
export default async function RaporMerkeziPage(props: {
  searchParams: Promise<{ bas?: string; bit?: string; firma?: string; sorumlu?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.raporGoruntule);

  /**
   * Varsayılan görünüm (R5): merkez PARAMETRESİZ açıldıysa kullanıcının
   * kaydettiği döneme yönlendirilir. `/raporlar` rotası liste adıyla aynı
   * olduğu için mevcut yardımcı olduğu gibi çalışır — "her pazartesi
   * baktığım dönem" tek tıkla değil, hiç tıklamadan gelir.
   */
  await varsayilanaYonlendir("raporlar", searchParams);

  const izinler = await etkinIzinler();
  const gorunumler = await gorunumleriGetir("raporlar");

  const filtre = {
    bas: searchParams.bas,
    bit: searchParams.bit,
    firma: searchParams.firma,
    sorumlu: searchParams.sorumlu,
  };
  const aralikEtiketi = araliktanEtiket(tarihAraligi(filtre.bas, filtre.bit));
  const gorunenler = RAPORLAR.filter((r) => izinler.has(r.izin));

  return (
    <div>
      <PageHeader
        title="Rapor Merkezi"
        subtitle={
          aralikEtiketi
            ? `${gorunenler.length} rapor · ${aralikEtiketi}`
            : `${gorunenler.length} rapor · tüm zamanlar`
        }
        action={
          <GorunumBar liste="raporlar" gorunumler={gorunumler} filtreler={filtre} />
        }
      />

      {/* Dönem seçimi merkezde yapılır ve BÜTÜN raporlara taşınır: "bu çeyreği
          seçtim" demek her raporda yeniden seçmek anlamına gelmemeli. */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input id="bas" name="bas" type="date" defaultValue={filtre.bas ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input id="bit" name="bit" type="date" defaultValue={filtre.bit ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-primary">Dönemi Uygula</button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => {
            const secili = filtre.bas === h.bas && filtre.bit === h.bit;
            return (
              <Link
                key={h.anahtar}
                href={`/raporlar${raporSorgusu({ ...filtre, bas: h.bas, bit: h.bit })}`}
                className={`rounded-lg border px-2 py-1 transition-colors ${
                  secili
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.etiket}
              </Link>
            );
          })}
        </div>
        {(filtre.bas || filtre.bit) && (
          <Link href="/raporlar" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {gorunenler.length === 0 ? (
        <EmptyState
          title="Görüntüleyebileceğiniz rapor yok"
          description="Raporlar, ilgili modülün görüntüleme iznine bağlıdır."
        />
      ) : (
        <div className="space-y-6">
          {RAPOR_GRUPLARI.map((grup) => {
            const grubunRaporlari = gorunenler.filter((r) => r.grup === grup);
            if (grubunRaporlari.length === 0) return null;

            return (
              <section key={grup}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {grup}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {grubunRaporlari.map((r) => {
                    /**
                     * Dış rapora giderken ortak süzgeç TAŞINMAZ: o ekranların
                     * kendi süzgeç anahtarları var ve uydurma bir querystring
                     * göndermek sessizce yok sayılırdı. Kullanıcıya yanlış bir
                     * "dönem uygulandı" izlenimi vermemek için bağlantı sade
                     * bırakılır ve kart bunu söyler.
                     */
                    const adres = r.disRota
                      ? r.disRota
                      : `/raporlar/${r.anahtar}${raporSorgusu(filtre)}`;

                    return (
                      <Link
                        key={r.anahtar}
                        href={adres}
                        className="card group flex items-start justify-between gap-3 p-5 transition-colors hover:border-primary/40"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{r.etiket}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {r.aciklama}
                          </p>
                          {r.disRota && (
                            <p className="mt-2 text-[11px] text-muted-foreground/70">
                              Modülün kendi rapor ekranında
                            </p>
                          )}
                        </div>
                        {r.disRota ? (
                          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                        ) : (
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
