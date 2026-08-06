import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth";
import { etkinIzinler, rolNormalize, ROL_ETIKET } from "@/lib/yetki";
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

  return (
    <div className="min-h-screen">
      <Sidebar izinler={izinler} />
      <div className="lg:pl-64">
        <Topbar
          name={session.name}
          email={session.email}
          tenantAd={session.tenantAd}
          rolEtiket={rolEtiket}
          izinler={izinler}
          logout={logoutAction}
        />
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
