import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import EpostaAyarFormu from "@/components/otomasyon/EpostaAyarFormu";
import { formatTarih } from "@/lib/format";

export const dynamic = "force-dynamic";

/** E-posta ayarları (Faz 8 / D1, D3) — kiracının kendi posta sunucusu. */
export default async function EpostaAyarPage() {
  await yetkiGerektir(IZIN.epostaAyarYonet);
  const db = await getTenantDb();

  const [ayar, kuyruk] = await Promise.all([
    db.epostaAyari.findFirst({}),
    db.epostaKuyrugu.groupBy({ by: ["durum"], _count: { _all: true } }),
  ]);

  const sayiOf = (d: string) => kuyruk.find((k) => k.durum === d)?._count._all ?? 0;

  return (
    <div>
      {/*
        "← Otomasyon" geri bağlantısı KALDIRILDI (v1.26.0): e-posta artık
        Otomasyon'un alt ekranı değil, Ayarlar bölümünün kardeş sekmesi.
        Sayfanın üstündeki sekme çubuğu gezinmeyi zaten sağlıyor; geri
        bağlantısı artık olmayan bir hiyerarşiyi ima ederdi.
      */}
      <PageHeader
        title="E-posta Ayarları"
        subtitle="Bildirimler kuruluşunuzun kendi posta sunucusundan gönderilir"
      />

      <div className="card mb-6 p-5 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Parolalar şifreli saklanır.</strong>{" "}
          Veritabanını okuyabilen biri posta kutunuza erişemez. Parola alanları boş
          bırakılırsa kayıtlı değer korunur.
        </p>
        <p className="mt-2">
          Bildirimler <strong className="text-foreground">kuyruğa</strong> yazılır ve
          zamanlanmış çalıştırıcı gönderir; posta sunucusu yavaşsa kullanıcının işlemi
          beklemez. Kuyruk durumu:{" "}
          <span className="text-foreground">{sayiOf("bekliyor")} bekliyor</span> ·{" "}
          {sayiOf("gonderildi")} gönderildi · {sayiOf("hata")} hata
          {ayar?.sonSenkron && ` · son IMAP taraması ${formatTarih(ayar.sonSenkron)}`}
        </p>
        {ayar?.sonHata && (
          <p className="mt-2 text-rose-400">Son hata: {ayar.sonHata}</p>
        )}
      </div>

      <EpostaAyarFormu
        mevcut={{
          smtpHost: ayar?.smtpHost ?? "",
          smtpPort: ayar?.smtpPort ?? 587,
          smtpGuvenli: ayar?.smtpGuvenli ?? false,
          smtpKullanici: ayar?.smtpKullanici ?? "",
          smtpParolaVar: Boolean(ayar?.smtpParola),
          gonderenAd: ayar?.gonderenAd ?? "",
          gonderenAdres: ayar?.gonderenAdres ?? "",
          imapHost: ayar?.imapHost ?? "",
          imapPort: ayar?.imapPort ?? 993,
          imapKullanici: ayar?.imapKullanici ?? "",
          imapParolaVar: Boolean(ayar?.imapParola),
          imapKlasor: ayar?.imapKlasor ?? "INBOX",
          aktif: ayar?.aktif ?? false,
        }}
      />
    </div>
  );
}
