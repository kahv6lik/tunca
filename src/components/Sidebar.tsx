"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Genel Bakış", icon: "📊" },
  { href: "/firmalar", label: "Firmalar", icon: "🏢" },
  { href: "/yatirim-destekleri", label: "Yatırım Destekleri", icon: "💰" },
  { href: "/egitimler", label: "Eğitimler", icon: "🎓" },
  { href: "/hizmetler", label: "Hizmetler", icon: "🛠️" },
  { href: "/raporlar", label: "Raporlar", icon: "📈" },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
          🪐
        </div>
        <span className="text-lg font-bold text-slate-900">Gezegen CRM</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
