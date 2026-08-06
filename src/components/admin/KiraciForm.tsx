"use client";

import { useFormState, useFormStatus } from "react-dom";
import { kiraciOlustur, kiraciGuncelle, type FormState } from "@/app/admin/actions";

export type KiraciDegerleri = {
  id?: string;
  ad: string;
  slug: string;
  durum: string;
  iletisimAd: string;
  iletisimEmail: string;
  iletisimTel: string;
  notlar: string;
  planId: string;
  logoUrl: string;
  anaRenk: string;
  altAlan: string;
};

const BOS: KiraciDegerleri = {
  ad: "",
  slug: "",
  durum: "aktif",
  iletisimAd: "",
  iletisimEmail: "",
  iletisimTel: "",
  notlar: "",
  planId: "",
  logoUrl: "",
  anaRenk: "",
  altAlan: "",
};

function Kaydet({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : label}
    </button>
  );
}

export default function KiraciForm({
  mevcut,
  planlar,
}: {
  mevcut?: KiraciDegerleri;
  planlar: { id: string; ad: string }[];
}) {
  const v = mevcut ?? BOS;
  const duzenleme = Boolean(mevcut?.id);

  const action = duzenleme ? kiraciGuncelle.bind(null, mevcut!.id!) : kiraciOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Kuruluş</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ad">
              Kuruluş Adı *
            </label>
            <input id="ad" name="ad" required defaultValue={v.ad} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="slug">
              Kiracı Kodu *
            </label>
            <input
              id="slug"
              name="slug"
              required
              defaultValue={v.slug}
              pattern="[a-zA-Z0-9-]+"
              className="input font-mono"
              placeholder="ornek-firma"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Giriş ekranında birden fazla hesabı olan kullanıcıların yazdığı koddur.
              Küçük harf, rakam ve tire.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="durum">
              Durum
            </label>
            <select id="durum" name="durum" defaultValue={v.durum} className="input">
              <option value="aktif">Aktif</option>
              <option value="askida">Askıda</option>
              <option value="pasif">Pasif</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Aktif olmayan kuruluşun kullanıcıları giriş yapamaz. Veri silinmez.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="planId">
              Paket
            </label>
            <select id="planId" name="planId" defaultValue={v.planId} className="input">
              <option value="">— Paketsiz —</option>
              {planlar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-foreground">İletişim</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="iletisimAd">
              Yetkili
            </label>
            <input id="iletisimAd" name="iletisimAd" defaultValue={v.iletisimAd} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="iletisimEmail">
              E-posta
            </label>
            <input
              id="iletisimEmail"
              name="iletisimEmail"
              type="email"
              defaultValue={v.iletisimEmail}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="iletisimTel">
              Telefon
            </label>
            <input id="iletisimTel" name="iletisimTel" defaultValue={v.iletisimTel} className="input" />
          </div>
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="notlar">
            Notlar
          </label>
          <textarea id="notlar" name="notlar" rows={3} defaultValue={v.notlar} className="input" />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 font-semibold text-foreground">Markalama</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Kuruluşun kendi logosu ve ana rengi CRM arayüzünde uygulanır (B7).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="logoUrl">
              Logo bağlantısı
            </label>
            <input
              id="logoUrl"
              name="logoUrl"
              defaultValue={v.logoUrl}
              className="input"
              placeholder="https://…/logo.png"
            />
          </div>
          <div>
            <label className="label" htmlFor="anaRenk">
              Ana renk
            </label>
            <input
              id="anaRenk"
              name="anaRenk"
              defaultValue={v.anaRenk}
              className="input font-mono"
              placeholder="#6366f1"
            />
          </div>
          <div>
            <label className="label" htmlFor="altAlan">
              Alt alan adı
            </label>
            <input
              id="altAlan"
              name="altAlan"
              defaultValue={v.altAlan}
              className="input font-mono"
              placeholder="musteri"
            />
          </div>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}
      {state.ok && state.bilgi && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {state.bilgi}
        </p>
      )}

      <div className="flex justify-end">
        <Kaydet label={duzenleme ? "Değişiklikleri Kaydet" : "Kuruluşu Oluştur"} />
      </div>
    </form>
  );
}
