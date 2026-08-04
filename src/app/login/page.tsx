"use client";

import { useFormState, useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Building2, Wallet, GraduationCap, ShieldCheck, ArrowRight } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-11 w-full" disabled={pending}>
      {pending ? "Giriş yapılıyor…" : (
        <>
          Giriş Yap <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

const FEATURES = [
  { icon: Building2, title: "800+ firma", desc: "Tek panelde firma yönetimi" },
  { icon: Wallet, title: "Yatırım destekleri", desc: "Hibe, teşvik ve kredi takibi" },
  { icon: GraduationCap, title: "Eğitim & hizmet", desc: "Verilen tüm hizmetlerin kaydı" },
];

export default function LoginPage() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {});

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* aurora arka plan */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute right-1/4 bottom-0 h-96 w-96 translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[120px]" />
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-soft backdrop-blur-xl lg:grid-cols-2">
        {/* Sol tanıtım paneli */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative hidden flex-col justify-between gap-10 border-r border-border/50 bg-gradient-to-br from-primary/10 to-transparent p-10 lg:flex"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-2xl shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.8)]">
              🪐
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Gezegen CRM</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Enterprise Suite
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight text-foreground">
              Firmalarınızı, desteklerinizi ve hizmetlerinizi{" "}
              <span className="text-gradient">tek panelden</span> yönetin.
            </h2>
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Güvenli oturum · Şifreli erişim
          </p>
        </motion.div>

        {/* Sağ giriş formu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col justify-center p-8 sm:p-12"
        >
          <div className="mb-8 lg:hidden">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 text-2xl">
              🪐
            </div>
          </div>

          <div className="mb-8 space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Tekrar hoş geldiniz</h1>
            <p className="text-sm text-muted-foreground">
              Devam etmek için hesabınıza giriş yapın
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">E-posta</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="input h-11"
                placeholder="ornek@firma.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Şifre</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input h-11"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
              >
                {state.error}
              </motion.p>
            )}

            <SubmitButton />
          </form>

          <p className="mt-6 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
            Demo giriş: <span className="font-medium text-foreground">admin@gezegen.com</span> / admin123
          </p>
        </motion.div>
      </div>
    </div>
  );
}
