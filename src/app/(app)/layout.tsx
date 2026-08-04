import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "./actions";

const MOBILE_NAV = [
  { href: "/", label: "Panel" },
  { href: "/firmalar", label: "Firmalar" },
  { href: "/yatirim-destekleri", label: "Yatırım" },
  { href: "/egitimler", label: "Eğitim" },
  { href: "/hizmetler", label: "Hizmet" },
  { href: "/raporlar", label: "Rapor" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              🪐
            </div>
            <span className="font-bold">Gezegen CRM</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {session.name}
              </p>
              <p className="text-xs text-slate-500">{session.email}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary text-sm">
                Çıkış
              </button>
            </form>
          </div>
        </header>

        {/* Mobil navigasyon */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
