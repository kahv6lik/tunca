import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, IZIN_MODULLERI, IZIN_ETIKET, ROL_ETIKET, rolNormalize } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTarih } from "@/lib/format";
import GrupPanel from "@/components/gruplar/GrupPanel";
import UyelikSatiri from "@/components/gruplar/UyelikSatiri";

export const dynamic = "force-dynamic";

/**
 * Kullanıcı grupları (Faz 4 / A7).
 *
 * Grup, izinleri toplu atamanın yoludur. Bir kullanıcının etkin izinleri =
 * rolünün izinleri ∪ üye olduğu grupların izinleri. Yani grup yalnızca EKLER,
 * hiçbir zaman kısıtlamaz.
 */
export default async function GruplarPage() {
  await yetkiGerektir(IZIN.grupYonet);
  const db = await getTenantDb();

  const [gruplar, kullanicilar] = await Promise.all([
    db.grup.findMany({
      orderBy: { ad: "asc" },
      include: {
        uyeler: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, durum: true },
    }),
  ]);

  const izinSecenekleri = IZIN_MODULLERI.map((m) => ({
    ad: m.ad,
    izinler: m.izinler.map((i) => ({ deger: i, etiket: IZIN_ETIKET[i] ?? i })),
  }));

  return (
    <div>
      <PageHeader
        title="Gruplar"
        subtitle={`${gruplar.length} grup · ${kullanicilar.length} kullanıcı`}
        action={<GrupPanel izinModulleri={izinSecenekleri} />}
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-semibold text-foreground">Grup nasıl çalışır?</h2>
        <p className="text-sm text-muted-foreground">
          Bir kullanıcının yetkileri, <strong>rolünün izinleri</strong> ile{" "}
          <strong>üye olduğu grupların izinlerinin</strong> birleşimidir. Grup
          yalnızca yetki <em>ekler</em>; hiçbir zaman kısıtlamaz. Rolü zaten
          yeterli olan bir kullanıcıyı gruba eklemek bir şey değiştirmez.
        </p>
      </div>

      {gruplar.length === 0 ? (
        <EmptyState
          title="Henüz grup yok"
          description="Aynı yetkileri birden çok kullanıcıya vermek için grup oluşturun."
        />
      ) : (
        <div className="space-y-4">
          {gruplar.map((grup) => (
            <div key={grup.id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{grup.ad}</h3>
                  {grup.aciklama && (
                    <p className="text-sm text-muted-foreground">{grup.aciklama}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {grup.uyeler.length} üye · Oluşturuldu {formatTarih(grup.createdAt)}
                  </p>
                </div>
                <GrupPanel
                  izinModulleri={izinSecenekleri}
                  mevcut={{
                    id: grup.id,
                    ad: grup.ad,
                    aciklama: grup.aciklama ?? "",
                    izinler: grup.izinler,
                  }}
                />
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/70">
                  İzinler ({grup.izinler.length})
                </p>
                {grup.izinler.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu grupta izin tanımlı değil.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {grup.izinler.map((i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
                      >
                        {IZIN_ETIKET[i] ?? i}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/70">
                  Üyeler
                </p>
                <div className="divide-y divide-border/50">
                  {kullanicilar.map((k) => (
                    <UyelikSatiri
                      key={k.id}
                      grupId={grup.id}
                      kullanici={{
                        id: k.id,
                        ad: k.name,
                        email: k.email,
                        rolEtiket: ROL_ETIKET[rolNormalize(k.role)] ?? k.role,
                      }}
                      uye={grup.uyeler.some((u) => u.userId === k.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
