"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-600 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tunca CRM</h1>
          <p className="mt-1 text-sm text-slate-500">
            Firma, yatırım, eğitim ve hizmet takip sistemi
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
              placeholder="ornek@firma.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo giriş: admin@tunca.com / admin123
        </p>
      </div>
    </div>
  );
}
