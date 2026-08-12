"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import CamKatmanlari from "@/components/ui/CamKatmanlari";
import {
  gorunurSekmeler,
  etkinSekme,
  yolunBolumu,
} from "@/lib/bolum-tanimlar";

/**
 * Bölüm sekme çubuğu — v1.22.0.
 *
 * Sol menüdeki bir bölüme girildiğinde, o bölümün bütün ekranları sayfanın
 * ÜSTÜNDE sekme olarak durur. Böylece kullanıcı "CRM içindeyim, yanımda
 * kontaklar ve projeler de var" bilgisini kaybetmeden gezinir.
 *
 * Kabuğa TEK yerde bağlanır (`(app)/layout.tsx`): 25 sayfanın her birine
 * ayrı ayrı eklenseydi, yeni bir ekran eklendiğinde biri unutulurdu.
 *
 * Bulunulan yol bir bölüme ait değilse (Takvim, Raporlar, Yönetim, firma
 * detayı gibi) çubuk HİÇ çizilmez — tek ekranlı bir bölümün sekmesi
 * gürültüdür.
 *
 * İzin süzgeci: göremediği ekranın sekmesi çıkmaz.
 */
export default function BolumSekmeleri({ izinler }: { izinler: string[] }) {
  const pathname = usePathname();
  const b = yolunBolumu(pathname);
  if (!b) return null;

  const sekmeler = gorunurSekmeler(b, new Set(izinler));
  const etkin = etkinSekme(b, pathname);
  // Tek sekme kaldıysa çubuk bilgi vermez; kullanıcı zaten oradadır.
  if (sekmeler.length < 2) return null;

  return (
    <nav
      aria-label={`${b.etiket} bölümü`}
      className="cam sticky top-16 z-20 border-b border-border/40"
    >
      <CamKatmanlari />
      <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 md:px-6 lg:px-8">
        {sekmeler.map((s) => {
          // EN ÖZEL eşleşme kazanır: `/otomasyon/eposta` hem Otomasyon'a
          // hem E-posta'ya uyar, işaretli olan E-posta olmalıdır.
          const aktif = s === etkin;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "relative my-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                aktif
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Etkin sekmenin altındaki kayan kapsül (v1.24.0). */}
              {aktif && (
                <motion.span
                  layoutId="bolum-sekme-aktif"
                  className="cam-kapsul absolute inset-0 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
