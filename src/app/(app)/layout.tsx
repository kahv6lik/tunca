import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBandi } from "@/components/layout/impersonation-bandi";
import { requireSession } from "@/lib/auth";
import { etkinIzinler, rolNormalize, ROL_ETIKET } from "@/lib/yetki";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { getTenantDb } from "@/lib/tenant-db";
import { hexToHslDegerleri } from "@/lib/utils";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  // Menü, kullanıcının gerçekten erişebildiği bölümleri gösterir.
  const izinler = [...(await etkinIzinler())];
  const rolEtiket = ROL_ETIKET[rolNormalize(session.role)] ?? session.role;

  // Markalama (Faz 5 / B7) — kiracının ana rengi tema değişkenine yazılır,
  // böylece tek satırla bütün bileşenler kiracının rengini alır. Geçersiz bir
  // renk değeri yok sayılır ve varsayılan tema korunur.
  const ayar = await kiraciAyari();
  const marka = ayar.anaRenk ? hexToHslDegerleri(ayar.anaRenk) : null;

  // Okunmamış bildirim sayısı (Faz 8 / D5) — üst çubuktaki zil rozeti.
  const db = await getTenantDb();
  const okunmamisBildirim = await db.bildirim.count({
    where: { kullaniciId: session.userId, okundu: null },
  });

  return (
    <div
      className="min-h-screen"
      style={marka ? ({ "--primary": marka } as React.CSSProperties) : undefined}
    >
      {session.impersonatorEmail && (
        <ImpersonationBandi
          kiraciAd={session.tenantAd}
          yoneticiEmail={session.impersonatorEmail}
        />
      )}

      <Sidebar izinler={izinler} logoUrl={ayar.logoUrl} kiraciAd={ayar.ad} />
      <div className="lg:pl-64">
        <Topbar
          name={session.name}
          email={session.email}
          tenantAd={session.tenantAd}
          rolEtiket={rolEtiket}
          izinler={izinler}
          logout={logoutAction}
          platformAdmin={rolNormalize(session.role) === "platform_admin"}
          okunmamisBildirim={okunmamisBildirim}
        />
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
