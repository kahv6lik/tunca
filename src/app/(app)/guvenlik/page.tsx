import { getTenantContext } from "@/lib/tenant-db";
import { PageHeader } from "@/components/layout/page-header";
import { formatTarih } from "@/lib/format";
import {
  SifreDegistirFormu,
  IkiFaktorPanel,
  OturumIslemleri,
  DigerOturumlariKapatDugmesi,
} from "@/components/guvenlik/GuvenlikPanelleri";

export const dynamic = "force-dynamic";

function saatDakika(t: Date): string {
  return t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Hesap güvenliği — Faz 12 / F1-F3.
 *
 * Kullanıcının KENDİ hesabına ait ayarlar; ek izin gerekmez. Kuruluş çapındaki
 * politikalar (2FA zorunluluğu, oturum ömrü, saklama süresi) `/kullanicilar`
 * altındaki yönetim ekranındadır.
 */
export default async function GuvenlikPage() {
  const { db, session } = await getTenantContext();

  const [kullanici, kiraci, oturumlar] = await Promise.all([
    db.user.findFirst({
      where: { id: session.userId },
      select: { ikiFaktorAktif: true, yedekKodlar: true, sifreGuncellendi: true },
    }),
    db.tenant.findFirst({ where: { id: session.tenantId }, select: { ikiFaktorZorunlu: true } }),
    db.oturum.findMany({
      where: { userId: session.userId, sonKullanma: { gt: new Date() } },
      orderBy: { sonGorulme: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Hesap Güvenliği"
        subtitle={
          kullanici?.sifreGuncellendi
            ? `Şifre son güncelleme: ${formatTarih(kullanici.sifreGuncellendi)}`
            : undefined
        }
      />

      <section className="card mb-6 p-6">
        <h2 className="mb-1 font-semibold text-foreground">Şifre</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Şifrenizi değiştirdiğinizde bu cihaz dışındaki tüm oturumlarınız güvenlik
          gereği kapatılır.
        </p>
        <SifreDegistirFormu />
      </section>

      <section className="card mb-6 p-6">
        <h2 className="mb-1 font-semibold text-foreground">İki Faktörlü Doğrulama</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Şifrenize ek olarak telefonunuzdaki doğrulama uygulamasından 6 haneli bir kod
          istenir. Şifreniz çalınsa bile hesabınıza girilemez.
        </p>
        <IkiFaktorPanel
          aktif={!!kullanici?.ikiFaktorAktif}
          zorunlu={!!kiraci?.ikiFaktorZorunlu}
          kalanYedekKod={kullanici?.yedekKodlar.length ?? 0}
        />
      </section>

      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 font-semibold text-foreground">
              Açık Oturumlar{" "}
              <span className="text-muted-foreground/70">({oturumlar.length})</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Tanımadığınız bir cihaz görüyorsanız oturumu sonlandırın ve şifrenizi
              değiştirin.
            </p>
          </div>
          {oturumlar.length > 1 && <DigerOturumlariKapatDugmesi />}
        </div>

        <div className="divide-y divide-border/50">
          {oturumlar.map((o) => {
            const buOturum = !!session.jti && o.jti === session.jti;
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium text-foreground">
                    {o.cihaz ?? "Bilinmeyen cihaz"}
                    {buOturum && (
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                        bu cihaz
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.ip ? `${o.ip} · ` : ""}
                    Son etkinlik: {formatTarih(o.sonGorulme)} {saatDakika(o.sonGorulme)}
                  </p>
                </div>
                <OturumIslemleri id={o.id} buOturum={buOturum} />
              </div>
            );
          })}

          {oturumlar.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              Kayıtlı oturum yok. (Faz 12 öncesinden kalan çerezler burada listelenmez;
              süreleri dolduğunda kendiliğinden düşerler.)
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
