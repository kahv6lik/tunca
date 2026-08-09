import { getTenantDb } from "@/lib/tenant-db";
import { IZIN, yetkiGerektir, yetkiVarMi } from "@/lib/yetki";
import { PageHeader } from "@/components/layout/page-header";
import { formatTarih } from "@/lib/format";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { aiDurumu, aiModeli } from "@/lib/ai";
import {
  AI_TURLERI,
  OZET_ALANLARI,
  OZET_GONDERILMEYENLER,
  aiKullanilabilir,
  tokenMetni,
} from "@/lib/ai-tanimlar";
import AiAyarPanel from "@/components/ai/AiAyarPanel";

export const dynamic = "force-dynamic";

/**
 * AI ayarları ve kullanım defteri — Faz 21.
 *
 * Yol haritasının sözü burada somutlaşır: "hangi verinin modele gönderildiği
 * kiracı yöneticisine AÇIKÇA bildirilir ve KAPATILABİLİR olur."
 *
 * Sayfa üç şeyi yan yana koyar:
 *   1. Açma/kapama düğmesi (varsayılan KAPALI, kapatma her an mümkün),
 *   2. Gönderilenlerin ve gönderilmeyenlerin ADLARIYLA listesi,
 *   3. Yapılmış çağrıların defteri — söz, geriye dönük denetlenebilir olur.
 */
export default async function AiPage() {
  await yetkiGerektir(IZIN.aiKullan);
  const yonetebilir = await yetkiVarMi(IZIN.aiYonet);

  const db = await getTenantDb();
  const [ayar, durum] = await Promise.all([kiraciAyari(), aiDurumu()]);

  // Defter yalnızca yöneticiye gösterilir: kimin ne sorduğu, kuruluş içi bir
  // denetim bilgisidir.
  const kullanimlar = yonetebilir
    ? await db.aiKullanim.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const turEtiket = new Map<string, string>(AI_TURLERI.map((t) => [t.deger, t.etiket]));

  return (
    <div>
      <PageHeader
        title="AI Özellikleri"
        subtitle="Skorlama, firma özeti ve doğal dilde sorgu"
      />

      <div className="card mb-6 p-5">
        <AiAyarPanel
          acik={ayar.aiAcik}
          yonetebilir={yonetebilir}
          anahtarVar={durum.anahtarVar}
          model={aiModeli()}
          calisiyor={aiKullanilabilir(durum)}
        />
      </div>

      {/* Ne gidiyor, ne gitmiyor — sözün iki yarısı da yazılı. */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-foreground">
            Firma özetinde modele gönderilenler
          </h2>
          <ul className="space-y-1.5 text-sm text-foreground/90">
            {OZET_ALANLARI.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="text-primary">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-foreground">
            Hiçbir zaman gönderilmeyenler
          </h2>
          <ul className="space-y-1.5 text-sm text-foreground/90">
            {OZET_GONDERILMEYENLER.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="text-rose-400">×</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <h2 className="mb-2 font-semibold text-foreground">Diğer özellikler</h2>
        <ul className="space-y-2 text-sm text-foreground/90">
          <li>
            <strong>Skorlama</strong> kuruluşunuzun kendi kapanmış işlerinden
            hesaplanır; hiçbir veri dışarı gönderilmez ve AI kapalıyken de
            çalışır.
          </li>
          <li>
            <strong>Doğal dilde sorgu</strong> modele yalnızca yazdığınız
            cümleyi gönderir — müşteri verisi gönderilmez. Model bir süzgeç
            önerir, sorguyu her zaman uygulama çalıştırır. Tanıdık kalıplar
            model olmadan da çözülür.
          </li>
        </ul>
      </div>

      {yonetebilir && (
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-foreground">
            Kullanım defteri{" "}
            <span className="text-muted-foreground/70">({kullanimlar.length})</span>
          </h2>
          {kullanimlar.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground/70">
              Henüz model çağrısı yapılmadı.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/60">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="th">Tarih</th>
                    <th className="th">Kullanıcı</th>
                    <th className="th">Tür</th>
                    <th className="th">Konu</th>
                    <th className="th">Kullanım</th>
                    <th className="th">Sonuç</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {kullanimlar.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/40">
                      <td className="td">{formatTarih(k.createdAt)}</td>
                      <td className="td">{k.kullaniciEmail ?? "—"}</td>
                      <td className="td">{turEtiket.get(k.tur) ?? k.tur}</td>
                      <td className="td">{k.konu}</td>
                      <td className="td">
                        {tokenMetni(k.girisToken, k.cikisToken)}
                      </td>
                      <td className="td">
                        {k.basarili ? (
                          <span className="text-emerald-400">Başarılı</span>
                        ) : (
                          <span className="text-rose-400" title={k.hata ?? ""}>
                            Hata
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
