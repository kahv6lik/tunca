import { getTenantContext } from "@/lib/tenant-db";
import { PageHeader } from "@/components/layout/page-header";
import { formatTarih } from "@/lib/format";
import { KVKK_BASLIK, KVKK_METNI, KVKK_SURUM } from "@/lib/kvkk-tanimlar";
import { RizaFormu, VerimiIndirDugmesi } from "@/components/kvkk/KvkkPanelleri";

export const dynamic = "force-dynamic";

/**
 * KVKK aydınlatma metni ve açık rıza kaydı — Faz 12 / F7.
 *
 * Metnin SÜRÜMÜ rızayla birlikte saklanır: metin değişince sürüm artar ve
 * kullanıcıdan yeniden onay istenir. "Bir kere onaylamıştı" savunması,
 * değişmiş bir metin için geçerli değildir.
 */
export default async function KvkkPage() {
  const { db, session } = await getTenantContext();

  const kullanici = await db.user.findFirst({
    where: { id: session.userId },
    select: { kvkkOnayTarihi: true, kvkkSurum: true },
  });

  const guncelOnay =
    !!kullanici?.kvkkOnayTarihi && kullanici.kvkkSurum === KVKK_SURUM;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={KVKK_BASLIK} subtitle={`Metin sürümü: ${KVKK_SURUM}`} />

      {guncelOnay ? (
        <div className="card mb-6 border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-sm text-emerald-400">
            Bu metnin güncel sürümünü {formatTarih(kullanici!.kvkkOnayTarihi!)} tarihinde
            onayladınız.
          </p>
        </div>
      ) : (
        <div className="card mb-6 p-5">
          <RizaFormu
            oncekiSurum={kullanici?.kvkkSurum ?? null}
            oncekiTarih={
              kullanici?.kvkkOnayTarihi ? formatTarih(kullanici.kvkkOnayTarihi) : null
            }
          />
        </div>
      )}

      <div className="card space-y-6 p-6">
        {KVKK_METNI.map((bolum) => (
          <section key={bolum.baslik}>
            <h2 className="mb-2 font-semibold text-foreground">{bolum.baslik}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {bolum.govde.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-1 font-semibold text-foreground">Verilerimin kopyası</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Hesabınıza ait kişisel verilerin (hesap bilgileri, açık oturumlar, giriş
          kayıtları ve sizin yaptığınız işlemlerin denetim kaydı) makine okunur bir
          kopyasını indirebilirsiniz — KVKK m. 11 kapsamındaki bilgi talebi hakkı.
        </p>
        <VerimiIndirDugmesi />
      </div>
    </div>
  );
}
