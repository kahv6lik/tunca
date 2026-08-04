"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/(app)/firmalar/actions";
import { FIRMA_DURUM } from "@/lib/constants";

type FirmaValues = {
  ad?: string;
  vergiNo?: string | null;
  sektor?: string | null;
  il?: string | null;
  ilce?: string | null;
  yetkiliAd?: string | null;
  telefon?: string | null;
  email?: string | null;
  adres?: string | null;
  durum?: string | null;
  notlar?: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : label}
    </button>
  );
}

export default function FirmaForm({
  action,
  initial,
  submitLabel = "Kaydet",
  cancelHref = "/firmalar",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: FirmaValues;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const v = initial ?? {};

  return (
    <form action={formAction} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="ad">
            Firma Unvanı *
          </label>
          <input id="ad" name="ad" required className="input" defaultValue={v.ad ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="vergiNo">Vergi No</label>
          <input id="vergiNo" name="vergiNo" className="input" defaultValue={v.vergiNo ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="sektor">Sektör</label>
          <input id="sektor" name="sektor" className="input" defaultValue={v.sektor ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="il">İl</label>
          <input id="il" name="il" className="input" defaultValue={v.il ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="ilce">İlçe</label>
          <input id="ilce" name="ilce" className="input" defaultValue={v.ilce ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="yetkiliAd">Yetkili Kişi</label>
          <input id="yetkiliAd" name="yetkiliAd" className="input" defaultValue={v.yetkiliAd ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="telefon">Telefon</label>
          <input id="telefon" name="telefon" className="input" defaultValue={v.telefon ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="email">E-posta</label>
          <input id="email" name="email" type="email" className="input" defaultValue={v.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" className="input" defaultValue={v.durum ?? "aktif"}>
            {FIRMA_DURUM.map((d) => (
              <option key={d} value={d}>
                {d === "aktif" ? "Aktif" : "Pasif"}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="adres">Adres</label>
          <input id="adres" name="adres" className="input" defaultValue={v.adres ?? ""} />
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="notlar">Notlar</label>
          <textarea id="notlar" name="notlar" rows={3} className="input" defaultValue={v.notlar ?? ""} />
        </div>
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Submit label={submitLabel} />
        <Link href={cancelHref} className="btn-secondary">
          İptal
        </Link>
      </div>
    </form>
  );
}
