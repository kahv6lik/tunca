import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { ROL, ROL_ETIKET } from "@/lib/yetki-tanimlar";
import { PageHeader } from "@/components/layout/page-header";
import { formatTarih } from "@/lib/format";
import {
  EkipSatirIslemleri,
  DavetPaneli,
  DavetIptalDugmesi,
  GuvenlikPolitikasiFormu,
} from "@/components/kullanicilar/EkipPanel";
import { kiraciAyari } from "@/lib/kiraci-ayar";

export const dynamic = "force-dynamic";

/**
 * Kullanıcılar — kuruluş içi ekip yönetimi (kullanici.yonet).
 *
 * Kuruluş yöneticisi kendi ekibini BURADAN yönetir: davet, rol, durum,
 * şifre sıfırlama. Platform sahibinin /admin paneli ise kuruluşlar ÜSTÜ
 * işler içindir (kiracı açma, paket atama) — ikisi bilinçli olarak ayrıdır.
 */
export default async function KullanicilarPage() {
  await yetkiGerektir(IZIN.kullaniciYonet);
  const { db, session } = await getTenantContext();
  const ayar = await kiraciAyari();

  const [kullanicilar, davetler, kiraci] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true, role: true, durum: true, createdAt: true,
        ikiFaktorAktif: true,
      },
    }),
    db.davet.findMany({
      where: { kullanildi: null, sonKullanma: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, ad: true, rol: true, sonKullanma: true },
    }),
    db.tenant.findFirst({
      where: { id: session.tenantId },
      select: { ikiFaktorZorunlu: true, oturumOmruGun: true, veriSaklamaGun: true },
    }),
  ]);

  const limitYazi =
    ayar.kullaniciLimiti > 0
      ? `${kullanicilar.length} / ${ayar.kullaniciLimiti} kullanıcı`
      : `${kullanicilar.length} kullanıcı`;

  return (
    <div>
      <PageHeader title="Kullanıcılar" subtitle={limitYazi} action={<DavetPaneli />} />

      <div className="card mb-6 p-5 text-sm text-muted-foreground">
        <p>
          Ekibinizi buradan yönetirsiniz: <strong className="text-foreground">Davet Et</strong>{" "}
          ile bağlantı üretin, yeni kişi şifresini kendisi belirlesin. Rol, hesabın neler
          yapabileceğini belirler; ayrıca <strong className="text-foreground">Gruplar</strong>{" "}
          ekranından ek izinler verilebilir. Kendi hesabınızın rolünü ve durumunu burada
          değiştiremezsiniz — kuruluş yönetimsiz kalmasın.
        </p>
      </div>

      {davetler.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Bekleyen davetler ({davetler.length})
            </h2>
          </div>
          <table className="min-w-full divide-y divide-border/60">
            <tbody className="divide-y divide-border/50">
              {davetler.map((d) => (
                <tr key={d.id} className="hover:bg-muted/40">
                  <td className="td font-medium">{d.ad}</td>
                  <td className="td">{d.email}</td>
                  <td className="td">{ROL_ETIKET[d.rol] ?? d.rol}</td>
                  <td className="td text-muted-foreground">
                    Son geçerlilik: {formatTarih(d.sonKullanma)}
                  </td>
                  <td className="td text-right">
                    <DavetIptalDugmesi id={d.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-border/60">
          <thead className="bg-muted/30">
            <tr>
              <th className="th">Kullanıcı</th>
              <th className="th">Rol</th>
              <th className="th">Durum</th>
              <th className="th">Katılım</th>
              <th className="th text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {kullanicilar.map((k) => {
              const benim = k.id === session.userId;
              const platform = k.role === ROL.platformAdmin;
              return (
                <tr key={k.id} className="hover:bg-muted/40">
                  <td className="td">
                    <p className="font-medium text-foreground">
                      {k.name}
                      {benim && (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                          siz
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{k.email}</p>
                  </td>
                  <td className="td">{ROL_ETIKET[k.role] ?? k.role}</td>
                  <td className="td">
                    <span
                      className={
                        k.durum === "aktif"
                          ? "inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-500 ring-1 ring-inset ring-emerald-500/25"
                          : "inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border"
                      }
                    >
                      {k.durum === "aktif" ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="td text-muted-foreground">{formatTarih(k.createdAt)}</td>
                  <td className="td">
                    {platform ? (
                      <p className="text-right text-xs text-muted-foreground">
                        Platform hesabı — buradan yönetilmez
                      </p>
                    ) : (
                      <EkipSatirIslemleri
                        kullanici={{ id: k.id, email: k.email, rol: k.role, durum: k.durum }}
                        benim={benim}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="mb-1 font-semibold text-foreground">Güvenlik Politikası</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Kuruluşunuzun tamamı için geçerli kurallar. Kişisel ayarlarınız (kendi
          şifreniz, iki faktörünüz, oturumlarınız) profil menüsündeki{" "}
          <strong className="text-foreground">Hesap Güvenliği</strong> ekranındadır.
        </p>
        <GuvenlikPolitikasiFormu
          ikiFaktorZorunlu={!!kiraci?.ikiFaktorZorunlu}
          oturumOmruGun={kiraci?.oturumOmruGun ?? 7}
          veriSaklamaGun={kiraci?.veriSaklamaGun ?? 0}
          ikiFaktorsuzSayi={kullanicilar.filter((k) => !k.ikiFaktorAktif).length}
        />
      </section>
    </div>
  );
}
