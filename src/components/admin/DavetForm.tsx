"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { davetKabul, type DavetState } from "@/app/davet/actions";

export default function DavetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<DavetState, FormData>(
    davetKabul.bind(null, token),
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="sifre">
          Şifre
        </label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          placeholder="En az 8 karakter"
        />
      </div>
      <div>
        <label className="label" htmlFor="sifreTekrar">
          Şifre (tekrar)
        </label>
        <input
          id="sifreTekrar"
          name="sifreTekrar"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}

      <Gonder />
    </form>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-11 w-full" disabled={pending}>
      {pending ? "Hesap oluşturuluyor…" : (
        <>
          Hesabı Oluştur <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
