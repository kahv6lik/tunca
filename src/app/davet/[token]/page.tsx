import { davetGoruntule } from "@/lib/davet-db";
import { ROL_ETIKET, rolNormalize } from "@/lib/yetki-tanimlar";
import { formatTarih } from "@/lib/format";
import DavetForm from "@/components/admin/DavetForm";

export const dynamic = "force-dynamic";

/**
 * Davet kabul sayfası (Faz 5 / B3) — GİRİŞ GEREKTİRMEZ.
 *
 * Davet kaydı `src/lib/davet-db.ts` üzerinden salt okunur. Geçersiz token'da
 * kuruluş adı bile gösterilmez: token'ı olmayan biri hiçbir kiracının
 * varlığını öğrenemez.
 */
export default async function DavetPage({ params }: { params: { token: string } }) {
  const davet = await davetGoruntule(params.token);

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/60 p-8 shadow-soft backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-2xl shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.8)]">
            🪐
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">Gezegen CRM</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Davet</p>
          </div>
        </div>

        {!davet?.gecerli ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-foreground">Davet geçersiz</h1>
            <p className="text-sm text-muted-foreground">
              Bu davet bağlantısı kullanılmış, süresi dolmuş ya da hiç var olmamış
              olabilir. Sizi davet eden yöneticiden yeni bir bağlantı isteyin.
            </p>
            <a href="/login" className="btn-secondary mt-2 inline-flex">
              Giriş sayfasına git
            </a>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {davet.kiraciAd} sizi davet etti
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong className="text-foreground">{davet.email}</strong> adresiyle{" "}
                {ROL_ETIKET[rolNormalize(davet.rol)] ?? davet.rol} olarak katılacaksınız.
                Devam etmek için bir şifre belirleyin.
              </p>
            </div>

            <DavetForm token={params.token} />

            <p className="text-xs text-muted-foreground">
              Bu bağlantı tek kullanımlıktır ve {formatTarih(davet.sonKullanma)} tarihinde
              geçerliliğini yitirir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
