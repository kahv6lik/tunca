"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import {
  epostaAyariKaydet,
  epostaTest,
  type FormState,
} from "@/app/(app)/otomasyon/actions";

export type EpostaAyarDegerleri = {
  smtpHost: string;
  smtpPort: number;
  smtpGuvenli: boolean;
  smtpKullanici: string;
  smtpParolaVar: boolean;
  gonderenAd: string;
  gonderenAdres: string;
  imapHost: string;
  imapPort: number;
  imapKullanici: string;
  imapParolaVar: boolean;
  imapKlasor: string;
  aktif: boolean;
};

/**
 * E-posta ayar formu (Faz 8 / D1, D3).
 *
 * Parola alanları BOŞ gelir ve boş bırakılırsa mevcut değer korunur.
 * Kaydedilmiş bir parolanın forma geri yazılması, ekranı açan herkesin
 * kaynak koddan parolayı okuyabilmesi demek olurdu.
 */
export default function EpostaAyarFormu({ mevcut }: { mevcut: EpostaAyarDegerleri }) {
  const [state, formAction] = useFormState<FormState, FormData>(epostaAyariKaydet, {});
  const [testState, testAction] = useFormState<FormState, FormData>(epostaTest, {});

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">Giden E-posta (SMTP)</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="hidden" name="aktif" value="0" />
              <input
                type="checkbox"
                name="aktif"
                value="1"
                defaultChecked={mevcut.aktif}
                className="h-4 w-4 rounded border-border"
              />
              Gönderim açık
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="label" htmlFor="smtpHost">
                SMTP Sunucusu
              </label>
              <input
                id="smtpHost"
                name="smtpHost"
                defaultValue={mevcut.smtpHost}
                className="input"
                placeholder="smtp.sirketiniz.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="smtpPort">
                Port
              </label>
              <input
                id="smtpPort"
                name="smtpPort"
                type="number"
                defaultValue={mevcut.smtpPort}
                className="input"
              />
              <p className="mt-1 text-xs text-muted-foreground">587 (STARTTLS) veya 465 (SSL)</p>
            </div>

            <div>
              <label className="label" htmlFor="smtpKullanici">
                Kullanıcı
              </label>
              <input
                id="smtpKullanici"
                name="smtpKullanici"
                defaultValue={mevcut.smtpKullanici}
                className="input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="smtpParola">
                Parola
              </label>
              <input
                id="smtpParola"
                name="smtpParola"
                type="password"
                className="input"
                autoComplete="new-password"
                placeholder={mevcut.smtpParolaVar ? "Kayıtlı — değiştirmek için yazın" : ""}
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-foreground">
                <input type="hidden" name="smtpGuvenli" value="0" />
                <input
                  type="checkbox"
                  name="smtpGuvenli"
                  value="1"
                  defaultChecked={mevcut.smtpGuvenli}
                  className="h-4 w-4 rounded border-border"
                />
                SSL (465)
              </label>
            </div>

            <div>
              <label className="label" htmlFor="gonderenAd">
                Gönderen Adı
              </label>
              <input
                id="gonderenAd"
                name="gonderenAd"
                defaultValue={mevcut.gonderenAd}
                className="input"
                placeholder="Şirketiniz CRM"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="label" htmlFor="gonderenAdres">
                Gönderen Adresi
              </label>
              <input
                id="gonderenAdres"
                name="gonderenAdres"
                type="email"
                defaultValue={mevcut.gonderenAdres}
                className="input"
                placeholder="crm@sirketiniz.com"
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 font-semibold text-foreground">Gelen E-posta (IMAP)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Tanımlanırsa gelen kutusu düzenli olarak taranır; gönderen adresi bir kişi
            kaydıyla eşleşen iletiler o firmanın zaman akışına aktivite olarak düşer.
            İletinin kendisi saklanmaz — yalnızca kim, ne zaman, hangi konu.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="label" htmlFor="imapHost">
                IMAP Sunucusu
              </label>
              <input
                id="imapHost"
                name="imapHost"
                defaultValue={mevcut.imapHost}
                className="input"
                placeholder="imap.sirketiniz.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="imapPort">
                Port
              </label>
              <input
                id="imapPort"
                name="imapPort"
                type="number"
                defaultValue={mevcut.imapPort}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="imapKullanici">
                Kullanıcı
              </label>
              <input
                id="imapKullanici"
                name="imapKullanici"
                defaultValue={mevcut.imapKullanici}
                className="input"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label" htmlFor="imapParola">
                Parola
              </label>
              <input
                id="imapParola"
                name="imapParola"
                type="password"
                className="input"
                autoComplete="new-password"
                placeholder={mevcut.imapParolaVar ? "Kayıtlı — değiştirmek için yazın" : ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="imapKlasor">
                Klasör
              </label>
              <input
                id="imapKlasor"
                name="imapKlasor"
                defaultValue={mevcut.imapKlasor}
                className="input"
              />
            </div>
          </div>
        </div>

        {state.error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {state.bilgi}
          </p>
        )}

        <div className="flex justify-end">
          <Kaydet />
        </div>
      </form>

      <form action={testAction} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="alici">
            Deneme iletisi gönder
          </label>
          <input
            id="alici"
            name="alici"
            type="email"
            className="input"
            placeholder="Boş bırakırsanız kendi adresinize gönderilir"
          />
        </div>
        <TestGonder />
        {testState.error && (
          <p className="w-full text-sm text-rose-400">{testState.error}</p>
        )}
        {testState.ok && (
          <p className="w-full text-sm text-emerald-400">{testState.bilgi}</p>
        )}
      </form>
    </div>
  );
}

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Ayarları Kaydet"}
    </button>
  );
}

function TestGonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? "Gönderiliyor…" : "Test Et"}
    </button>
  );
}
