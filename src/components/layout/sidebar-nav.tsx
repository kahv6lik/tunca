"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  GraduationCap,
  Wrench,
  Contact,
  Target,
  UserPlus,
  CheckSquare,
  FileText,
  CalendarDays,
  Zap,
  Upload,
  DatabaseBackup,
  ListPlus,
  BarChart3,
  Users,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  izin?: string;
  /** "yonetim" işaretli öğeler menüde "Yönetim" başlığı altında gruplanır. */
  bolum?: "yonetim";
};

/**
 * Menü öğeleri. `izin` alanı olanlar yalnızca o izne sahip kullanıcıya
 * gösterilir — ama bu YALNIZCA kolaylıktır: sayfanın kendisi de sunucuda
 * `yetkiGerektir` ile korunur. Menüyü gizlemek koruma değildir.
 */
export const NAV: NavItem[] = [
  { href: "/", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/firmalar", label: "Firmalar", icon: Building2, izin: "firma.goruntule" },
  { href: "/kisiler", label: "Kişiler", icon: Contact, izin: "kisi.goruntule" },
  { href: "/firsatlar", label: "Fırsatlar", icon: Target, izin: "firsat.goruntule" },
  { href: "/adaylar", label: "Adaylar", icon: UserPlus, izin: "lead.goruntule" },
  { href: "/teklifler", label: "Teklifler", icon: FileText, izin: "teklif.goruntule" },
  { href: "/aktiviteler", label: "Aktiviteler", icon: CheckSquare, izin: "aktivite.goruntule" },
  { href: "/yatirim-destekleri", label: "Yatırım Destekleri", icon: Wallet, izin: "yatirim.goruntule" },
  { href: "/egitimler", label: "Eğitimler", icon: GraduationCap, izin: "egitim.goruntule" },
  { href: "/hizmetler", label: "Hizmetler", icon: Wrench, izin: "hizmet.goruntule" },
  { href: "/takvim", label: "Takvim", icon: CalendarDays, izin: "takvim.goruntule" },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3, izin: "rapor.goruntule" },
  // İçe aktarım firma OLUŞTURMA yetkisi olanlara görünür; sayfa da izinli
  // veri kümesi yoksa kendini açmaz.
  { href: "/ice-aktar", label: "İçe Aktar", icon: Upload, izin: "firma.olustur" },

  // ── Yönetim: kuruluşun yönetimsel işleri tek başlık altında toplanır. ──
  // (Platformlar ÜSTÜ yönetim ayrıdır: /admin, yalnızca platform_admin.)
  { href: "/kullanicilar", label: "Kullanıcılar", icon: Users, izin: "kullanici.yonet", bolum: "yonetim" },
  { href: "/gruplar", label: "Gruplar", icon: Users, izin: "grup.yonet", bolum: "yonetim" },
  { href: "/ozel-alanlar", label: "Özel Alanlar", icon: ListPlus, izin: "ozelalan.yonet", bolum: "yonetim" },
  { href: "/otomasyon", label: "Otomasyon", icon: Zap, izin: "otomasyon.goruntule", bolum: "yonetim" },
  { href: "/denetim", label: "Denetim Günlüğü", icon: ScrollText, izin: "denetim.goruntule", bolum: "yonetim" },
  { href: "/yedekler", label: "Yedekler", icon: DatabaseBackup, izin: "yedek.yonet", bolum: "yonetim" },
];

export function SidebarNav({ izinler = [] }: { izinler?: string[] }) {
  const pathname = usePathname();
  const izinKumesi = new Set(izinler);
  const gorunenler = NAV.filter((i) => !i.izin || izinKumesi.has(i.izin));
  const ana = gorunenler.filter((i) => i.bolum !== "yonetim");
  const yonetim = gorunenler.filter((i) => i.bolum === "yonetim");

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function oge(item: NavItem) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-lg border border-primary/30 bg-primary/10"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <Icon
          className={cn(
            "relative z-10 h-4 w-4 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className="relative z-10">{item.label}</span>
        {active && (
          <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.6)]" />
        )}
      </Link>
    );
  }

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {ana.map(oge)}
      {yonetim.length > 0 && (
        <>
          <p className="px-3 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Yönetim
          </p>
          {yonetim.map(oge)}
        </>
      )}
    </nav>
  );
}
