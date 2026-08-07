"use client";

import { ozelAlanGirdiAdi, type OzelAlanTanimi } from "@/lib/ozel-alan-tanimlar";

/**
 * Özel alan girdileri (Faz 11 / E6) — FirmaForm ve FirsatPanel içinde
 * kullanılır. Kişi formları RecordForm tabanlı olduğu için orada aynı
 * alanlar `alanFieldTanimi` ile Field listesine çevrilir.
 *
 * `required` yalnızca kolaylıktır; asıl doğrulama sunucudadır
 * (`formdanDegerler`).
 */
export default function OzelAlanGirdileri({
  alanlar,
  degerler = {},
}: {
  alanlar: OzelAlanTanimi[];
  degerler?: Record<string, string>;
}) {
  if (alanlar.length === 0) return null;

  return (
    <>
      {alanlar.map((alan) => {
        const name = ozelAlanGirdiAdi(alan.id);
        const deger = degerler[alan.id] ?? "";
        const label = (
          <label className="label" htmlFor={name}>
            {alan.ad}
            {alan.zorunlu && " *"}
          </label>
        );

        switch (alan.tip) {
          case "sayi":
            return (
              <div key={alan.id}>
                {label}
                <input
                  id={name}
                  name={name}
                  inputMode="decimal"
                  className="input"
                  defaultValue={deger}
                  required={alan.zorunlu}
                />
              </div>
            );
          case "tarih":
            return (
              <div key={alan.id}>
                {label}
                <input
                  id={name}
                  name={name}
                  type="date"
                  className="input"
                  defaultValue={deger}
                  required={alan.zorunlu}
                />
              </div>
            );
          case "secim":
            return (
              <div key={alan.id}>
                {label}
                <select
                  id={name}
                  name={name}
                  className="input"
                  defaultValue={deger}
                  required={alan.zorunlu}
                >
                  <option value="">Seçiniz…</option>
                  {alan.secenekler.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            );
          case "onay":
            return (
              <div key={alan.id} className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name={name}
                    value="1"
                    defaultChecked={deger === "1"}
                    className="h-4 w-4 rounded border-border"
                  />
                  {alan.ad}
                </label>
              </div>
            );
          default:
            return (
              <div key={alan.id}>
                {label}
                <input
                  id={name}
                  name={name}
                  className="input"
                  maxLength={500}
                  defaultValue={deger}
                  required={alan.zorunlu}
                />
              </div>
            );
        }
      })}
    </>
  );
}
