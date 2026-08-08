import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, CalendarDays } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, etkinIzinler } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { takvimOgeleri, type TakvimOgesi } from "@/lib/takvim";
import {
  TAKVIM_TURLERI,
  TUR_ETIKET,
  TUR_IZIN,
  turleriCoz,
  type TakvimTuru,
} from "@/lib/takvim-tanimlar";

export const dynamic = "force-dynamic";

const RENK: Record<TakvimOgesi["tur"], string> = {
  gorev: "bg-primary/15 text-primary",
  firsat: "bg-violet-500/15 text-violet-400",
  teklif: "bg-amber-500/15 text-amber-400",
  egitim: "bg-sky-500/15 text-sky-400",
  hizmet: "bg-indigo-500/15 text-indigo-400",
};

const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/**
 * Takvim (Faz 8 / D4).
 *
 * Ayrı bir "etkinlik" kaydı yoktur; görevlerin, fırsatların, tekliflerin,
 * eğitim ve hizmetlerin TARİHLERİ tek ızgarada birleştirilir.
 */
export default async function TakvimPage(
  props: {
    searchParams: Promise<{ ay?: string; kim?: string; tur?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.takvimGoruntule);
  const { db, session } = await getTenantContext();
  const izinler = await etkinIzinler();

  // "2026-08" biçimi; geçersizse bu ay.
  const parcalar = (searchParams.ay ?? "").match(/^(\d{4})-(\d{2})$/);
  const bugun = new Date();
  const yil = parcalar ? Number(parcalar[1]) : bugun.getFullYear();
  const ay = parcalar ? Number(parcalar[2]) - 1 : bugun.getMonth();

  const ayBasi = new Date(yil, ay, 1);
  const aySonu = new Date(yil, ay + 1, 0, 23, 59, 59, 999);

  const bana = searchParams.kim !== "herkes";

  /**
   * Kategori süzgeci (Faz 13 / H8). Ortağın bulgusu: "takvimde kategori
   * filtresi olsun". Seçim querystring'de yaşar; böylece bağlantı
   * paylaşılabilir ve ay değiştirince kaybolmaz.
   */
  const seciliTurler = turleriCoz(searchParams.tur);
  const ogeler = await takvimOgeleri(
    db,
    izinler,
    ayBasi,
    aySonu,
    bana ? session.userId : undefined,
    seciliTurler
  );

  // Izgara pazartesiden başlar (TR alışkanlığı; JS'te 0 = pazar).
  const ilkGun = (ayBasi.getDay() + 6) % 7;
  const gunSayisi = aySonu.getDate();
  const hucreSayisi = Math.ceil((ilkGun + gunSayisi) / 7) * 7;

  const gunlereGore = new Map<number, TakvimOgesi[]>();
  for (const o of ogeler) {
    const g = o.tarih.getDate();
    gunlereGore.set(g, [...(gunlereGore.get(g) ?? []), o]);
  }

  const oncekiAy = new Date(yil, ay - 1, 1);
  const sonrakiAy = new Date(yil, ay + 1, 1);
  const ayParam = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const kimParam = bana ? "" : "&kim=herkes";
  const turParam = searchParams.tur ? `&tur=${searchParams.tur}` : "";

  // Kullanıcının göremediği kategori süzgeçte de görünmez.
  const gorunurTurler = TAKVIM_TURLERI.filter((t) => izinler.has(TUR_IZIN[t]));

  /** Bir kategoriyi seçime ekleyip çıkaran bağlantı. */
  const turQs = (t: TakvimTuru) => {
    const acik = new Set(seciliTurler);
    // Hepsi seçiliyken bir kategoriye basmak "yalnızca onu göster" demektir;
    // beş kez tıklayıp diğerlerini kapatmak yerine beklenen davranış budur.
    const yeni =
      acik.size === gorunurTurler.length
        ? [t]
        : acik.has(t)
          ? gorunurTurler.filter((x) => x !== t && acik.has(x))
          : gorunurTurler.filter((x) => x === t || acik.has(x));

    const deger = yeni.length === 0 || yeni.length === gorunurTurler.length
      ? ""
      : `&tur=${yeni.join(",")}`;
    return `/takvim?ay=${ayParam(ayBasi)}${kimParam}${deger}`;
  };

  const ayAdi = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(ayBasi);

  return (
    <div>
      <PageHeader
        title="Takvim"
        subtitle={`${ogeler.length} kayıt · ${ayAdi}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-border/70">
              <Link
                href={`/takvim?ay=${ayParam(new Date(yil, ay, 1))}${turParam}`}
                className={`px-3 py-2 text-sm ${
                  bana ? "bg-secondary/70 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bana ait
              </Link>
              <Link
                href={`/takvim?ay=${ayParam(new Date(yil, ay, 1))}&kim=herkes${turParam}`}
                className={`border-l border-border/70 px-3 py-2 text-sm ${
                  bana ? "text-muted-foreground hover:text-foreground" : "bg-secondary/70 text-foreground"
                }`}
              >
                Herkes
              </Link>
            </div>

            <a
              href={`/api/takvim.ics?ay=${ayParam(ayBasi)}${kimParam}${turParam}`}
              className="btn-secondary"
            >
              <Download className="h-4 w-4" /> .ics indir
            </a>
          </div>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/takvim?ay=${ayParam(oncekiAy)}${kimParam}${turParam}`}
            aria-label="Önceki ay"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[160px] text-center font-semibold text-foreground">
            {ayAdi}
          </span>
          <Link
            href={`/takvim?ay=${ayParam(sonrakiAy)}${kimParam}${turParam}`}
            aria-label="Sonraki ay"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/takvim?ay=${ayParam(bugun)}${kimParam}${turParam}`}
            className="btn-secondary h-9 px-3 text-sm"
          >
            <CalendarDays className="h-4 w-4" /> Bugün
          </Link>
        </div>

        {/* Renk açıklaması aynı zamanda kategori süzgecidir (Faz 13 / H8):
            ayrı bir filtre kutusu koymak yerine var olan gösterge tıklanır. */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {gorunurTurler.map((t) => {
            const secili = seciliTurler.has(t);
            return (
              <Link
                key={t}
                href={turQs(t)}
                aria-pressed={secili}
                className={`rounded-lg px-2 py-1 font-medium transition-opacity ${RENK[t]} ${
                  secili ? "" : "opacity-35 hover:opacity-60"
                }`}
              >
                {TUR_ETIKET[t]}
              </Link>
            );
          })}
          {seciliTurler.size < gorunurTurler.length && (
            <Link
              href={`/takvim?ay=${ayParam(ayBasi)}${kimParam}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Tümü
            </Link>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
          {GUNLER.map((g) => (
            <div
              key={g}
              className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {g}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: hucreSayisi }).map((_, i) => {
            const gunNo = i - ilkGun + 1;
            const gecerli = gunNo >= 1 && gunNo <= gunSayisi;
            const buGunMu =
              gecerli &&
              gunNo === bugun.getDate() &&
              ay === bugun.getMonth() &&
              yil === bugun.getFullYear();
            const gunOgeleri = gecerli ? gunlereGore.get(gunNo) ?? [] : [];

            return (
              <div
                key={i}
                className={`min-h-[104px] border-b border-r border-border/40 p-1.5 ${
                  gecerli ? "" : "bg-muted/20"
                }`}
              >
                {gecerli && (
                  <>
                    <p
                      className={`mb-1 text-xs font-medium ${
                        buGunMu
                          ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {gunNo}
                    </p>
                    <div className="space-y-1">
                      {gunOgeleri.slice(0, 3).map((o) => {
                        const icerik = (
                          <span
                            className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${RENK[o.tur]} ${
                              o.tamamlandi ? "line-through opacity-60" : ""
                            }`}
                            title={`${o.baslik}${o.aciklama ? ` · ${o.aciklama}` : ""}`}
                          >
                            {o.baslik}
                          </span>
                        );
                        return o.link ? (
                          <Link key={o.id} href={o.link} className="block">
                            {icerik}
                          </Link>
                        ) : (
                          <div key={o.id}>{icerik}</div>
                        );
                      })}
                      {gunOgeleri.length > 3 && (
                        <p className="px-1 text-[11px] text-muted-foreground/70">
                          +{gunOgeleri.length - 3} daha
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
