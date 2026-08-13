import Link from "next/link";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { formatPara, formatTarih } from "@/lib/format";
import { KAMPANYA_TIP, KAMPANYA_DURUM } from "@/lib/constants";
import { toDateInput } from "@/lib/format";
import KampanyaPanel from "@/components/urunler/KampanyaPanel";
import DeleteButton from "@/components/DeleteButton";
import { kampanyaSil } from "./actions";
import { bekleyenKotalar } from "@/lib/kampanya";
import { tarihAraligi, araliktanEtiket, hazirAraliklar } from "@/lib/tarih-araligi";

export const dynamic = "force-dynamic";

/**
 * Kampanyalar — Faz 14 / T3, T4, T5.
 *
 * Liste ve RAPOR aynı ekrandadır: kampanyaya bakan kişinin ilk sorusu "kaç
 * kez kullanıldı, ne kadar hakkı kaldı" olduğu için bunu ayrı bir rapor
 * sayfasına koymak, en çok sorulan bilgiyi en uzağa koymak olurdu.
 */
export default async function KampanyalarPage(props: {
  searchParams: Promise<{ durum?: string; bas?: string; bit?: string }>;
}) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.kampanyaGoruntule);
  const yonetir = await yetkiVarMi(IZIN.kampanyaYonet);

  const db = await getTenantDb();
  const durum = (KAMPANYA_DURUM as readonly string[]).includes(searchParams.durum ?? "")
    ? searchParams.durum!
    : "";

  // Kullanım istatistiği tarih aralığına saygı duyar (Faz 13 / H9 deseni).
  const aralik = tarihAraligi(searchParams.bas, searchParams.bit);
  const aralikEtiketi = araliktanEtiket(aralik);

  const [kampanyalar, urunler, paketler, firmalar, bekleyen] = await Promise.all([
    db.kampanya.findMany({
      where: durum ? { durum } : {},
      orderBy: [{ durum: "asc" }, { baslangic: "desc" }],
      take: 200,
      include: {
        urunler: { select: { urunId: true } },
        paketler: { select: { paketId: true } },
        firmalar: { select: { firmaId: true } },
        kullanimlar: {
          where: { iptal: false, ...(aralik ? { createdAt: aralik } : {}) },
          select: { adet: true, indirimTutari: true, firmaId: true },
        },
      },
    }),
    db.urun.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, kod: true, ad: true },
    }),
    db.paket.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 300,
      select: { id: true, ad: true },
    }),
    db.firma.findMany({
      where: { durum: "aktif" },
      orderBy: { ad: "asc" },
      take: 500,
      select: { id: true, ad: true },
    }),
    // Onay bekleyen siparişlerdeki haklar (v1.27.1).
    bekleyenKotalar(db),
  ]);

  const urunSecenek = urunler.map((u) => ({ id: u.id, ad: `${u.kod} — ${u.ad}` }));
  const tipEtiket = (t: string) =>
    KAMPANYA_TIP.find((x) => x.deger === t)?.etiket ?? t;

  return (
    <div>
      <PageHeader
        title="Kampanyalar"
        subtitle={
          aralikEtiketi
            ? `${kampanyalar.length} kampanya · kullanım: ${aralikEtiketi}`
            : `${kampanyalar.length} kampanya · tüm zamanların kullanımı`
        }
        action={
          yonetir ? (
            <KampanyaPanel
              urunler={urunSecenek}
              paketler={paketler}
              firmalar={firmalar}
            />
          ) : undefined
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="w-44">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="taslak">Taslak</option>
            <option value="aktif">Aktif</option>
            <option value="duraklatildi">Duraklatıldı</option>
            <option value="sonaerdi">Sona erdi</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bas">Kullanım başlangıcı</label>
          <input id="bas" name="bas" type="date" defaultValue={searchParams.bas ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bit">Kullanım bitişi</label>
          <input id="bit" name="bit" type="date" defaultValue={searchParams.bit ?? ""} className="input" />
        </div>
        <button type="submit" className="btn-primary">Uygula</button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => (
            <Link
              key={h.anahtar}
              href={`/kampanyalar?bas=${h.bas}&bit=${h.bit}${durum ? `&durum=${durum}` : ""}`}
              className="rounded-lg border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              {h.etiket}
            </Link>
          ))}
        </div>
        {(durum || searchParams.bas || searchParams.bit) && (
          <Link href="/kampanyalar" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {kampanyalar.length === 0 ? (
        <EmptyState
          title="Kampanya yok"
          description="Kampanya, belirli ürün ve firmalara süreli indirim tanımlamanızı sağlar."
          action={
            yonetir ? (
              <KampanyaPanel urunler={urunSecenek} paketler={paketler} firmalar={firmalar} />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {kampanyalar.map((k) => {
            // T5 — kampanya raporu: kullanım adedi, ciro etkisi, firma kırılımı.
            const kullanilanAdet = k.kullanimlar.reduce((s, u) => s + u.adet, 0);
            const toplamIndirim = k.kullanimlar.reduce((s, u) => s + u.indirimTutari, 0);
            const firmaSayisi = new Set(k.kullanimlar.map((u) => u.firmaId)).size;

            // Kalan kota kampanyanın KENDİ sayacından okunur; yukarıdaki
            // toplam tarih aralığına göre süzülmüş olabilir ve kotayı
            // anlatmaz. İkisini karıştırmak yanlış "kalan" gösterirdi.
            const kalanKota = k.kota === 0 ? null : Math.max(k.kota - k.kullanilan, 0);
            const doluluk = k.kota === 0 ? 0 : Math.min((k.kullanilan / k.kota) * 100, 100);

            /*
              ONAY BEKLEYEN HAKLAR (v1.27.1) — ortağın bulgusu: "kampanyayla
              sipariş oluşturdum ama kullanım ilerlemiyor, hiç kullanılmamış
              gibi." Kota ONAYDA düşer (Faz 15 kararı: reddedilen sipariş
              kotayı boşuna tüketmemeli) ama ekran bunu söylemiyordu.
              Sayaç DEĞİŞMEDİ; bekleyen ayrı gösterilir.
            */
            const bekleyenAdet = bekleyen.get(k.id) ?? 0;

            return (
              <div key={k.id} className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{k.kod}</p>
                    <h3 className="text-base font-semibold text-foreground">{k.ad}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tipEtiket(k.tip)} ·{" "}
                      {k.tip === "alnodem"
                        ? `${k.alN} al ${k.odeM} öde`
                        : k.tip === "yuzde"
                          ? `%${k.deger}`
                          : formatPara(k.deger)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge durum={k.durum} />
                    {yonetir && (
                      <>
                        <KampanyaPanel
                          urunler={urunSecenek}
                          paketler={paketler}
                          firmalar={firmalar}
                          mevcut={{
                            id: k.id,
                            kod: k.kod,
                            ad: k.ad,
                            aciklama: k.aciklama ?? "",
                            tip: k.tip,
                            durum: k.durum,
                            baslangic: toDateInput(k.baslangic),
                            bitis: toDateInput(k.bitis),
                            deger: k.deger,
                            alN: k.alN,
                            odeM: k.odeM,
                            kota: k.kota,
                            urunIdler: k.urunler.map((u) => u.urunId),
                            paketIdler: k.paketler.map((p) => p.paketId),
                            firmaIdler: k.firmalar.map((f) => f.firmaId),
                          }}
                        />
                        <DeleteButton
                          action={kampanyaSil.bind(null, k.id)}
                          confirmText={`"${k.ad}" kampanyasını silmek istediğinize emin misiniz?`}
                        />
                      </>
                    )}
                  </div>
                </div>

                <p className="mb-3 text-xs text-muted-foreground">
                  {formatTarih(k.baslangic)} – {formatTarih(k.bitis)} ·{" "}
                  {k.firmalar.length === 0
                    ? "tüm firmalar"
                    : `${k.firmalar.length} firma`}{" "}
                  ·{" "}
                  {k.urunler.length === 0 && k.paketler.length === 0
                    ? "tüm ürünler"
                    : `${k.urunler.length + k.paketler.length} kalem`}
                </p>

                {/* Kota göstergesi */}
                {k.kota > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Kota: {k.kullanilan} / {k.kota}
                        {bekleyenAdet > 0 && (
                          <span className="ml-1 text-amber-500">
                            (+{bekleyenAdet} onay bekliyor)
                          </span>
                        )}
                      </span>
                      <span
                        className={
                          kalanKota === 0 ? "text-rose-400" : "text-muted-foreground"
                        }
                      >
                        {kalanKota === 0 ? "Tükendi" : `${kalanKota} adet kaldı`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${doluluk >= 100 ? "bg-rose-500" : "bg-primary"}`}
                        style={{ width: `${doluluk}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* T5 — kullanım özeti */}
                {/*
                  ONAY BEKLEYEN, KOTASIZ kampanyalarda da gösterilir: sipariş
                  kaydedildikten sonra ekranda hiçbir şeyin kımıldamaması,
                  ortağın "hiç kullanılmamış gibi" demesine yol açmıştı.
                */}
                {k.kota === 0 && bekleyenAdet > 0 && (
                  <p className="mb-3 text-xs text-amber-500">
                    {bekleyenAdet} hak onay bekliyor — kota onay anında düşer.
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{kullanilanAdet}</p>
                    <p className="text-xs text-muted-foreground">
                      kullanım
                      {bekleyenAdet > 0 ? ` (+${bekleyenAdet} bekliyor)` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{firmaSayisi}</p>
                    <p className="text-xs text-muted-foreground">firma</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-emerald-500">
                      {formatPara(toplamIndirim)}
                    </p>
                    <p className="text-xs text-muted-foreground">indirim</p>
                  </div>
                </div>

                <Link
                  href={`/kampanyalar/${k.id}`}
                  className="mt-3 block text-center text-sm text-primary hover:underline"
                >
                  Kullanım dökümü →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
