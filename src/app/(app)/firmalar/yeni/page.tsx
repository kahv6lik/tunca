import { PageHeader } from "@/components/layout/page-header";
import FirmaForm from "@/components/FirmaForm";
import { createFirma } from "../actions";

export default function YeniFirmaPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yeni Firma" subtitle="Yeni bir firma kaydı oluşturun" />
      <FirmaForm action={createFirma} submitLabel="Firmayı Kaydet" />
    </div>
  );
}
