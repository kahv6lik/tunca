import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export function Pagination({
  page,
  totalPages,
  baseUrl,
}: {
  page: number;
  totalPages: number;
  baseUrl: string; // örn "/firmalar?ara=abc&"
}) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <div className="mt-5 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Sayfa <span className="font-medium text-foreground">{page}</span> / {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={`${baseUrl}sayfa=${prev}`}
          aria-disabled={page <= 1}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            page <= 1 && "pointer-events-none opacity-40"
          )}
        >
          <ChevronLeft className="h-4 w-4" /> Önceki
        </Link>
        <Link
          href={`${baseUrl}sayfa=${next}`}
          aria-disabled={page >= totalPages}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            page >= totalPages && "pointer-events-none opacity-40"
          )}
        >
          Sonraki <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
