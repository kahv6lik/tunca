"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Package, Gauge, ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Ogesi = { href: string; label: string; icon: LucideIcon };

const MENU: Ogesi[] = [
  { href: "/admin", label: "Genel Durum", icon: Gauge },
  { href: "/admin/kiracilar", label: "Kuruluşlar", icon: Building2 },
  { href: "/admin/paketler", label: "Paketler", icon: Package },
];

export function AdminNav() {
  const pathname = usePathname();

  function aktifMi(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {MENU.map((item) => {
        const aktif = aktifMi(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              aktif
                ? "border border-primary/30 bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", aktif && "text-primary")} />
            {item.label}
          </Link>
        );
      })}

      <div className="!mt-6 border-t border-border/60 pt-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
          CRM&apos;e dön
        </Link>
      </div>
    </nav>
  );
}
