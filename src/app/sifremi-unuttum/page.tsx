"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { sifirlamaIste, type UnuttumState } from "./actions";

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-11 w-full" disabled={pending}>
      {pending ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
    </button>
  );
}

export default function SifremiUnuttumPage() {
  const [state, formAction] = useFormState<UnuttumState, FormData>(sifirlamaIste, {});

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
      </div>

      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/40 p-8 shadow-soft backdrop-blur-xl sm:p-10">
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Şifremi unuttum</h1>
          <p className="text-sm text-muted-foreground">
            Hesabınıza kayıtlı e-posta adresini girin; şifre belirleme bağlantısını
            gönderelim.
          </p>
        </div>

        {state.ok ? (
          <div className="space-y-6">
            <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-300">{state.bilgi}</p>
            </div>
            <Link href="/login" className="btn-secondary h-11 w-full">
              <ArrowLeft className="h-4 w-4" /> Girişe dön
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-posta</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                className="input h-11"
                placeholder="ornek@firma.com"
              />
            </div>

            {state.error && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                {state.error}
              </p>
            )}

            <Gonder />

            <p className="text-center text-sm">
              <Link href="/login" className="text-muted-foreground hover:text-primary">
                Girişe dön
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
