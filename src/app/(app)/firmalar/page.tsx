import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import DisaAktarDugmesi from "@/components/DisaAktarDugmesi";
import GorunumBar from "@/components/GorunumBar";
import { gorunumleriGetir, varsayilanaYonlendir } from "@/lib/gorunum";
import { alanlariGetir, degerleEslesenKayitlar, ozelAlanGirdiAdi } from "@/lib/ozel-alan";
import { firmaNoMu } from "@/lib/firma-no-saf";
import { metinArama } from "@/lib/arama";
import OzetDugmesi from "@/components/panel/OzetDugmesi";

export const dynamic = "force-dynamic";

const SAYFA_BOYUTU = 20;

type SearchParams = {
  ara?: string;
  durum?: string;
  il?: string;
  sayfa?: string;
  // Faz 11: özel alan filtreleri "oa_<alanId>" anahtarıyla gelir.
  [anahtar: string]: string | undefined;
};

export default async function FirmalarPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.firmaGoruntule);
  await varsayilanaYonlendir("firmalar", searchParams);
  const ekleyebilir = await yetkiVarMi(IZIN.firmaOlustur);
  const gorunumler = await gorunumleriGetir("firmalar");
  const db = await getTenantDb();
  const ara = (searchParams.ara ?? "").trim();
  const durum = searchParams.durum ?? "";
  const il = (searchParams.il ?? "").trim();
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  /**
   * Özel alan filtreleri (Faz 11 / E6) — yalnızca SEÇİM tipli firma alanları
   * filtre olarak sunulur (serbest metinde arama zaten "Ara" kutusunun işi).
   * Değer eşleşen firma id'leri where'e eklenir; sorgular kiracı katmanından
   * geçer. Filtre querystring'de yaşadığı için kayıtlı görünümler ve dışa
   * aktarım kendiliğinden bunları da taşır.
   */
  const secimAlanlari = (await alanlariGetir("firma")).filter((a) => a.tip === "secim");
  const aktifOzelFiltreler = secimAlanlari
    .map((a) => ({ alan: a, deger: (searchParams[ozelAlanGirdiAdi(a.id)] ?? "").trim() }))
    .filter((f) => f.deger && f.alan.secenekler.includes(f.deger));

  const ozelKisitlar: Prisma.FirmaWhereInput[] = [];
  for (const f of aktifOzelFiltreler) {
    const idler = await degerleEslesenKayitlar(db, "firma", f.alan.id, f.deger);
    ozelKisitlar.push({ id: { in: idler } });
  }

  /**
   * Arama (Faz 13 / H1 + H2): `mode: "insensitive"` olmadan PostgreSQL
   * `contains` büyük/küçük harfe duyarlıdır ve "ARÇELİK" yazan kullanıcı
   * "Arçelik" kaydını bulamazdı. Firma numarası (A0001) yazıldığında TAM
   * eşleşme aranır — "A0001" harf-rakam deseni başka bir alanda anlamlı
   * bir parça değildir, kısmi eşleşme yalnızca gürültü üretirdi.
   */
  const where: Prisma.FirmaWhereInput = {
    AND: [
      ara
        ? {
            OR: [
              ...(firmaNoMu(ara)
                ? [{ firmaNo: ara.trim().toUpperCase() } as Prisma.FirmaWhereInput]
                : []),
              ...metinArama<Prisma.FirmaWhereInput>(ara, [
                "ad",
                "vergiNo",
                "yetkiliAd",
                "sektor",
              ]),
            ],
          }
        : {},
      durum ? { durum } : {},
      il ? { OR: metinArama<Prisma.FirmaWhereInput>(il, ["il"]) } : {},
      ...ozelKisitlar,
    ],
  };

  const [toplam, firmalar, iller] = await Promise.all([
    db.firma.count({ where }),
    db.firma.findMany({
      where,
      orderBy: { ad: "asc" },
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
      include: {
        _count: { select: { yatirimlar: true, egitimler: true, hizmetler: true } },
      },
    }),
    db.firma.findMany({
      where: { il: { not: null } },
      distinct: ["il"],
      select: { il: true },
      orderBy: { il: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));

  // Sayfalama linki için mevcut filtreleri koru
  const qs = new URLSearchParams();
  if (ara) qs.set("ara", ara);
  if (durum) qs.set("durum", durum);
  if (il) qs.set("il", il);
  for (const f of aktifOzelFiltreler) qs.set(ozelAlanGirdiAdi(f.alan.id), f.deger);
  const baseUrl = `/firmalar?${qs.toString()}${qs.toString() ? "&" : ""}`;

  const ozelFiltreDegerleri = Object.fromEntries(
    aktifOzelFiltreler.map((f) => [ozelAlanGirdiAdi(f.alan.id), f.deger])
  );

  return (
    <div>
      <PageHeader
        title="Firmalar"
        subtitle={`${toplam} firma listeleniyor`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <GorunumBar
              liste="firmalar"
              gorunumler={gorunumler}
              filtreler={{ ara, durum, il, ...ozelFiltreDegerleri }}
            />
            <DisaAktarDugmesi
              tur="firmalar"
              filtreler={{ ara, durum, il, ...ozelFiltreDegerleri }}
            />
            {ekleyebilir && (
            <Link href="/firmalar/yeni" className="btn-primary">
              + Yeni Firma
            </Link>
            )}
          </div>
        }
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="ara">Ara</label>
          <input
            id="ara"
            name="ara"
            defaultValue={ara}
            placeholder="Firma no (A0001), ad, vergi no, yetkili…"
            className="input"
          />
        </div>
        <div className="w-40">
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" defaultValue={durum} className="input">
            <option value="">Tümü</option>
            <option value="aktif">Aktif</option>
            <option value="pasif">Pasif</option>
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="il">İl</label>
          <select id="il" name="il" defaultValue={il} className="input">
            <option value="">Tümü</option>
            {iller
              .map((r) => r.il)
              .filter((x): x is string => !!x)
              .map((ilAdi) => (
                <option key={ilAdi} value={ilAdi}>
                  {ilAdi}
                </option>
              ))}
          </select>
        </div>
        {/* Seçim tipli özel alan filtreleri (Faz 11 / E6) */}
        {secimAlanlari.map((a) => (
          <div key={a.id} className="w-44">
            <label className="label" htmlFor={ozelAlanGirdiAdi(a.id)}>{a.ad}</label>
            <select
              id={ozelAlanGirdiAdi(a.id)}
              name={ozelAlanGirdiAdi(a.id)}
              defaultValue={searchParams[ozelAlanGirdiAdi(a.id)] ?? ""}
              className="input"
            >
              <option value="">Tümü</option>
              {a.secenekler.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
        <button type="submit" className="btn-primary">Filtrele</button>
        {(ara || durum || il || aktifOzelFiltreler.length > 0) && (
          <Link href="/firmalar" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {firmalar.length === 0 ? (
        <EmptyState
          title="Firma bulunamadı"
          description="Arama kriterlerinizi değiştirin veya yeni firma ekleyin."
          action={
            ekleyebilir ? (
              <Link href="/firmalar/yeni" className="btn-primary">
                + Yeni Firma
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">No</th>
                <th className="th">Firma</th>
                <th className="th">Sektör</th>
                <th className="th">İl</th>
                <th className="th">Yetkili</th>
                <th className="th text-center">Yatırım</th>
                <th className="th text-center">Eğitim</th>
                <th className="th text-center">Hizmet</th>
                <th className="th">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {firmalar.map((f) => (
                <tr key={f.id} className="hover:bg-muted/40">
                  <td className="td font-mono text-xs text-muted-foreground">
                    {f.firmaNo ?? "—"}
                  </td>
                  <td className="td">
                    <Link
                      href={`/firmalar/${f.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {f.ad}
                    </Link>
                    <OzetDugmesi tur="firma" id={f.id} />
                    <p className="text-xs text-muted-foreground/70">
                      Eklendi: {formatTarih(f.createdAt)}
                    </p>
                  </td>
                  <td className="td">{f.sektor ?? "—"}</td>
                  <td className="td">{f.il ?? "—"}</td>
                  <td className="td">{f.yetkiliAd ?? "—"}</td>
                  <td className="td text-center">{f._count.yatirimlar}</td>
                  <td className="td text-center">{f._count.egitimler}</td>
                  <td className="td text-center">{f._count.hizmetler}</td>
                  <td className="td">
                    <StatusBadge durum={f.durum} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
