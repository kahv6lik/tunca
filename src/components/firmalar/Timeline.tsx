import Link from "next/link";
import {
  Activity,
  Target,
  FileText,
  Wallet,
  GraduationCap,
  Wrench,
  Contact,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import type { TimelineOgesi } from "@/lib/timeline";
import { StatusBadge } from "@/components/ui/badge";
import { formatTarih } from "@/lib/format";

const IKON: Record<TimelineOgesi["tur"], LucideIcon> = {
  aktivite: Activity,
  firsat: Target,
  teklif: FileText,
  yatirim: Wallet,
  egitim: GraduationCap,
  hizmet: Wrench,
  kisi: Contact,
  destek: LifeBuoy,
};

const RENK: Record<TimelineOgesi["tur"], string> = {
  aktivite: "bg-primary/10 text-primary",
  firsat: "bg-violet-500/10 text-violet-400",
  teklif: "bg-amber-500/10 text-amber-400",
  yatirim: "bg-emerald-500/10 text-emerald-500",
  egitim: "bg-sky-500/10 text-sky-400",
  hizmet: "bg-indigo-500/10 text-indigo-400",
  kisi: "bg-slate-500/10 text-slate-400",
  destek: "bg-rose-500/10 text-rose-400",
};

const TUR_ETIKET: Record<TimelineOgesi["tur"], string> = {
  aktivite: "Aktivite",
  firsat: "Fırsat",
  teklif: "Teklif",
  yatirim: "Yatırım Desteği",
  egitim: "Eğitim",
  hizmet: "Hizmet",
  kisi: "Kişi",
  destek: "Destek Kaydı",
};

/**
 * Firma zaman akışı (Faz 7 / C6).
 *
 * Tek kronolojik şerit: hangi modülden geldiği ikon ve renkle ayrılır.
 * Sunucu bileşenidir — veri `src/lib/timeline.ts` içinde, izin süzgecinden
 * geçirilerek toplanır.
 */
export function Timeline({ ogeler }: { ogeler: TimelineOgesi[] }) {
  if (ogeler.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground/70">
        Bu firma için henüz kayıt yok.
      </p>
    );
  }

  return (
    <ol className="relative space-y-1">
      {/* Dikey çizgi */}
      <span
        className="absolute bottom-4 left-[18px] top-4 w-px bg-border/60"
        aria-hidden
      />

      {ogeler.map((o) => {
        const Ikon = IKON[o.tur];
        const govde = (
          <div className="flex-1 rounded-xl px-3 py-2 transition-colors group-hover:bg-accent/40">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="font-medium text-foreground">{o.baslik}</p>
              {o.durum && <StatusBadge durum={o.durum} />}
            </div>
            {o.aciklama && (
              <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {o.aciklama}
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {TUR_ETIKET[o.tur]}
              {o.etiket && ` · ${o.etiket}`}
              {` · ${formatTarih(o.tarih)}`}
            </p>
          </div>
        );

        return (
          <li key={o.id} className="group relative flex gap-3">
            <span
              className={`z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-4 ring-card ${RENK[o.tur]}`}
            >
              <Ikon className="h-4 w-4" />
            </span>
            {o.link ? (
              <Link href={o.link} className="flex flex-1">
                {govde}
              </Link>
            ) : (
              govde
            )}
          </li>
        );
      })}
    </ol>
  );
}
