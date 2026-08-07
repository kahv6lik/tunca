"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ShieldCheck, ShieldOff, RefreshCw, X, Copy, Check, LogOut } from "lucide-react";
import {
  sifreDegistir,
  ikiFaktorBaslat,
  ikiFaktorDogrulaVeAc,
  ikiFaktorKapat,
  yedekKodlariYenile,
  oturumSonlandir,
  digerOturumlariKapat,
  type GuvenlikState,
} from "@/app/(app)/guvenlik/actions";
import { SIFRE_POLITIKA_METNI } from "@/lib/guvenlik-tanimlar";

function Gonder({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </button>
  );
}

// ── Şifre değiştirme ───────────────────────────────────────────────────────

export function SifreDegistirFormu() {
  const [state, formAction] = useFormState<GuvenlikState, FormData>(sifreDegistir, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="mevcut">Mevcut şifreniz</label>
        <input id="mevcut" name="mevcut" type="password" required
          autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="yeni">Yeni şifre</label>
        <input id="yeni" name="yeni" type="password" required
          autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="tekrar">Yeni şifre (tekrar)</label>
        <input id="tekrar" name="tekrar" type="password" required
          autoComplete="new-password" className="input" />
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground">{SIFRE_POLITIKA_METNI}</p>

      {state.error && (
        <p className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="sm:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {state.bilgi}
        </p>
      )}

      <div className="sm:col-span-2">
        <Gonder etiket="Şifreyi Değiştir" />
      </div>
    </form>
  );
}

// ── İki faktörlü doğrulama ─────────────────────────────────────────────────

function YedekKodListesi({ kodlar }: { kodlar: string[] }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="text-sm text-amber-300">
        <strong>Yedek kodlarınız — bir daha gösterilmeyecek.</strong> Telefonunuza
        erişemediğinizde her biri BİR kez giriş yapmanızı sağlar.
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm text-foreground">
        {kodlar.map((k) => (
          <code key={k} className="rounded-lg bg-background/60 px-2 py-1 text-center">{k}</code>
        ))}
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(kodlar.join("\n"));
          setKopyalandi(true);
        }}
        className="btn-secondary h-9 text-xs"
      >
        {kopyalandi ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {kopyalandi ? "Kopyalandı" : "Kodları kopyala"}
      </button>
    </div>
  );
}

export function IkiFaktorPanel({
  aktif,
  zorunlu,
  kalanYedekKod,
}: {
  aktif: boolean;
  zorunlu: boolean;
  kalanYedekKod: number;
}) {
  const [kurulum, setKurulum] = useState<{ sir: string; uri: string } | null>(null);
  const [bekliyor, basla] = useTransition();
  const [acState, acAction] = useFormState<GuvenlikState, FormData>(ikiFaktorDogrulaVeAc, {});
  const [kapatState, kapatAction] = useFormState<GuvenlikState, FormData>(ikiFaktorKapat, {});
  const [yenileState, yenileAction] = useFormState<GuvenlikState, FormData>(
    yedekKodlariYenile,
    {}
  );
  const [kapatAcik, setKapatAcik] = useState(false);
  const [yenileAcik, setYenileAcik] = useState(false);

  if (acState.ok && kurulum) setTimeout(() => setKurulum(null), 0);
  if (kapatState.ok && kapatAcik) setTimeout(() => setKapatAcik(false), 0);
  if (yenileState.ok && yenileAcik) setTimeout(() => setYenileAcik(false), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            aktif
              ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25"
              : "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border"
          }
        >
          {aktif ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          {aktif ? "Açık" : "Kapalı"}
        </span>
        {aktif && (
          <span className="text-sm text-muted-foreground">
            {kalanYedekKod} yedek kod kaldı
          </span>
        )}
        {zorunlu && (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25">
            Kuruluşunuz zorunlu kılmış
          </span>
        )}
      </div>

      {acState.yedekKodlar && <YedekKodListesi kodlar={acState.yedekKodlar} />}
      {yenileState.yedekKodlar && <YedekKodListesi kodlar={yenileState.yedekKodlar} />}

      {!aktif && !kurulum && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              const sonuc = await ikiFaktorBaslat();
              if (sonuc) setKurulum(sonuc);
            })
          }
          className="btn-primary"
        >
          <ShieldCheck className="h-4 w-4" /> İki Faktörü Kur
        </button>
      )}

      {kurulum && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Google Authenticator, 1Password, Authy gibi bir doğrulama uygulaması açın.
            </li>
            <li>
              Aşağıdaki kurulum anahtarını elle ekleyin:
              <code className="mt-1.5 block break-all rounded-lg bg-background/60 px-3 py-2 font-mono text-xs text-foreground">
                {kurulum.sir}
              </code>
            </li>
            <li>Uygulamanın ürettiği 6 haneli kodu girip doğrulayın.</li>
          </ol>

          <form action={acAction} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="kod">Doğrulama kodu</label>
              <input id="kod" name="kod" inputMode="numeric" required
                className="input w-40 text-center tracking-[0.3em]" placeholder="000000" />
            </div>
            <Gonder etiket="Doğrula ve Aç" />
            <button type="button" onClick={() => setKurulum(null)} className="btn-secondary">
              Vazgeç
            </button>
          </form>

          {acState.error && <p className="text-sm text-rose-400">{acState.error}</p>}
        </div>
      )}

      {aktif && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setYenileAcik(true)} className="btn-secondary">
            <RefreshCw className="h-4 w-4" /> Yedek Kodları Yenile
          </button>
          {!zorunlu && (
            <button onClick={() => setKapatAcik(true)} className="btn-secondary">
              <ShieldOff className="h-4 w-4" /> Kapat
            </button>
          )}
        </div>
      )}

      {kapatAcik && (
        <SifreOnayModali
          baslik="İki Faktörü Kapat"
          aciklama="Kapatmak için şifrenizi girin. Hesabınız yalnızca şifreyle korunur hâle gelecek."
          action={kapatAction}
          hata={kapatState.error}
          etiket="Kapat"
          kapat={() => setKapatAcik(false)}
        />
      )}
      {yenileAcik && (
        <SifreOnayModali
          baslik="Yedek Kodları Yenile"
          aciklama="Yeni kod seti üretilir ve ESKİ kodların tamamı geçersiz olur."
          action={yenileAction}
          hata={yenileState.error}
          etiket="Yenile"
          kapat={() => setYenileAcik(false)}
        />
      )}
    </div>
  );
}

function SifreOnayModali({
  baslik,
  aciklama,
  action,
  hata,
  etiket,
  kapat,
}: {
  baslik: string;
  aciklama: string;
  action: (formData: FormData) => void;
  hata?: string;
  etiket: string;
  kapat: () => void;
}) {
  return (
    <ModalKatman
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      onClick={kapat}
    >
      <div className="card my-8 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{baslik}</h2>
          <button onClick={kapat} aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{aciklama}</p>

        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor={`sifre-${etiket}`}>Şifreniz</label>
            <input id={`sifre-${etiket}`} name="sifre" type="password" required
              autoComplete="current-password" className="input" />
          </div>
          {hata && <p className="text-sm text-rose-400">{hata}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={kapat} className="btn-secondary">Vazgeç</button>
            <Gonder etiket={etiket} />
          </div>
        </form>
      </div>
    </ModalKatman>
  );
}

// ── Oturumlar ──────────────────────────────────────────────────────────────

export function OturumIslemleri({ id, buOturum }: { id: string; buOturum: boolean }) {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        if (buOturum && !confirm("Bu oturumu kapatırsanız çıkış yapmış olursunuz. Devam?")) return;
        basla(async () => void (await oturumSonlandir(id)));
      }}
      className="btn-secondary h-8 px-2.5 text-xs"
    >
      {buOturum ? "Çıkış yap" : "Sonlandır"}
    </button>
  );
}

export function DigerOturumlariKapatDugmesi() {
  const [bekliyor, basla] = useTransition();
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => basla(async () => void (await digerOturumlariKapat()))}
      className="btn-secondary"
    >
      <LogOut className="h-4 w-4" /> Diğer Oturumları Kapat
    </button>
  );
}
