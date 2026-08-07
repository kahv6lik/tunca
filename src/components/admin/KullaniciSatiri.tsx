"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import {
  kullaniciRolDegistir,
  kullaniciDurumDegistir,
  kullaniciSifreSifirla,
  type FormState,
} from "@/app/admin/actions";
import { ROL, ROL_ETIKET } from "@/lib/yetki-tanimlar";

/**
 * Bir kuruluş kullanıcısının admin panel satırı (B2).
 *
 * Rol ve durum değişiklikleri anında kaydedilir; şifre sıfırlama açılır bir
 * alt formdur. Platform yöneticisi burada şifreyi GÖREMEZ, yalnızca yenisini
 * belirler — mevcut şifre yalnızca hash olarak saklanır.
 */
export default function KullaniciSatiri({
  kullanici,
}: {
  kullanici: {
    id: string;
    ad: string;
    email: string;
    rol: string;
    durum: string;
    createdAt: string;
  };
}) {
  const [bekliyor, basla] = useTransition();
  const [sifreAcik, setSifreAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(
    kullaniciSifreSifirla.bind(null, kullanici.id),
    {}
  );

  const pasif = kullanici.durum !== "aktif";

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-medium text-foreground">
            {kullanici.ad}
            {pasif && (
              <span className="ml-2 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400">
                Pasif
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{kullanici.email}</p>
        </div>

        <select
          aria-label={`${kullanici.ad} rolü`}
          defaultValue={kullanici.rol}
          disabled={bekliyor}
          onChange={(e) =>
            basla(async () => {
              await kullaniciRolDegistir(kullanici.id, e.target.value);
            })
          }
          className="input h-9 w-auto py-0 text-sm"
        >
          {[ROL.tenantAdmin, ROL.uye, ROL.saltOkunur, ROL.platformAdmin].map((r) => (
            <option key={r} value={r}>
              {ROL_ETIKET[r]}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              await kullaniciDurumDegistir(kullanici.id, pasif ? "aktif" : "pasif");
            })
          }
          className="btn-secondary h-9 px-3 text-xs"
        >
          {pasif ? (
            <>
              <UserCheck className="h-3.5 w-3.5" /> Aktifleştir
            </>
          ) : (
            <>
              <UserX className="h-3.5 w-3.5" /> Pasifleştir
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSifreAcik((a) => !a)}
          className="btn-secondary h-9 px-3 text-xs"
        >
          <KeyRound className="h-3.5 w-3.5" /> Şifre
        </button>
      </div>

      {sifreAcik && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="sifre"
            type="text"
            minLength={8}
            required
            placeholder="Yeni şifre"
            className="input h-9 max-w-xs py-0 text-sm"
          />
          <SifreKaydet />
          {state.error && <span className="text-xs text-rose-400">{state.error}</span>}
          {state.ok && <span className="text-xs text-emerald-400">{state.bilgi}</span>}
        </form>
      )}
    </div>
  );
}

function SifreKaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary h-9 px-3 text-xs" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Şifreyi Değiştir"}
    </button>
  );
}
