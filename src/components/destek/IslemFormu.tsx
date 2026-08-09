"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { destekIslemEkle, type FormState } from "@/app/(app)/destek/actions";
import { AKTIVITE_TUR } from "@/lib/constants";

/**
 * "Yapılan işlem" girişi (Faz 16 / P2).
 *
 * Kaydedilen şey bir AKTİVİTE'dir: aynı satır firma zaman akışında da
 * görünür. Ayrı bir "destek işlemi" tablosu, timeline'ı ikinci bir sorguyla
 * büyütürdü (karar: v1.16.0).
 */
export default function IslemFormu({ destekId }: { destekId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(
    destekIslemEkle.bind(null, destekId),
    {}
  );
  const form = useRef<HTMLFormElement>(null);

  // Kaydedilen işlem formda kalmamalı: ikinci işlemi yazan kişi öncekini
  // silmek zorunda kalmasın.
  if (state.ok) form.current?.reset();

  return (
    <form ref={form} action={formAction} className="grid gap-3 sm:grid-cols-[8rem_1fr]">
      <div>
        <label className="label" htmlFor="islem-tur">Tür</label>
        <select id="islem-tur" name="tur" defaultValue="not" className="input">
          {AKTIVITE_TUR.map((t) => (
            <option key={t.deger} value={t.deger}>{t.etiket}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="islem-baslik">Yapılan işlem *</label>
        <input
          id="islem-baslik"
          name="baslik"
          required
          placeholder="ör. Müşteri arandı, uzaktan bağlanıldı"
          className="input"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label" htmlFor="islem-aciklama">Ayrıntı</label>
        <textarea id="islem-aciklama" name="aciklama" rows={2} className="input" />
      </div>

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end sm:col-span-2">
        <Kaydet />
      </div>
    </form>
  );
}

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Ekleniyor…" : "İşlem Ekle"}
    </button>
  );
}
