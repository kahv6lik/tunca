"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { sifreyiBelirle, type SifirlaState } from "./actions";
import { SIFRE_POLITIKA_METNI } from "@/lib/guvenlik-tanimlar";

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-11 w-full" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Şifreyi Kaydet"}
    </button>
  );
}

export function SifirlaFormu({ token }: { token: string }) {
  const [state, formAction] = useFormState<SifirlaState, FormData>(
    sifreyiBelirle.bind(null, token),
    {}
  );

  if (state.ok) {
    return (
      <div className="space-y-6">
        <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-300">
            Şifreniz güncellendi. Güvenlik gereği açık olan tüm oturumlarınız
            kapatıldı; yeni şifrenizle giriş yapabilirsiniz.
          </p>
        </div>
        <Link href="/login" className="btn-primary h-11 w-full">
          Giriş yap
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="sifre">Yeni şifre</label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          className="input h-11"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">{SIFRE_POLITIKA_METNI}</p>
      </div>
      <div>
        <label className="label" htmlFor="tekrar">Yeni şifre (tekrar)</label>
        <input
          id="tekrar"
          name="tekrar"
          type="password"
          autoComplete="new-password"
          required
          className="input h-11"
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
