import { DESTEK_ONCELIK } from "@/lib/constants";

/**
 * Öncelik rozeti (Faz 16 / P2).
 *
 * `StatusBadge` DEĞİL: öncelik bir durum değildir ve aynı anahtarlar
 * ("orta", "dusuk") durum sözlüğünde başka anlamlara gelebilirdi. Ayrı bir
 * rozet, iki kavramın renk sözlüğünü de ayrı tutar.
 */
const RENK: Record<string, string> = {
  dusuk: "bg-slate-500/15 text-slate-400 ring-slate-500/25",
  orta: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  yuksek: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  kritik: "bg-rose-500/15 text-rose-400 ring-rose-500/25",
};

export default function OncelikRozet({ oncelik }: { oncelik: string }) {
  const etiket = DESTEK_ONCELIK.find((o) => o.deger === oncelik)?.etiket ?? oncelik;
  const renk = RENK[oncelik] ?? RENK.orta;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${renk}`}
    >
      {etiket}
    </span>
  );
}
