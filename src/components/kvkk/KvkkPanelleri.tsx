"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Download } from "lucide-react";
import { rizaVer, type RizaState } from "@/app/(app)/kvkk/actions";

function Onayla() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Okudum, onaylıyorum"}
    </button>
  );
}

export function RizaFormu({
  oncekiSurum,
  oncekiTarih,
}: {
  oncekiSurum: string | null;
  oncekiTarih: string | null;
}) {
  const [state, formAction] = useFormState<RizaState, FormData>(rizaVer, {});

  return (
    <form action={formAction} className="space-y-4">
      {oncekiSurum && oncekiTarih && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Aydınlatma metni güncellendi ({oncekiTarih} tarihinde {oncekiSurum} sürümünü
          onaylamıştınız). Lütfen güncel metni okuyup yeniden onaylayın.
        </p>
      )}

      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          name="onay"
          value="1"
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>
          Aşağıdaki aydınlatma metnini okudum; kişisel verilerimin metinde belirtilen
          amaçlarla işlenmesini kabul ediyorum.
        </span>
      </label>

      {state.error && <p className="text-sm text-rose-400">{state.error}</p>}

      <Onayla />
    </form>
  );
}

export function VerimiIndirDugmesi() {
  return (
    <a href="/api/kvkk/verilerim" className="btn-secondary" download>
      <Download className="h-4 w-4" /> Verilerimi İndir (JSON)
    </a>
  );
}
