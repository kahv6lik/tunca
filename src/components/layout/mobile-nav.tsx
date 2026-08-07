"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./sidebar-nav";
import { Brand } from "./brand";

export function MobileNav({ izinler = [] }: { izinler?: string[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();
  const izinKumesi = new Set(izinler);
  const gorunenler = NAV.filter((i) => !i.izin || izinKumesi.has(i.izin));

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      <button
        aria-label="Menü"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 text-muted-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border/70 bg-card/95 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <Brand />
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {gorunenler
                  .filter((i) => i.bolum !== "yonetim")
                  .map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "border border-primary/30 bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                        {item.label}
                      </Link>
                    );
                  })}
                {gorunenler.some((i) => i.bolum === "yonetim") && (
                  <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Yönetim
                  </p>
                )}
                {gorunenler
                  .filter((i) => i.bolum === "yonetim")
                  .map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "border border-primary/30 bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                        {item.label}
                      </Link>
                    );
                  })}
              </nav>
            </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
