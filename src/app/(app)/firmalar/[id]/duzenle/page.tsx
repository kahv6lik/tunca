import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import FirmaForm from "@/components/FirmaForm";
import { updateFirma } from "../../actions";

export const dynamic = "force-dynamic";

export default async function FirmaDuzenlePage({
  params,
}: {
  params: { id: string };
}) {
  const firma = await prisma.firma.findUnique({ where: { id: params.id } });
  if (!firma) notFound();

  const action = updateFirma.bind(null, firma.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Firmayı Düzenle" subtitle={firma.ad} />
      <FirmaForm
        action={action}
        initial={firma}
        submitLabel="Değişiklikleri Kaydet"
        cancelHref={`/firmalar/${firma.id}`}
      />
    </div>
  );
}
