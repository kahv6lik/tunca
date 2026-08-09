"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Square } from "lucide-react";
import { ziyaretBitir, type FormState } from "@/app/(app)/ziyaretler/actions";

/**
 * Açık ziyareti bitirir (Faz 17 / A4).
 *
 * Süre alanı YOKTUR — damgalardan hesaplanır. Kullanıcıdan yalnızca ziyaret
 * notu istenir; o da isteğe bağlıdır.
 */
export default function ZiyaretBitir({ id }: { id: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(
    ziyaretBitir.bind(null, id),
    {}
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label className="label" htmlFor={`znot-${id}`}>Ziyaret notu</label>
        <input
          id={`znot-${id}`}
          name="not"
          className="input"
          placeholder="Görüşülen konu, sonuç…"
        />
      </div>
      <Bitir />
      {state.error && <p className="w-full text-xs text-rose-400">{state.error}</p>}
    </form>
  );
}

function Bitir() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Square className="h-4 w-4" /> {pending ? "Bitiriliyor…" : "Ziyareti Bitir"}
    </button>
  );
}
