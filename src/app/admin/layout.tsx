import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { platformOturumu } from "@/lib/platform-db";
import { AdminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { APP_VERSION_ETIKET } from "@/lib/version";
import { logoutAction } from "@/app/(app)/actions";

/**
 * Admin panel kabuğu (Faz 5).
 *
 * Bu bölümün TAMAMI `platformOturumu()` ile korunur: `platform_admin`
 * olmayan biri hangi alt sayfayı denerse denesin `/yetkisiz`e düşer. Alt
 * sayfalar ayrıca `getPlatformDb()` üzerinden veri okur ve o da aynı kontrolü
 * bağımsız olarak yineler — layout'a güvenip kontrolü atlamıyoruz, çünkü
 * Server Action'lar layout'tan geçmez.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await platformOturumu();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_6px_18px_-6px_rgb(245_158_11/0.8)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-foreground">Platform</p>
            <p className="-mt-0.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Yönetim
            </p>
          </div>
        </div>

        <AdminNav />

        <div className="border-t border-border/60 p-3">
          <p className="px-2 text-xs text-muted-foreground">
            Gezegen CRM · {APP_VERSION_ETIKET}
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
          <Link href="/admin" className="text-sm font-semibold text-foreground lg:hidden">
            Platform Yönetimi
          </Link>
          <span className="ml-auto hidden rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500 sm:block">
            Platform yöneticisi
          </span>
          <ThemeToggle />
          <div className="hidden h-6 w-px bg-border/70 sm:block" />
          <UserMenu name={session.name} email={session.email} logout={logoutAction} />
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
