import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant-db";
import { PageHeader } from "@/components/layout/page-header";
import { BILDIRIM_TURLERI } from "@/lib/bildirim";
import TercihFormu from "@/components/bildirimler/TercihFormu";

export const dynamic = "force-dynamic";

/** Bildirim tercihleri (Faz 8 / D1) — kullanıcı bazlı, kanal bazlı. */
export default async function TercihlerPage() {
  const { db, session } = await getTenantContext();

  const [tercihler, ayar] = await Promise.all([
    db.bildirimTercihi.findMany({ where: { kullaniciId: session.userId } }),
    db.epostaAyari.findFirst({}),
  ]);

  const harita = new Map(tercihler.map((t) => [t.tur, t]));

  const satirlar = BILDIRIM_TURLERI.map((t) => ({
    tur: t.deger,
    etiket: t.etiket,
    // Kayıt yoksa varsayılan geçerlidir: iki kanal da açık.
    uygulama: harita.get(t.deger)?.uygulama ?? true,
    eposta: harita.get(t.deger)?.eposta ?? true,
  }));

  const epostaAcik = Boolean(ayar?.aktif && ayar.smtpHost);

  return (
    <div>
      <Link
        href="/bildirimler"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Bildirimler
      </Link>

      <PageHeader
        title="Bildirim Tercihleri"
        subtitle="Hangi olayda nereden haberdar olacağınızı seçin"
      />

      {!epostaAcik && (
        <div className="card mb-6 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
          Kuruluşunuzda e-posta gönderimi henüz yapılandırılmamış. E-posta seçenekleri
          kaydedilir ama ayar tanımlanana kadar yalnızca uygulama içi bildirim
          gönderilir. Ayarı kuruluş yöneticiniz <strong>Otomasyon → E-posta Ayarları</strong>
          ekranından tanımlar.
        </div>
      )}

      <TercihFormu satirlar={satirlar} epostaAcik={epostaAcik} />
    </div>
  );
}
