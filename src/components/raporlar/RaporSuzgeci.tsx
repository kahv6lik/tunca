import Link from "next/link";
import { hazirAraliklar } from "@/lib/tarih-araligi";
import { raporSorgusu, type RaporTanimi } from "@/lib/rapor-tanimlar";

/**
 * Ortak rapor süzgeci — Faz 18 / R1.
 *
 * BÜTÜN RAPORLAR AYNI ÇUBUĞU KULLANIR. Her rapor kendi süzgecini yazsaydı
 * tarih mantığı (gün sonu, ters aralık) her ekranda yeniden yazılır ve biri
 * er ya da geç yanlış olurdu — Faz 13'te tam olarak bu yaşandı.
 *
 * Raporun `suzgecler` alanı hangi alanların ANLAMLI olduğunu söyler: saha
 * raporunda "firma" süzgeci yoktur, çünkü ziyaret zaten firmaya bağlıdır ve
 * kırılım oradan okunur. Anlamsız bir süzgeç göstermek, kullanıcıya
 * çalışmayan bir düğme vermek demektir.
 *
 * Sunucu bileşenidir: form `method="get"` ile çalışır, JavaScript
 * gerektirmez ve seçilen dönem URL'de yaşar (paylaşılabilir, yer imine
 * eklenebilir, kayıtlı görünüm olarak saklanabilir).
 */
export default function RaporSuzgeci({
  rapor,
  filtre,
  firmalar,
  kullanicilar,
}: {
  rapor: RaporTanimi;
  filtre: { bas?: string; bit?: string; firma?: string; sorumlu?: string };
  firmalar: { id: string; ad: string }[];
  kullanicilar: { id: string; name: string }[];
}) {
  const tarih = rapor.suzgecler.includes("tarih");
  const firma = rapor.suzgecler.includes("firma");
  const sorumlu = rapor.suzgecler.includes("sorumlu");
  const doluMu = Boolean(filtre.bas || filtre.bit || filtre.firma || filtre.sorumlu);

  return (
    <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      {tarih && (
        <>
          <div>
            <label className="label" htmlFor="bas">Başlangıç</label>
            <input
              id="bas"
              name="bas"
              type="date"
              defaultValue={filtre.bas ?? ""}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="bit">Bitiş</label>
            <input
              id="bit"
              name="bit"
              type="date"
              defaultValue={filtre.bit ?? ""}
              className="input"
            />
          </div>
        </>
      )}

      {firma && (
        <div className="w-52">
          <label className="label" htmlFor="firma">Firma</label>
          <select id="firma" name="firma" defaultValue={filtre.firma ?? ""} className="input">
            <option value="">Tüm firmalar</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
      )}

      {sorumlu && (
        <div className="w-48">
          <label className="label" htmlFor="sorumlu">Sorumlu</label>
          <select
            id="sorumlu"
            name="sorumlu"
            defaultValue={filtre.sorumlu ?? ""}
            className="input"
          >
            <option value="">Herkes</option>
            {kullanicilar.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" className="btn-primary">Uygula</button>

      {tarih && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {hazirAraliklar().map((h) => {
            const secili = filtre.bas === h.bas && filtre.bit === h.bit;
            // Hazır aralık, diğer süzgeçleri KORUR: dönemi değiştirmek
            // seçilen firmayı sıfırlamamalı.
            const adres = `/raporlar/${rapor.anahtar}${raporSorgusu(
              { ...filtre, bas: h.bas, bit: h.bit }
            )}`;
            return (
              <Link
                key={h.anahtar}
                href={adres}
                className={`rounded-lg border px-2 py-1 transition-colors ${
                  secili
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.etiket}
              </Link>
            );
          })}
        </div>
      )}

      {doluMu && (
        <Link href={`/raporlar/${rapor.anahtar}`} className="btn-secondary">
          Temizle
        </Link>
      )}
    </form>
  );
}
