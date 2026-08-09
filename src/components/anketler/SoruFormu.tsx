"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { soruEkle, type FormState } from "@/app/(app)/anketler/actions";
import { SORU_TIPLERI, soruTipi } from "@/lib/anket-tanimlar";

/**
 * Soru ekleme formu (Faz 19 / N1).
 *
 * Seçenek alanı YALNIZCA çoktan seçmeli tipte görünür: ölçek sorusuna
 * seçenek girdirmek, kullanıcıya işe yaramayacak bir alan doldurtmaktır.
 */
export default function SoruFormu({ anketId }: { anketId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(
    soruEkle.bind(null, anketId),
    {}
  );
  const form = useRef<HTMLFormElement>(null);
  const [tip, setTip] = useState("metin");

  if (state.ok) form.current?.reset();
  const secenekli = soruTipi(tip)?.secenekli ?? false;

  return (
    <form ref={form} action={formAction} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
      <div>
        <label className="label" htmlFor="soru-metin">Soru *</label>
        <input
          id="soru-metin"
          name="metin"
          required
          className="input"
          placeholder="ör. Hizmetimizden ne kadar memnunsunuz?"
        />
      </div>

      <div>
        <label className="label" htmlFor="soru-tip">Tip</label>
        <select
          id="soru-tip"
          name="tip"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="input"
        >
          {SORU_TIPLERI.map((t) => (
            <option key={t.deger} value={t.deger}>{t.etiket}</option>
          ))}
        </select>
      </div>

      {secenekli && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="soru-secenekler">
            Seçenekler (her satıra bir tane, en az iki)
          </label>
          <textarea
            id="soru-secenekler"
            name="secenekler"
            rows={3}
            className="input"
            placeholder={"Çok iyi\nİyi\nOrta\nKötü"}
          />
        </div>
      )}

      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="zorunlu" value="1" />
          Yanıtlanması zorunlu
        </label>
        <Ekle />
      </div>

      <p className="sm:col-span-2 text-xs text-muted-foreground">
        {soruTipi(tip)?.aciklama}
      </p>

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400 sm:col-span-2">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Ekle() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Ekleniyor…" : "Soru Ekle"}
    </button>
  );
}
