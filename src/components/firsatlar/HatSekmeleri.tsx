import Link from "next/link";
import { LayoutGrid, List, UserPlus } from "lucide-react";

/**
 * Satış hattı sekmeleri — Faz 13 / H5.
 *
 * Ortağın bulgusu: "adaylar fırsatların içine alınsın". Aday, fırsatın
 * ÖNCESİDİR: aynı işin ilk hâlidir ve aynı ekip tarafından takip edilir.
 * Menüde ayrı bir başlık olması, kullanıcıyı aynı akış için iki farklı yere
 * bakmaya zorluyordu.
 *
 * `/adaylar` ROTASI KORUNDU: kayıtlı görünümler, dışa aktarım bağlantıları ve
 * bildirim linkleri o adrese işaret ediyor; taşımak eskiyi kırardı. Değişen
 * yalnızca gezinme — aday listesi artık hattın bir sekmesi olarak açılıyor.
 */
export default function HatSekmeleri({
  aktif,
  kanbanHref = "/firsatlar",
  listeHref = "/firsatlar?gorunum=liste",
  adayGorur,
}: {
  aktif: "kanban" | "liste" | "adaylar";
  kanbanHref?: string;
  listeHref?: string;
  adayGorur: boolean;
}) {
  const sinif = (kendi: string, ilk = false) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm ${ilk ? "" : "border-l border-border/70"} ${
      aktif === kendi
        ? "bg-secondary/70 text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex overflow-hidden rounded-xl border border-border/70">
      <Link href={kanbanHref} className={sinif("kanban", true)}>
        <LayoutGrid className="h-4 w-4" /> Kanban
      </Link>
      <Link href={listeHref} className={sinif("liste")}>
        <List className="h-4 w-4" /> Liste
      </Link>
      {adayGorur && (
        <Link href="/adaylar" className={sinif("adaylar")}>
          <UserPlus className="h-4 w-4" /> Adaylar
        </Link>
      )}
    </div>
  );
}
