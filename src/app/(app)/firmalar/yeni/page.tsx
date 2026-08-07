import { PageHeader } from "@/components/layout/page-header";
import FirmaForm from "@/components/FirmaForm";
import { createFirma } from "../actions";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { alanlariGetir } from "@/lib/ozel-alan";

export default async function YeniFirmaPage() {
  await yetkiGerektir(IZIN.firmaOlustur);
  const ozelAlanlar = await alanlariGetir("firma");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yeni Firma" subtitle="Yeni bir firma kaydı oluşturun" />
      <FirmaForm action={createFirma} submitLabel="Firmayı Kaydet" ozelAlanlar={ozelAlanlar} />
    </div>
  );
}
