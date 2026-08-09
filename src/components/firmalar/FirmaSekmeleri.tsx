import Link from "next/link";
import { gorunurSekmeler } from "@/lib/firma-sekme-tanimlar";

/**
 * Firma çalışma ekranının sekme çubuğu — Faz 20 / U3.
 *
 * Sunucu bileşenidir ve düz `<Link>` üretir: sekme değişimi bir gezinmedir,
 * istemci durumu değil. Böylece sekme yer imine eklenebilir, yeni sekmede
 * açılabilir ve geri tuşu beklendiği gibi çalışır.
 */
export default function FirmaSekmeleri({
  firmaId,
  aktif,
  izinler,
  sayilar,
}: {
  firmaId: string;
  aktif: string;
  izinler: Set<string>;
  /** Sekme adında gösterilecek sayı (varsa) — "Kontaklar 4" gibi. */
  sayilar?: Record<string, number | undefined>;
}) {
  const sekmeler = gorunurSekmeler(izinler);

  return (
    <nav
      aria-label="Firma bölümleri"
      className="mb-6 flex flex-wrap gap-1 border-b border-border/60"
    >
      {sekmeler.map((s) => {
        const secili = s.anahtar === aktif;
        const sayi = sayilar?.[s.anahtar];
        return (
          <Link
            key={s.anahtar}
            href={`/firmalar/${firmaId}?sekme=${s.anahtar}`}
            aria-current={secili ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              secili
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.etiket}
            {typeof sayi === "number" && sayi > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground/70">{sayi}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
