import { PageHeader } from "@/components/layout/page-header";
import FirmaForm from "@/components/FirmaForm";
import { createFirma } from "../actions";
import { IZIN, yetkiGerektir } from "@/lib/yetki";

export default async function YeniFirmaPage() {
  await yetkiGerektir(IZIN.firmaOlustur);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yeni Firma" subtitle="Yeni bir firma kaydı oluşturun" />
      <FirmaForm action={createFirma} submitLabel="Firmayı Kaydet" />
    </div>
  );
}
