"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { UserPlus, KeyRound, X, Copy, Check } from "lucide-react";
import {
  ekipRolDegistir,
  ekipDurumDegistir,
  ekipSifreSifirla,
  ekipDavetOlustur,
  ekipDavetIptal,
  type FormState,
} from "@/app/(app)/kullanicilar/actions";
import { ROL_ETIKET } from "@/lib/yetki-tanimlar";

const ROLLER = ["tenant_admin", "uye", "salt_okunur"] as const;

function Gonder({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </button>
  );
}

/** Satırdaki rol seçici + durum düğmesi. Kendi satırında ikisi de kilitlidir. */
export function EkipSatirIslemleri({
  kullanici,
  benim,
}: {
  kullanici: { id: string; email: string; rol: string; durum: string };
  benim: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Rol"
        className="input h-9 w-40 text-xs"
        value={kullanici.rol}
        disabled={benim || bekliyor}
        onChange={(e) =>
          basla(async () => {
            setHata(null);
            const s = await ekipRolDegistir(kullanici.id, e.target.value);
            if (s.error) setHata(s.error);
          })
        }
      >
        {ROLLER.map((r) => (
          <option key={r} value={r}>
            {ROL_ETIKET[r]}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={benim || bekliyor}
        onClick={() =>
          basla(async () => {
            setHata(null);
            const s = await ekipDurumDegistir(
              kullanici.id,
              kullanici.durum === "aktif" ? "pasif" : "aktif"
            );
            if (s.error) setHata(s.error);
          })
        }
        className="btn-secondary h-9 px-3 text-xs disabled:opacity-40"
      >
        {kullanici.durum === "aktif" ? "Pasifleştir" : "Aktifleştir"}
      </button>

      <SifrePanel kullaniciId={kullanici.id} email={kullanici.email} devre={benim} />

      {hata && <span className="w-full text-right text-xs text-rose-400">{hata}</span>}
    </div>
  );
}

function SifrePanel({
  kullaniciId,
  email,
  devre,
}: {
  kullaniciId: string;
  email: string;
  devre: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(
    ekipSifreSifirla.bind(null, kullaniciId),
    {}
  );

  return (
    <>
      <button
        type="button"
        disabled={devre}
        onClick={() => setAcik(true)}
        aria-label="Şifre sıfırla"
        title="Şifre sıfırla"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <KeyRound className="h-4 w-4" />
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Şifre Sıfırla</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{email}</p>

            {state.ok ? (
              <p className="text-sm text-emerald-500">{state.bilgi}</p>
            ) : (
              <form action={formAction} className="space-y-4">
                <div>
                  <label className="label" htmlFor={`sifre-${kullaniciId}`}>
                    Yeni şifre (en az 8 karakter)
                  </label>
                  <input
                    id={`sifre-${kullaniciId}`}
                    name="sifre"
                    type="text"
                    minLength={8}
                    required
                    className="input"
                    autoComplete="off"
                  />
                </div>
                {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                    Vazgeç
                  </button>
                  <Gonder etiket="Sıfırla" />
                </div>
              </form>
            )}
          </div>
        </ModalKatman>
      )}
    </>
  );
}

/** Davet oluşturma — bağlantı BİR KEZ gösterilir. */
export function DavetPaneli() {
  const [acik, setAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(ekipDavetOlustur, {});
  const [kopyalandi, setKopyalandi] = useState(false);

  const baglanti =
    state.ok && state.bilgi
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.bilgi}`
      : null;

  return (
    <>
      <button onClick={() => setAcik(true)} className="btn-primary">
        <UserPlus className="h-4 w-4" /> Davet Et
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Ekibe Davet Et</h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {baglanti ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Davet oluşturuldu. Bağlantıyı kopyalayıp davet ettiğiniz kişiye iletin —
                  <strong className="text-foreground"> bu bağlantı bir daha gösterilmez</strong>{" "}
                  ve 7 gün geçerlidir.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    {baglanti}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(baglanti);
                      setKopyalandi(true);
                    }}
                    aria-label="Bağlantıyı kopyala"
                    className="btn-secondary h-9 px-3"
                  >
                    {kopyalandi ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setAcik(false)} className="btn-primary">
                    Tamam
                  </button>
                </div>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <div>
                  <label className="label" htmlFor="davet-ad">Ad Soyad *</label>
                  <input id="davet-ad" name="ad" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="davet-email">E-posta *</label>
                  <input id="davet-email" name="email" type="email" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="davet-rol">Rol</label>
                  <select id="davet-rol" name="rol" className="input" defaultValue="uye">
                    {ROLLER.map((r) => (
                      <option key={r} value={r}>
                        {ROL_ETIKET[r]}
                      </option>
                    ))}
                  </select>
                </div>
                {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                    Vazgeç
                  </button>
                  <Gonder etiket="Davet Oluştur" />
                </div>
              </form>
            )}
          </div>
        </ModalKatman>
      )}
    </>
  );
}

export function DavetIptalDugmesi({ id }: { id: string }) {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        if (!confirm("Bu davet iptal edilsin mi? Bağlantı geçersiz olur.")) return;
        basla(async () => void (await ekipDavetIptal(id)));
      }}
      className="btn-secondary h-8 px-2.5 text-xs"
    >
      İptal Et
    </button>
  );
}
