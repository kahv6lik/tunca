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
  Sparkles,
  Package,
  Ticket,
  Warehouse,
  ShoppingCart,
  Truck,
  FileLock2,
  FolderKanban,
  LifeBuoy,
  HelpCircle,
  MapPin,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bolum, bolumHedefi, sekmeAktifMi } from "@/lib/bolum-tanimlar";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  izin?: string;
  /** "yonetim" işaretli öğeler menüde "Yönetim" başlığı altında gruplanır. */
  bolum?: "yonetim";
  /**
   * Menüde kendi başlığı OLMAYAN ama bu öğeye ait rotalar (Faz 13 / H5).
   * `/adaylar` fırsatların bir sekmesidir; oradayken menüde "Fırsatlar"
   * işaretli kalmalı, yoksa kullanıcı menüden düşmüş gibi hisseder.
   */
  esRotalar?: string[];
  /**
   * Öğe bir BÖLÜM ise (`bolum-tanimlar.ts`), anahtarı. Hedef adres ve
   * "etkin mi" kararı o defterden, kullanıcının izinlerine göre hesaplanır.
   */
  bolumAnahtari?: string;
};

/**
 * Menü öğeleri. `izin` alanı olanlar yalnızca o izne sahip kullanıcıya
 * gösterilir — ama bu YALNIZCA kolaylıktır: sayfanın kendisi de sunucuda
 * `yetkiGerektir` ile korunur. Menüyü gizlemek koruma değildir.
 */
export const NAV: NavItem[] = [
  { href: "/", label: "Genel Bakış", icon: LayoutDashboard },

  /*
    ── BÖLÜMLER (v1.22.0) ──────────────────────────────────────────────
    Sol menüde 25'e yakın öğe vardı; günlük işte kullanılan beş ekranı
    bulmak için her seferinde uzun bir listeyi taramak gerekiyordu.

    Artık iki bölüm var ve içerikleri `src/lib/bolum-tanimlar.ts`
    dosyasındadır. Bölüme tıklanınca kullanıcının GÖREBİLDİĞİ ilk ekran
    açılır (sabit adres yazılsaydı, o ekrana izni olmayan kullanıcı
    /yetkisiz'e düşerdi); bölümün diğer ekranları sayfanın üstünde sekme
    olarak durur.

    `href` burada YALNIZCA bir başlangıç değeridir; gerçek hedef
    `bolumHedefi()` ile kullanıcının izinlerine göre hesaplanır.
    `esRotalar` bölümün bütün rotalarını taşır ki kullanıcı bölüm içinde
    gezerken sol menüde o bölüm işaretli kalsın.
  */
  { href: "/firmalar", label: "CRM", icon: Building2, bolumAnahtari: "crm" },
  { href: "/teklifler", label: "Satış Yönetimi", icon: ShoppingCart, bolumAnahtari: "satis" },

  { href: "/takvim", label: "Takvim", icon: CalendarDays, izin: "takvim.goruntule" },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3, izin: "rapor.goruntule" },
  // SSS tek ekranlıdır ve bir bölüme ait değildir: destek kaydından da,
  // menüden de doğrudan açılır.
  { href: "/sss", label: "SSS (Bilgi Bankası)", icon: HelpCircle, izin: "sss.goruntule" },

  // ── Yönetim: kuruluşun yönetimsel işleri tek başlık altında toplanır. ──
  // (Platformlar ÜSTÜ yönetim ayrıdır: /admin, yalnızca platform_admin.)
  // İçe aktarım da buraya alındı: günlük bir iş değil, kurulum işidir.
  { href: "/ice-aktar", label: "İçe Aktar", icon: Upload, izin: "firma.olustur", bolum: "yonetim" },
  { href: "/kullanicilar", label: "Kullanıcılar", icon: Users, izin: "kullanici.yonet", bolum: "yonetim" },
  { href: "/gruplar", label: "Gruplar", icon: Users, izin: "grup.yonet", bolum: "yonetim" },
  { href: "/ozel-alanlar", label: "Özel Alanlar", icon: ListPlus, izin: "ozelalan.yonet", bolum: "yonetim" },
  { href: "/otomasyon", label: "Otomasyon", icon: Zap, izin: "otomasyon.goruntule", bolum: "yonetim" },
  { href: "/denetim", label: "Denetim Günlüğü", icon: ScrollText, izin: "denetim.goruntule", bolum: "yonetim" },
  // AI ayarı yönetim işidir: veriyi dışarı açma kararı ve kullanım defteri.
  { href: "/ai", label: "AI Özellikleri", icon: Sparkles, izin: "ai.kullan", bolum: "yonetim" },
  // KVKK herkese açıktır: aydınlatma metni ve kendi rızası kişisel bir haktır.
  { href: "/kvkk", label: "KVKK", icon: FileLock2, bolum: "yonetim" },
  { href: "/yedekler", label: "Yedekler", icon: DatabaseBackup, izin: "yedek.yonet", bolum: "yonetim" },
];

/** Bir menü öğesi bu yolda etkin mi? Masaüstü ve mobil menü aynı kuralı kullanır. */
export function navAktifMi(item: NavItem, pathname: string) {
  if (item.href === "/") return pathname === "/";
  // Bölüm öğeleri: bölümün HERHANGİ bir sekmesindeyken işaretli kalır.
  if (item.bolumAnahtari) {
    const b = bolum(item.bolumAnahtari);
    return b ? b.sekmeler.some((sk) => sekmeAktifMi(sk, pathname)) : false;
  }
  return [item.href, ...(item.esRotalar ?? [])].some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

/**
 * Öğenin gerçek hedefi.
 *
 * Bölümlerde sabit bir adres yazmak yerine kullanıcının GÖREBİLDİĞİ ilk
 * sekmeye gidilir; aksi hâlde o ekrana izni olmayan kullanıcı bölüme
 * tıklayınca `/yetkisiz`e düşerdi.
 */
export function navHedefi(item: NavItem, izinler: Set<string>): string | null {
  if (!item.bolumAnahtari) {
    return !item.izin || izinler.has(item.izin) ? item.href : null;
  }
  const b = bolum(item.bolumAnahtari);
  return b ? bolumHedefi(b, izinler) : null;
}

export function SidebarNav({ izinler = [] }: { izinler?: string[] }) {
  const pathname = usePathname();
  const izinKumesi = new Set(izinler);
  // Bölüm öğesi, İÇİNDE görebildiği en az bir ekran varsa görünür; hiç
  // sekmesi yoksa boş bir başlık göstermenin anlamı yok.
  const gorunenler = NAV.filter((i) => navHedefi(i, izinKumesi) !== null);
  const ana = gorunenler.filter((i) => i.bolum !== "yonetim");
  const yonetim = gorunenler.filter((i) => i.bolum === "yonetim");

  function oge(item: NavItem) {
    const active = navAktifMi(item, pathname);
    const Icon = item.icon;
    const hedef = navHedefi(item, izinKumesi) ?? item.href;
    return (
      <Link
        key={item.href}
        href={hedef}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {active && (
          /* Etkin öğenin kapsülü (v1.24.0): cam yüzeyin üstünde kayan
             bir damla. Hareket saf transformdur (layoutId), yani düzen
             yeniden hesaplanmaz. */
          <motion.span
            layoutId="sidebar-active"
            className="cam-kapsul absolute inset-0 rounded-lg"
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
