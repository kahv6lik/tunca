import Link from "next/link";
import { sifirlamaKaydiGetir } from "@/lib/giris-guvenlik";
import { SifirlaFormu } from "./SifirlaFormu";

export const dynamic = "force-dynamic";

/**
 * Şifre belirleme — Faz 12 / F1. Oturum gerektirmez (middleware'de açıktır).
 *
 * Geçersiz token'da hiçbir ayrıntı sızdırılmaz: "süresi dolmuş mu, kullanılmış
 * mı, hiç var olmadı mı" ayrımı yapılmaz.
 */
export default async function SifreSifirlaPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const kayit = await sifirlamaKaydiGetir(token);

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/40 p-8 shadow-soft backdrop-blur-xl sm:p-10">
        {!kayit ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Bağlantı geçersiz</h1>
              <p className="text-sm text-muted-foreground">
                Bu şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir
                bağlantı isteyebilirsiniz.
              </p>
            </div>
            <Link href="/sifremi-unuttum" className="btn-primary h-11 w-full">
              Yeni bağlantı iste
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Yeni şifre belirleyin</h1>
              <p className="text-sm text-muted-foreground">
                {kayit.kurulusAd} · {kayit.email}
              </p>
            </div>
            <SifirlaFormu token={token} />
          </>
        )}
      </div>
    </div>
  );
}
