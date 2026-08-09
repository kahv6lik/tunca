import { anketGoruntule } from "@/lib/anket-db";
import YanitFormu from "@/components/anketler/YanitFormu";

export const dynamic = "force-dynamic";

/**
 * Anket yanıtlama sayfası (Faz 19 / N3) — GİRİŞ GEREKTİRMEZ.
 *
 * Anketi dolduran kişi müşterinin bir çalışanıdır; uygulamanın kullanıcısı
 * değildir ve olmayacaktır. Veri erişimi `src/lib/anket-db.ts` üzerinden,
 * dar kapsamlı `app.anket` bağlamıyla yapılır.
 *
 * GEÇERSİZ TOKEN'DA HİÇBİR ŞEY SIZDIRILMAZ: kuruluşun adı, anketin başlığı,
 * hatta böyle bir anketin var olup olmadığı bile gösterilmez (davet
 * sayfasındaki aynı karar).
 */
export default async function AnketPage(props: {
  params: Promise<{ token: string }>;
}) {
  const params = await props.params;
  const anket = await anketGoruntule(params.token);

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-background p-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-2xl shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.8)]">
            🪐
          </div>
          <p className="text-sm text-muted-foreground">Görüş formu</p>
        </div>

        {!anket ? (
          <div className="card p-8 text-center">
            <p className="text-lg font-semibold text-foreground">Bağlantı geçersiz</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu anket bağlantısı bulunamadı. Bağlantıyı e-postadan yeniden
              kopyalayıp deneyin.
            </p>
          </div>
        ) : anket.engel ? (
          <div className="card p-8 text-center">
            <p className="text-lg font-semibold text-foreground">{anket.baslik}</p>
            <p className="mt-2 text-sm text-muted-foreground">{anket.engel}</p>
          </div>
        ) : (
          <>
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{anket.baslik}</h1>
              {anket.aciklama && (
                <p className="mt-2 text-sm text-muted-foreground">{anket.aciklama}</p>
              )}
              {anket.alici && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Sayın {anket.alici}
                </p>
              )}
            </header>

            <YanitFormu
              token={params.token}
              sorular={anket.sorular}
              anonim={anket.anonim}
            />

            <p className="mt-6 text-center text-xs text-muted-foreground/70">
              Bu bağlantı size özeldir ve bir kez kullanılabilir.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
