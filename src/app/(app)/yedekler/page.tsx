import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SimdiYedekAl,
  DosyadanYukleFormu,
  YedekIslemleri,
} from "@/components/yedekler/YedekPanel";
import { formatTarih } from "@/lib/format";

export const dynamic = "force-dynamic";

const TUR_ETIKET: Record<string, { label: string; className: string }> = {
  elle: { label: "Elle", className: "bg-primary/15 text-primary ring-primary/25" },
  otomatik: {
    label: "Otomatik",
    className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  },
  yukleme: {
    label: "Dosyadan",
    className: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  },
};

function boyutYazi(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
}

/** Yedekler (Faz 10 / E7) — kuruluş yöneticisine özel. */
export default async function YedeklerPage() {
  await yetkiGerektir(IZIN.yedekYonet);
  const db = await getTenantDb();

  const yedekler = await db.yedek.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      tur: true,
      kayitSayisi: true,
      boyut: true,
      surum: true,
      olusturanEmail: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Yedekler"
        subtitle={`${yedekler.length} yedek saklanıyor`}
        action={<SimdiYedekAl />}
      />

      <div className="card mb-6 p-5 text-sm text-muted-foreground">
        <p>
          Yedek, kuruluşunuzun <strong className="text-foreground">iş verisini</strong>{" "}
          içerir (firmalar, kişiler, fırsatlar, aktiviteler, adaylar, teklifler,
          yatırım/eğitim/hizmet kayıtları ve satış aşamaları). Kullanıcılar ve denetim
          günlüğü bilinçli olarak kapsam dışıdır.
        </p>
        <p className="mt-2">
          Sistem her gece kendiliğinden bir yedek alır ve son 7 taneyi saklar. Geri
          yükleme <strong className="text-foreground">ekleyicidir</strong>: yalnızca var
          olmayan kayıtları ekler, mevcut veriye dokunmaz — &quot;yanlışlıkla
          sildim&quot; durumunun ilacıdır.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">Gerçek yedek, dışarıda tutulandır:</strong>{" "}
          düzenli aralıklarla dosyayı indirip kendi ortamınızda saklayın. Sunucunun
          kendisi kaybedilirse veritabanındaki yedekler de onunla gider.
        </p>
      </div>

      <div className="card mb-6 p-5">
        <DosyadanYukleFormu />
      </div>

      {yedekler.length === 0 ? (
        <EmptyState
          title="Henüz yedek yok"
          description="İlk yedeğinizi almak için sağ üstteki düğmeyi kullanın; gece yedekleri kendiliğinden başlar."
          action={<SimdiYedekAl />}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60">
            <thead className="bg-muted/30">
              <tr>
                <th className="th">Tarih</th>
                <th className="th">Tür</th>
                <th className="th">Kayıt</th>
                <th className="th">Boyut</th>
                <th className="th">Sürüm</th>
                <th className="th">Alan</th>
                <th className="th">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {yedekler.map((y) => {
                const tur = TUR_ETIKET[y.tur] ?? TUR_ETIKET.elle;
                return (
                  <tr key={y.id} className="hover:bg-muted/40">
                    <td className="td font-medium">
                      {formatTarih(y.createdAt)}{" "}
                      <span className="text-xs text-muted-foreground">
                        {y.createdAt.toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="td">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tur.className}`}
                      >
                        {tur.label}
                      </span>
                    </td>
                    <td className="td">{y.kayitSayisi.toLocaleString("tr-TR")}</td>
                    <td className="td">{boyutYazi(y.boyut)}</td>
                    <td className="td font-mono text-xs text-muted-foreground">
                      {y.surum ? `v${y.surum}` : "—"}
                    </td>
                    <td className="td text-muted-foreground">{y.olusturanEmail ?? "—"}</td>
                    <td className="td">
                      <YedekIslemleri
                        yedek={{ id: y.id, kayitSayisi: y.kayitSayisi, tur: y.tur }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
