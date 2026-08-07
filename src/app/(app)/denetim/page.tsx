import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import { ISLEM_ETIKET, VARLIK_ETIKET } from "@/lib/denetim";
import DegisiklikDetay from "@/components/denetim/DegisiklikDetay";

export const dynamic = "force-dynamic";
const SAYFA_BOYUTU = 50;

/**
 * Denetim günlüğü (Faz 4 / A8).
 *
 * Salt okunur — bilinçli olarak düzenleme veya silme yolu yoktur. Veritabanı
 * politikaları da bunu zorunlu kılar (bkz. RLS migration'ı: DenetimKaydi
 * tablosunda kiracı için yalnızca SELECT ve INSERT politikası vardır).
 */
export default async function DenetimPage(
  props: {
    searchParams: Promise<{ islem?: string; varlik?: string; kullanici?: string; sayfa?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await yetkiGerektir(IZIN.denetimGoruntule);
  const db = await getTenantDb();

  const islem = searchParams.islem ?? "";
  const varlik = searchParams.varlik ?? "";
  const kullanici = (searchParams.kullanici ?? "").trim();
  const sayfa = Math.max(1, parseInt(searchParams.sayfa ?? "1", 10) || 1);

  const where: Prisma.DenetimKaydiWhereInput = {
    AND: [
      islem ? { islem } : {},
      varlik ? { varlik } : {},
      kullanici ? { kullaniciEmail: { contains: kullanici, mode: "insensitive" } } : {},
    ],
  };

  const [toplam, kayitlar] = await Promise.all([
    db.denetimKaydi.count({ where }),
    db.denetimKaydi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYUTU,
      take: SAYFA_BOYUTU,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
  const qs = new URLSearchParams();
  if (islem) qs.set("islem", islem);
  if (varlik) qs.set("varlik", varlik);
  if (kullanici) qs.set("kullanici", kullanici);
  const baseUrl = `/denetim?${qs.toString()}${qs.toString() ? "&" : ""}`;

  return (
    <div>
      <PageHeader
        title="Denetim Günlüğü"
        subtitle={`${toplam} kayıt · kim, ne zaman, neyi değiştirdi`}
      />

      <div className="card mb-4 p-4 text-sm text-muted-foreground">
        Bu günlük <strong>salt okunurdur</strong>. Uygulama üzerinden hiçbir kayıt
        değiştirilemez veya silinemez; veritabanı politikaları da buna izin vermez.
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="w-44">
          <label className="label" htmlFor="islem">İşlem</label>
          <select id="islem" name="islem" defaultValue={islem} className="input">
            <option value="">Tümü</option>
            {Object.entries(ISLEM_ETIKET).map(([deger, { label }]) => (
              <option key={deger} value={deger}>{label}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="label" htmlFor="varlik">Kayıt Türü</label>
          <select id="varlik" name="varlik" defaultValue={varlik} className="input">
            <option value="">Tümü</option>
            {Object.entries(VARLIK_ETIKET).map(([deger, etiket]) => (
              <option key={deger} value={deger}>{etiket}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="kullanici">Kullanıcı</label>
          <input
            id="kullanici"
            name="kullanici"
            defaultValue={kullanici}
            placeholder="e-posta ile ara…"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary">Filtrele</button>
        {(islem || varlik || kullanici) && (
          <Link href="/denetim" className="btn-secondary">Temizle</Link>
        )}
      </form>

      {kayitlar.length === 0 ? (
        <EmptyState
          title="Kayıt bulunamadı"
          description="Henüz bir değişiklik yapılmamış ya da filtrelerinize uyan kayıt yok."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Tarih</th>
                <th className="th">Kullanıcı</th>
                <th className="th">İşlem</th>
                <th className="th">Kayıt</th>
                <th className="th">Ayrıntı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kayitlar.map((k) => {
                const islemEtiket = ISLEM_ETIKET[k.islem] ?? {
                  label: k.islem,
                  className: "bg-gray-100 text-gray-700",
                };
                return (
                  <tr key={k.id} className="hover:bg-muted/40">
                    <td className="td whitespace-nowrap">
                      {formatTarih(k.createdAt)}
                      <span className="ml-1 text-xs text-muted-foreground/70">
                        {new Date(k.createdAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="td">{k.kullaniciEmail}</td>
                    <td className="td">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset ${islemEtiket.className}`}
                      >
                        {islemEtiket.label}
                      </span>
                    </td>
                    <td className="td">
                      <span className="font-medium text-foreground">
                        {VARLIK_ETIKET[k.varlik] ?? k.varlik}
                      </span>
                      {k.ozet && (
                        <p className="truncate text-xs text-muted-foreground">{k.ozet}</p>
                      )}
                    </td>
                    <td className="td">
                      <DegisiklikDetay
                        eski={k.eski as Record<string, unknown> | null}
                        yeni={k.yeni as Record<string, unknown> | null}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={sayfa} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
