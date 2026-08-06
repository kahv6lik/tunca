import { redirect } from "next/navigation";
import { etkinIzinler } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import IceAktarSihirbazi from "@/components/IceAktarSihirbazi";
import { ICE_AKTARILABILIR } from "@/lib/disa-aktar-tanimlar";

export const dynamic = "force-dynamic";

/**
 * İçe aktarım (Faz 9 / E2).
 *
 * Sayfanın kendi izni yoktur; kullanıcının OLUŞTURMA izni olan veri kümeleri
 * listelenir. Hiçbiri yoksa sayfa açılmaz — boş bir sihirbaz göstermek
 * yerine yetkisiz sayfasına düşmek dürüst davranıştır.
 */
const OLUSTURMA_IZNI: Record<string, string> = {
  firmalar: "firma.olustur",
  kisiler: "kisi.olustur",
  adaylar: "lead.olustur",
  yatirimlar: "yatirim.olustur",
  egitimler: "egitim.olustur",
  hizmetler: "hizmet.olustur",
};

export default async function IceAktarPage() {
  const izinler = await etkinIzinler();

  const izinliKumeler = ICE_AKTARILABILIR.map((k) => k.deger).filter((deger) =>
    izinler.has(OLUSTURMA_IZNI[deger] ?? "")
  );

  if (izinliKumeler.length === 0) {
    redirect("/yetkisiz?izin=firma.olustur");
  }

  return (
    <div>
      <PageHeader
        title="İçe Aktar"
        subtitle="Excel veya CSV dosyasından toplu kayıt ekleyin"
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-semibold text-foreground">Nasıl çalışır?</h2>
        <p className="text-sm text-muted-foreground">
          Dosyanızın <strong>ilk satırı başlık</strong> olmalıdır. Sütun adlarının
          birebir aynı olması gerekmez; ikinci adımda hangi sütunun neye karşılık
          geldiğini seçersiniz. Üçüncü adımda <strong>ne olacağını görürsünüz</strong> —
          hiçbir şey siz onaylamadan kaydedilmez. Hatalı satırlar atlanır, geri
          kalanlar aktarılır.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Alt kayıtlarda (kişi, yatırım, eğitim, hizmet) firma adı mevcut bir firmayla
          eşleşirse ona bağlanır; eşleşmezse yeni firma açılır. Aynı adlı firma iki kez
          oluşturulmaz.
        </p>
      </div>

      <IceAktarSihirbazi izinliKumeler={izinliKumeler} />
    </div>
  );
}
