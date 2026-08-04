import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card flex max-w-md flex-col items-center gap-5 p-12 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl" />
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-primary">
            <Compass className="h-9 w-9" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-4xl font-bold text-foreground">404</p>
          <p className="text-sm text-muted-foreground">
            Aradığınız sayfa bulunamadı ya da taşınmış olabilir.
          </p>
        </div>
        <Link href="/" className="btn-primary">
          <ArrowLeft className="h-4 w-4" /> Panele dön
        </Link>
      </div>
    </div>
  );
}
