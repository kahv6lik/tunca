"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import { destekOlustur, destekGuncelle, type FormState } from "@/app/(app)/destek/actions";
import {
  DESTEK_KANAL,
  DESTEK_ONCELIK,
  DESTEK_DURUM,
  durumBadge,
} from "@/lib/constants";

export type DestekDegerleri = {
  id: string;
  firmaId: string;
  kisiId: string;
  projeId: string;
  baslik: string;
  aciklama: string;
  kanal: string;
  oncelik: string;
  durum: string;
  atananId: string;
};

/**
 * Destek kaydı formu (Faz 16 / P2).
 *
 * Kanal ve öncelik SABİT listelerden seçilir; serbest metin olsaydı kanal
 * kırılımı raporu ("telefon" / "Telefon" / "tel") anlamsızlaşırdı.
 */
export default function DestekPanel({
  firmalar,
  kisiler,
  projeler,
  kullanicilar,
  mevcut,
  sabitFirmaId,
}: {
  firmalar: { id: string; ad: string }[];
  kisiler?: { id: string; ad: string }[];
  projeler?: { id: string; kod: string; ad: string }[];
  kullanicilar: { id: string; name: string }[];
  mevcut?: DestekDegerleri;
  sabitFirmaId?: string;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? destekGuncelle.bind(null, mevcut!.id) : destekOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary text-sm">
          <Pencil className="h-4 w-4" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Destek Kaydı
        </button>
      )}

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Destek Kaydını Düzenle" : "Yeni Destek Kaydı"}
              </h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor={`dbaslik-${k}`}>Konu *</label>
                <input
                  id={`dbaslik-${k}`}
                  name="baslik"
                  required
                  defaultValue={mevcut?.baslik}
                  className="input"
                  placeholder="ör. Barkod okuyucu bağlanmıyor"
                />
              </div>

              {sabitFirmaId ? (
                <input type="hidden" name="firmaId" value={sabitFirmaId} />
              ) : (
                <div>
                  <label className="label" htmlFor={`dfirma-${k}`}>Firma *</label>
                  <select
                    id={`dfirma-${k}`}
                    name="firmaId"
                    required
                    defaultValue={mevcut?.firmaId ?? ""}
                    className="input"
                  >
                    <option value="">Seçin…</option>
                    {firmalar.map((f) => (
                      <option key={f.id} value={f.id}>{f.ad}</option>
                    ))}
                  </select>
                </div>
              )}

              {kisiler && kisiler.length > 0 && (
                <div>
                  <label className="label" htmlFor={`dkisi-${k}`}>Bildiren Kişi</label>
                  <select
                    id={`dkisi-${k}`}
                    name="kisiId"
                    defaultValue={mevcut?.kisiId ?? ""}
                    className="input"
                  >
                    <option value="">—</option>
                    {kisiler.map((x) => (
                      <option key={x.id} value={x.id}>{x.ad}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor={`dkanal-${k}`}>Geliş Kanalı *</label>
                <select
                  id={`dkanal-${k}`}
                  name="kanal"
                  required
                  defaultValue={mevcut?.kanal ?? "telefon"}
                  className="input"
                >
                  {DESTEK_KANAL.map((x) => (
                    <option key={x.deger} value={x.deger}>{x.etiket}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`doncelik-${k}`}>Öncelik *</label>
                <select
                  id={`doncelik-${k}`}
                  name="oncelik"
                  required
                  defaultValue={mevcut?.oncelik ?? "orta"}
                  className="input"
                >
                  {DESTEK_ONCELIK.map((x) => (
                    <option key={x.deger} value={x.deger}>{x.etiket}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`datanan-${k}`}>Atanan Kişi</label>
                <select
                  id={`datanan-${k}`}
                  name="atananId"
                  defaultValue={mevcut?.atananId ?? ""}
                  className="input"
                >
                  <option value="">— (atanmamış)</option>
                  {kullanicilar.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`ddurum-${k}`}>Durum</label>
                <select
                  id={`ddurum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "acik"}
                  className="input"
                >
                  {DESTEK_DURUM.map((d) => (
                    <option key={d} value={d}>{durumBadge(d).label}</option>
                  ))}
                </select>
              </div>

              {projeler && projeler.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`dproje-${k}`}>Proje</label>
                  <select
                    id={`dproje-${k}`}
                    name="projeId"
                    defaultValue={mevcut?.projeId ?? ""}
                    className="input"
                  >
                    <option value="">— (projesiz)</option>
                    {projeler.map((p) => (
                      <option key={p.id} value={p.id}>{p.kod} — {p.ad}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`dacik-${k}`}>Açıklama</label>
                <textarea
                  id={`dacik-${k}`}
                  name="aciklama"
                  rows={3}
                  defaultValue={mevcut?.aciklama}
                  className="input"
                />
              </div>

              {state.error && (
                <p className="sm:col-span-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                <button type="button" onClick={() => setAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <Kaydet />
              </div>
            </form>
          </div>
        </ModalKatman>
      )}
    </>
  );
}

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}
