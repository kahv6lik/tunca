"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/(app)/firmalar/actions";
import { FIRMA_DURUM, SEKTORLER, DIGER_SEKTOR } from "@/lib/constants";
import { ILLER, ilceler } from "@/lib/tr-iller";

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

  // Sektör: hazır listede varsa seç, yoksa "Diğer" + elle değer
  const sektorBilinen = !!v.sektor && (SEKTORLER as readonly string[]).includes(v.sektor);
  const [sektorSecim, setSektorSecim] = useState(
    v.sektor ? (sektorBilinen ? (v.sektor as string) : DIGER_SEKTOR) : ""
  );
  const [sektorDiger, setSektorDiger] = useState(
    v.sektor && !sektorBilinen ? (v.sektor as string) : ""
  );

  // İl / İlçe: bağımlı açılır menüler
  const ilBilinen = !!v.il && ILLER.includes(v.il);
  const [il, setIl] = useState(ilBilinen ? (v.il as string) : "");
  const [ilce, setIlce] = useState(v.ilce ?? "");

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
          <label className="label" htmlFor="sektor-secim">Sektör</label>
          <select
            id="sektor-secim"
            className="input"
            value={sektorSecim}
            onChange={(e) => setSektorSecim(e.target.value)}
          >
            <option value="">Seçiniz…</option>
            {SEKTORLER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={DIGER_SEKTOR}>{DIGER_SEKTOR}</option>
          </select>
          {sektorSecim === DIGER_SEKTOR ? (
            <input
              name="sektor"
              className="input mt-2"
              placeholder="Sektörü yazın"
              value={sektorDiger}
              onChange={(e) => setSektorDiger(e.target.value)}
            />
          ) : (
            <input type="hidden" name="sektor" value={sektorSecim} />
          )}
        </div>

        <div>
          <label className="label" htmlFor="il">İl</label>
          <select
            id="il"
            name="il"
            className="input"
            value={il}
            onChange={(e) => {
              setIl(e.target.value);
              setIlce(""); // il değişince ilçe sıfırlanır
            }}
          >
            <option value="">Seçiniz…</option>
            {ILLER.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ilce">İlçe</label>
          <select
            id="ilce"
            name="ilce"
            className="input"
            value={ilce}
            onChange={(e) => setIlce(e.target.value)}
            disabled={!il}
          >
            <option value="">{il ? "Seçiniz…" : "Önce il seçin"}</option>
            {ilceler(il).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
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
