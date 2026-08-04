"use client";

import { Search } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar({
  name,
  email,
  tenantAd,
  logout,
}: {
  name: string;
  email: string;
  tenantAd: string;
  logout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <MobileNav />

      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Ara…"
          className="h-9 w-full rounded-xl border border-border/70 bg-secondary/40 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-secondary/60"
        />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Aktif kiracı — kullanıcı hangi kuruluşun verisine baktığını her an görür */}
        <span
          title="Aktif kuruluş"
          className="hidden max-w-[200px] truncate rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block"
        >
          {tenantAd}
        </span>
        <ThemeToggle />
        <div className="hidden h-6 w-px bg-border/70 sm:block" />
        <UserMenu name={name} email={email} logout={logout} />
      </div>
    </header>
  );
}
