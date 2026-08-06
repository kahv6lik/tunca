"use client";

import { useFormState, useFormStatus } from "react-dom";
import { tercihleriKaydet, type TercihState } from "@/app/(app)/bildirimler/actions";

type Satir = { tur: string; etiket: string; uygulama: boolean; eposta: boolean };

/**
 * Bildirim tercih formu (Faz 8 / D1).
 *
 * Onay kutusu işaretsizken tarayıcı hiçbir değer göndermez; bu yüzden her
 * satır için gizli bir "0" alanı vardır ve işaretliyken "1" onu geçersiz
 * kılar. Aksi halde bir kutuyu kapatmak "değer gelmedi, dokunma" olarak
 * yorumlanır ve kapatma hiç kaydedilmezdi.
 */
export default function TercihFormu({
  satirlar,
  epostaAcik,
}: {
  satirlar: Satir[];
  epostaAcik: boolean;
}) {
  const [state, formAction] = useFormState<TercihState, FormData>(tercihleriKaydet, {});

  return (
    <form action={formAction}>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-border/60">
          <thead className="bg-muted/30">
            <tr>
              <th className="th">Olay</th>
              <th className="th text-center">Uygulama içi</th>
              <th className="th text-center">E-posta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {satirlar.map((s) => (
              <tr key={s.tur}>
                <td className="td">
                  <input type="hidden" name="tur" value={s.tur} />
                  {s.etiket}
                </td>
                <td className="td text-center">
                  <input type="hidden" name={`uygulama-${s.tur}`} value="0" />
                  <input
                    type="checkbox"
                    name={`uygulama-${s.tur}`}
                    value="1"
                    defaultChecked={s.uygulama}
                    aria-label={`${s.etiket} — uygulama içi`}
                    className="h-4 w-4 rounded border-border"
                  />
                </td>
                <td className="td text-center">
                  <input type="hidden" name={`eposta-${s.tur}`} value="0" />
                  <input
                    type="checkbox"
                    name={`eposta-${s.tur}`}
                    value="1"
                    defaultChecked={s.eposta}
                    disabled={!epostaAcik}
                    aria-label={`${s.etiket} — e-posta`}
                    className="h-4 w-4 rounded border-border disabled:opacity-40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.ok && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Tercihler kaydedildi.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <Kaydet />
      </div>
    </form>
  );
}

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Tercihleri Kaydet"}
    </button>
  );
}
