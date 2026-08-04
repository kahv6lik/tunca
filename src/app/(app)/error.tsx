"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 ring-1 ring-inset ring-rose-500/25">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Bir şeyler ters gitti</h2>
          <p className="text-sm text-muted-foreground">
            Bu bölüm yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
          </p>
        </div>
        <button onClick={reset} className="btn-primary">
          <RotateCw className="h-4 w-4" /> Tekrar dene
        </button>
      </div>
    </div>
  );
}
