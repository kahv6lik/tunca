import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import YanPanel from "@/components/panel/YanPanel";
import BolumSekmeleri from "@/components/layout/BolumSekmeleri";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBandi } from "@/components/layout/impersonation-bandi";
import { requireSession } from "@/lib/auth";
import { etkinIzinler, rolNormalize, ROL_ETIKET, IZIN } from "@/lib/yetki";
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

  /*
    Doğal dilde sorgu satırı (Faz 21 / G3) yalnızca izin + kiracı ayarı
    açıkken gösterilir. Anahtar kontrolü kasten BURADA YOK: kural tabanlı
    ayrıştırıcı anahtarsız da çalışır, yani özellik anahtar olmadan da
    işlevlidir — model yalnızca çözülemeyen cümlelerde devreye girer.
  */
  const aiHazir = izinler.includes(IZIN.aiKullan) && ayar.aiAcik;
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
      <div className="lg:pl-60">
        <Topbar
          name={session.name}
          email={session.email}
          tenantAd={session.tenantAd}
          rolEtiket={rolEtiket}
          izinler={izinler}
          logout={logoutAction}
          aiAcik={aiHazir}
          platformAdmin={rolNormalize(session.role) === "platform_admin"}
          okunmamisBildirim={okunmamisBildirim}
        />
        {/*
          Bölüm sekmeleri (v1.22.0) — kabuğa TEK yerde bağlanır. Bulunulan
          yol bir bölüme aitse o bölümün ekranları üstte sekme olarak durur;
          değilse hiç çizilmez.
        */}
        <Suspense fallback={null}>
          <BolumSekmeleri izinler={izinler} />
        </Suspense>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/*
        Yan panel (Faz 20 / U2) — kabuğa TEK yerde bağlanır. Hangi kaydın
        açık olduğu querystring'de durduğu için listelerin hiçbiri panel
        durumu taşımaz; yalnızca `PanelBaglantisi` kullanırlar.
      */}
      <Suspense fallback={null}>
        <YanPanel />
      </Suspense>
    </div>
  );
}
