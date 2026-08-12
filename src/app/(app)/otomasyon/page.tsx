import { Zap } from "lucide-react";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import KuralPanel, { KuralIslemleri } from "@/components/otomasyon/KuralPanel";
import { TETIKLEYICILER } from "@/lib/is-akisi-tanimlar";
import { formatTarih } from "@/lib/format";

export const dynamic = "force-dynamic";

type Eylem = { tur: string; baslik?: string; mesaj?: string; gun?: number };

/**
 * İş akışı kuralları (Faz 8 / D2).
 *
 * Kurallar ZAMANLANMIŞ çalışır — buradaki tetikleyicilerin çoğu bir olay
 * değil, zamanın geçmesiyle oluşan bir DURUMDUR ("3 gündür hareketsiz
 * fırsat"). Çalıştırma `/api/gorevler` uç noktasından yapılır; kurulumu
 * `docs/DEPLOY.md` içinde anlatılır.
 */
export default async function OtomasyonPage() {
  await yetkiGerektir(IZIN.otomasyonGoruntule);
  const yonetir = await yetkiVarMi(IZIN.otomasyonYonet);

  const db = await getTenantDb();

  const [kurallar, sonCalismalar, ayar] = await Promise.all([
    db.isAkisi.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { calismalar: true } } },
    }),
    db.isAkisiCalismasi.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { isAkisi: { select: { ad: true } } },
    }),
    db.epostaAyari.findFirst({}),
  ]);

  const etiketOf = (t: string) =>
    TETIKLEYICILER.find((x) => x.deger === t)?.etiket ?? t;

  return (
    <div>
      <PageHeader
        title="Otomasyon"
        subtitle={`${kurallar.filter((k) => k.aktif).length} açık kural`}
        // E-posta ayarı buradan ÇIKARILDI (v1.26.0): SMTP/IMAP kurulumu iş
        // akışı kurallarının alt ayrıntısı değil, kendi başına bir sistem
        // ayarıdır. Artık Ayarlar bölümünün kendi sekmesi.
        action={yonetir ? <KuralPanel /> : undefined}
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-semibold text-foreground">İş akışı nasıl çalışır?</h2>
        <p className="text-sm text-muted-foreground">
          Kurallar <strong>zamanlanmış</strong> çalışır, olay anında değil. Çünkü buradaki
          tetikleyicilerin çoğu bir olay değil, zamanın geçmesiyle oluşan bir durumdur:
          &quot;3 gündür hareketsiz fırsat&quot;, &quot;son tarihi yaklaşan görev&quot;.
          Aynı kayıt için aynı uyarı <strong>iki kez gönderilmez</strong>. Bir kuralı
          beklemeden denemek için satırındaki şimşek düğmesini kullanın.
        </p>
        {!ayar?.aktif && (
          <p className="mt-2 text-sm text-amber-500">
            E-posta gönderimi kapalı — kurallar şu an yalnızca uygulama içi bildirim
            üretir.
          </p>
        )}
      </div>

      {kurallar.length === 0 ? (
        <EmptyState
          title="Henüz kural yok"
          description="Unutulan işleri sistem hatırlatsın: bekleyen fırsatlar, yaklaşan görevler, süresi dolan teklifler."
          action={yonetir ? <KuralPanel /> : undefined}
        />
      ) : (
        <div className="card mb-6 divide-y divide-border/50">
          {kurallar.map((k) => {
            const eylemler = (Array.isArray(k.eylemler) ? k.eylemler : []) as Eylem[];
            const kosullar = (k.kosullar ?? {}) as { gun?: number };

            return (
              <div key={k.id} className="flex flex-wrap items-start gap-3 p-4">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    k.aktif ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4" />
                </div>

                <div className="min-w-[220px] flex-1">
                  <p className="font-medium text-foreground">
                    {k.ad}
                    {!k.aktif && (
                      <span className="ml-2 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400">
                        Durduruldu
                      </span>
                    )}
                  </p>
                  {k.aciklama && (
                    <p className="text-sm text-muted-foreground">{k.aciklama}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {etiketOf(k.tetikleyici)}
                    {kosullar.gun != null && ` · ${kosullar.gun} gün`}
                    {" · "}
                    {eylemler
                      .map((e) => (e.tur === "gorev" ? "görev açar" : "bildirim gönderir"))
                      .join(" + ")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">
                    {k.calismaSayisi} çalıştırma · {k._count.calismalar} kayıt
                    {k.sonCalisma && ` · son ${formatTarih(k.sonCalisma)}`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {yonetir && (
                    <KuralPanel
                      mevcut={{
                        id: k.id,
                        ad: k.ad,
                        aciklama: k.aciklama ?? "",
                        tetikleyici: k.tetikleyici,
                        gun: kosullar.gun ?? 3,
                        aktif: k.aktif,
                        eylemBildirim: eylemler.some((e) => e.tur === "bildirim"),
                        eylemGorev: eylemler.some((e) => e.tur === "gorev"),
                        eylemBaslik: eylemler[0]?.baslik ?? "",
                        eylemMesaj: eylemler[0]?.mesaj ?? "",
                        gorevGun: eylemler.find((e) => e.tur === "gorev")?.gun ?? 1,
                      }}
                    />
                  )}
                  {yonetir && (
                    <KuralIslemleri kural={{ id: k.id, ad: k.ad, aktif: k.aktif }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sonCalismalar.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-foreground">Son çalışmalar</h2>
          <ul className="divide-y divide-border/50 text-sm">
            {sonCalismalar.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-2 py-2">
                <span
                  className={
                    c.sonuc === "basarili"
                      ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                      : "h-1.5 w-1.5 rounded-full bg-rose-500"
                  }
                  aria-hidden
                />
                <span className="text-foreground">{c.isAkisi.ad}</span>
                <span className="text-muted-foreground">— {c.ozet ?? "—"}</span>
                <span className="ml-auto text-xs text-muted-foreground/70">
                  {formatTarih(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
