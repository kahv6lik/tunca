import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
import { formatTarih } from "@/lib/format";
import { tarihAraligi, araliktanEtiket, hazirAraliklar } from "@/lib/tarih-araligi";
import { npsHesapla, soruOzeti, soruTipi, yanitOrani } from "@/lib/anket-tanimlar";
import { kirilim } from "@/lib/rapor-saf";

export const dynamic = "force-dynamic";

/**
 * Anket raporu — Faz 19 / N4.
 *
 * ANONİM ANKETTE FİRMA KIRILIMI GÖSTERİLMEZ — çünkü veri YOKTUR: yanıt
 * satırlarına firma bağı hiç yazılmadı. Ekran bunu bir eksiklik gibi değil,
 * verilen sözün sonucu olarak anlatır.
 *
 * NPS yalnızca 0-10 ölçekli sorulardan hesaplanır ve standart eşikleri
 * kullanır (9-10 destekçi, 7-8 nötr, 0-6 kötüleyen); kendi eşiğimizi koymak
 * rakamı sektör kıyaslamasından koparırdı.
 */
export default async function AnketRaporPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bas?: string; bit?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.anketGoruntule);

  const db = await getTenantDb();
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);

  const anket = await db.anket.findFirst({
    where: { id: params.id },
    include: { sorular: { orderBy: { sira: "asc" } } },
  });
  if (!anket) notFound();

  const [yanitlar, gonderimler] = await Promise.all([
    db.anketYanit.findMany({
      where: { anketId: anket.id, ...(aralik ? { createdAt: aralik } : {}) },
      select: { soruId: true, deger: true, firmaId: true, yanitGrubu: true },
    }),
    db.anketGonderim.findMany({
      where: { anketId: anket.id },
      select: { yanitTarihi: true, firmaId: true, firma: { select: { ad: true } } },
    }),
  ]);

  const yanitlayan = gonderimler.filter((g) => g.yanitTarihi).length;
  const oran = yanitOrani(gonderimler.length, yanitlayan);
  // Doldurma sayısı: anonim ankette de bilinir, çünkü grup anahtarı kimliğe
  // değil oturuma bağlıdır.
  const doldurma = new Set(yanitlar.map((y) => y.yanitGrubu)).size;

  const ozetler = anket.sorular.map((s) => soruOzeti(s, yanitlar));

  // NPS: 0-10 ölçekli sorulardan. Birden çok varsa hepsi tek havuza girer —
  // NPS bir kuruluş skorudur, soru başına ayrı skor kafa karıştırırdı.
  const npsDegerleri = yanitlar
    .filter((y) => anket.sorular.some((s) => s.id === y.soruId && s.tip === "olcek10"))
    .map((y) => Number(y.deger))
    .filter((n) => Number.isFinite(n));
  const nps = npsHesapla(npsDegerleri);

  // Firma kırılımı YALNIZCA kimlikli ankette anlamlıdır.
  const firmaAdi = new Map(
    gonderimler
      .filter((g) => g.firmaId && g.firma)
      .map((g) => [g.firmaId!, g.firma!.ad])
  );
  const firmaKirilimi = anket.anonim
    ? []
    : kirilim(
        yanitlar.filter((y) => y.firmaId),
        (y) => firmaAdi.get(y.firmaId!) ?? "—",
        () => 1,
        10
      );

  return (
    <div>
      <Link
        href={`/anketler/${anket.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Ankete dön
      </Link>

      <PageHeader
        title={`${anket.baslik} — Sonuçlar`}
        subtitle={araliktanEtiket(aralik) ?? "Tüm yanıtlar"}
        action={
          anket.anonim ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" /> Anonim
            </span>
          ) : undefined
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="bas">Başlangıç</label>
          <input id="bas" name="bas" type="date" defaultValue={searchParams.bas ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Bitiş</label>
          <input id="bit" name="bit" type="date" defaultValue={searchParams.bit ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-primary">Uygula</button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => (
            <Link
              key={h.anahtar}
              href={`/anketler/${anket.id}/rapor?bas=${h.bas}&bit=${h.bit}`}
              className="rounded-lg border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {h.etiket}
            </Link>
          ))}
        </div>
        {(searchParams.bas || searchParams.bit) && (
          <Link href={`/anketler/${anket.id}/rapor`} className="btn-secondary">Temizle</Link>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kutu etiket="Gönderim" deger={String(gonderimler.length)} />
        <Kutu etiket="Doldurma" deger={String(doldurma)} />
        <Kutu
          etiket="Yanıtlama oranı"
          deger={oran === null ? "—" : `%${oran.toLocaleString("tr-TR")}`}
        />
        <Kutu
          etiket="NPS"
          deger={nps.skor === null ? "—" : String(nps.skor)}
          alt={
            nps.skor === null
              ? "0-10 ölçekli soru yok"
              : `${nps.destekci} destekçi · ${nps.notr} nötr · ${nps.kotuleyen} kötüleyen`
          }
        />
      </div>

      {ozetler.length === 0 || yanitlar.length === 0 ? (
        <p className="card mt-4 p-5 text-sm text-muted-foreground">
          Bu dönemde yanıt yok.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {ozetler.map((o) => {
            const sayisal = soruTipi(o.tip)?.sayisal ?? false;
            const serbest = o.tip === "metin";

            return (
              <ChartCard
                key={o.soruId}
                title={o.metin}
                subtitle={
                  [
                    `${o.yanitSayisi} yanıt`,
                    o.ortalama !== null
                      ? `ortalama ${o.ortalama.toLocaleString("tr-TR")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
              >
                {o.yanitSayisi === 0 ? (
                  <p className="text-sm text-muted-foreground">Yanıt yok.</p>
                ) : serbest ? (
                  // Serbest metin GRAFİĞE dökülmez: her yanıt biriciktir ve
                  // "dağılım" göstermek her sütunu 1 yapardı. Metinler olduğu
                  // gibi listelenir.
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {o.dagilim.map((d, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-border/60 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {d.deger}
                        {d.adet > 1 && (
                          <span className="ml-2 text-[11px] text-muted-foreground/70">
                            ×{d.adet}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <BarChart
                    data={o.dagilim.map((d) => ({ label: d.deger, value: d.adet }))}
                    horizontal={!sayisal}
                  />
                )}
              </ChartCard>
            );
          })}

          <ChartCard
            title="Firma Kırılımı"
            subtitle={
              anket.anonim
                ? "Anonim ankette firma bilgisi TUTULMAZ"
                : "Firma başına yanıt adedi"
            }
          >
            {anket.anonim ? (
              <p className="text-sm text-muted-foreground">
                Bu anket anonim toplandığı için yanıtlar firmaya bağlı değil —
                kırılım teknik olarak üretilemez. Katılımcılara verilen söz
                budur.
              </p>
            ) : firmaKirilimi.length === 0 ? (
              <p className="text-sm text-muted-foreground">Firmalı yanıt yok.</p>
            ) : (
              <BarChart data={firmaKirilimi} horizontal />
            )}
          </ChartCard>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Anket {formatTarih(anket.createdAt)} tarihinde oluşturuldu
        {anket.bitisTarihi && ` · bitiş ${formatTarih(anket.bitisTarihi)}`}.
      </p>
    </div>
  );
}

function Kutu({ etiket, deger, alt }: { etiket: string; deger: string; alt?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-muted-foreground">{etiket}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{deger}</p>
      {alt && <p className="mt-1 text-xs text-muted-foreground">{alt}</p>}
    </div>
  );
}
