"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Copy, Check, Trash2, MailPlus } from "lucide-react";
import { davetOlustur, davetIptal, type FormState } from "@/app/admin/actions";
import { ROL, ROL_ETIKET } from "@/lib/yetki-tanimlar";
import { formatTarih } from "@/lib/format";

type Davet = {
  id: string;
  ad: string;
  email: string;
  rol: string;
  sonKullanma: string;
  kullanildi: string | null;
  olusturanEmail: string;
};

/**
 * Kullanıcı daveti (B3).
 *
 * E-posta gönderimi Faz 8'e (D1) bırakıldı; şu an bağlantı ekranda gösterilir
 * ve yönetici kopyalar. Bağlantı YALNIZCA bir kez görünür — token'ın kendisi
 * veritabanında saklanmaz, yalnızca sha256 özeti tutulur.
 */
export default function DavetPanel({
  tenantId,
  davetler,
}: {
  tenantId: string;
  davetler: Davet[];
}) {
  const [state, formAction] = useFormState<FormState, FormData>(
    davetOlustur.bind(null, tenantId),
    {}
  );
  const [kopyalandi, setKopyalandi] = useState(false);
  const [bekliyor, basla] = useTransition();

  const baglanti =
    state.ok && state.bilgi
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.bilgi}`
      : null;

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold text-foreground">Kullanıcı Daveti</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Davet edilen kişi bağlantı üzerinden kendi şifresini belirler. Bağlantı 7 gün
        geçerlidir ve tek kullanımlıktır.
      </p>

      <form action={formAction} className="grid gap-3 sm:grid-cols-4">
        <input name="ad" required placeholder="Ad Soyad" className="input" />
        <input name="email" type="email" required placeholder="E-posta" className="input" />
        <select name="rol" defaultValue={ROL.uye} className="input">
          {[ROL.tenantAdmin, ROL.uye, ROL.saltOkunur].map((r) => (
            <option key={r} value={r}>
              {ROL_ETIKET[r]}
            </option>
          ))}
        </select>
        <Gonder />
      </form>

      {state.error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}

      {baglanti && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="mb-2 text-sm text-emerald-400">
            Davet oluşturuldu. Bağlantıyı kopyalayıp kullanıcıya iletin — bir daha
            gösterilmeyecek.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-background/60 px-2 py-1.5 text-xs">
              {baglanti}
            </code>
            <button
              type="button"
              className="btn-secondary h-9 px-3 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(baglanti);
                setKopyalandi(true);
                setTimeout(() => setKopyalandi(false), 2000);
              }}
            >
              {kopyalandi ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {kopyalandi ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        </div>
      )}

      {davetler.length > 0 && (
        <div className="mt-5 divide-y divide-border/50 border-t border-border/60 pt-2">
          {davetler.map((d) => {
            const suresiGecti = new Date(d.sonKullanma) < new Date();
            return (
              <div key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium text-foreground">{d.ad}</p>
                  <p className="text-xs text-muted-foreground">{d.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{ROL_ETIKET[d.rol] ?? d.rol}</span>
                <span
                  className={
                    d.kullanildi
                      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"
                      : suresiGecti
                        ? "rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400"
                        : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"
                  }
                >
                  {d.kullanildi
                    ? `Kullanıldı · ${formatTarih(d.kullanildi)}`
                    : suresiGecti
                      ? "Süresi doldu"
                      : `Bekliyor · ${formatTarih(d.sonKullanma)}`}
                </span>
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() =>
                    basla(async () => {
                      await davetIptal(d.id, tenantId);
                    })
                  }
                  aria-label="Daveti sil"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <MailPlus className="h-4 w-4" />
      {pending ? "Oluşturuluyor…" : "Davet Et"}
    </button>
  );
}
