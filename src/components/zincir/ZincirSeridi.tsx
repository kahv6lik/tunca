import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { zincirAnlamliMi, type ZincirHalkasi } from "@/lib/zincir-tanimlar";

/**
 * İlişkili kayıt zinciri şeridi — Faz 20 / U4.
 *
 * fırsat → teklif → sipariş → sevkiyat. Bakılan halka vurgulanır, dolu
 * halkalar bağlantıdır, boş halkalar soluk "—" olarak durur: eksik olanı
 * göstermek de bilgidir ("bu teklif henüz siparişe dönmemiş").
 *
 * Zincirde bakılan kayıttan başka dolu halka yoksa şerit HİÇ çizilmez.
 */
export default function ZincirSeridi({ halkalar }: { halkalar: ZincirHalkasi[] }) {
  if (!zincirAnlamliMi(halkalar)) return null;

  return (
    <div className="card mb-6 overflow-x-auto p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        İlişkili Kayıtlar
      </p>
      <ol className="flex items-stretch gap-1">
        {halkalar.map((h, i) => (
          <li key={h.tur} className="flex items-stretch gap-1">
            {i > 0 && (
              <ChevronRight
                className="mt-4 h-4 w-4 shrink-0 text-muted-foreground/40"
                aria-hidden
              />
            )}
            <Halka halka={h} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Halka({ halka }: { halka: ZincirHalkasi }) {
  const icerik = (
    <>
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/70">
        {halka.etiket}
      </span>
      <span
        className={`mt-0.5 block truncate font-mono text-sm ${
          halka.baslik ? "text-foreground" : "text-muted-foreground/50"
        }`}
      >
        {halka.baslik ?? "—"}
      </span>
      {halka.durum && (
        <span className="mt-1.5 block">
          <StatusBadge durum={halka.durum} />
        </span>
      )}
    </>
  );

  const sinif = `block min-w-[8.5rem] rounded-xl border px-3 py-2 transition-colors ${
    halka.aktif
      ? "border-primary/60 bg-primary/10"
      : "border-border/60 hover:border-border"
  }`;

  // Aktif halka kendi sayfasıdır; kendine bağlantı vermek kullanıcıyı
  // aynı yere götürür ve tıklanabilir görünmesi yanıltıcı olur.
  if (!halka.adres || halka.aktif) {
    return <div className={sinif}>{icerik}</div>;
  }
  return (
    <Link href={halka.adres} className={sinif}>
      {icerik}
    </Link>
  );
}
