import { notFound } from "next/navigation";
import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import FirmaForm from "@/components/FirmaForm";
import { updateFirma } from "../../actions";
import { alanlariGetir, degerHaritasi } from "@/lib/ozel-alan";

export const dynamic = "force-dynamic";

export default async function FirmaDuzenlePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await yetkiGerektir(IZIN.firmaDuzenle);
  const db = await getTenantDb();
  const firma = await db.firma.findFirst({ where: { id: params.id } });
  if (!firma) notFound();

  const ozelAlanlar = await alanlariGetir("firma");
  const ozelDegerler = Object.fromEntries(await degerHaritasi(db, "firma", firma.id));

  const action = updateFirma.bind(null, firma.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Firmayı Düzenle" subtitle={firma.ad} />
      <FirmaForm
        action={action}
        initial={firma}
        submitLabel="Değişiklikleri Kaydet"
        cancelHref={`/firmalar/${firma.id}`}
        ozelAlanlar={ozelAlanlar}
        ozelDegerler={ozelDegerler}
      />
    </div>
  );
}
