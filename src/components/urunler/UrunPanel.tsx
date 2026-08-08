"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import {
  urunOlustur,
  urunGuncelle,
  type FormState,
} from "@/app/(app)/urunler/actions";
import { URUN_BIRIMLERI, PARA_BIRIMI, URUN_DURUM } from "@/lib/constants";

export type UrunDegerleri = {
  id: string;
  kod: string;
  ad: string;
  aciklama: string;
  kategori: string;
  birim: string;
  listeFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  durum: string;
  stokTakibi: boolean;
  kritikStok: number;
};

/**
 * Ürün ekleme / düzenleme paneli (Faz 14 / T1).
 *
 * Stok MİKTARI burada yoktur ve olmamalıdır: bakiye hareket defterinden
 * gelir (T7). Buradan yazılabilseydi defter ile bakiye ayrışırdı.
 */
export default function UrunPanel({ mevcut }: { mevcut?: UrunDegerleri }) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? urunGuncelle.bind(null, mevcut!.id) : urunOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [stokTakibi, setStokTakibi] = useState(mevcut?.stokTakibi ?? false);

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Ürün
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
                {duzenleme ? "Ürünü Düzenle" : "Yeni Ürün"}
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
              <div>
                <label className="label" htmlFor={`kod-${k}`}>Ürün Kodu *</label>
                <input
                  id={`kod-${k}`}
                  name="kod"
                  required
                  defaultValue={mevcut?.kod}
                  className="input"
                  placeholder="ör. DAN-001"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Büyük harfe çevrilir; kuruluş içinde tekildir.
                </p>
              </div>

              <div>
                <label className="label" htmlFor={`ad-${k}`}>Ürün / Hizmet Adı *</label>
                <input
                  id={`ad-${k}`}
                  name="ad"
                  required
                  defaultValue={mevcut?.ad}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`kategori-${k}`}>Kategori</label>
                <input
                  id={`kategori-${k}`}
                  name="kategori"
                  defaultValue={mevcut?.kategori}
                  className="input"
                  placeholder="ör. Danışmanlık"
                />
              </div>

              <div>
                <label className="label" htmlFor={`birim-${k}`}>Birim</label>
                <select
                  id={`birim-${k}`}
                  name="birim"
                  defaultValue={mevcut?.birim ?? "adet"}
                  className="input"
                >
                  {URUN_BIRIMLERI.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`fiyat-${k}`}>Liste Fiyatı</label>
                <input
                  id={`fiyat-${k}`}
                  name="listeFiyat"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={mevcut?.listeFiyat ?? 0}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`pb-${k}`}>Para Birimi</label>
                <select
                  id={`pb-${k}`}
                  name="paraBirimi"
                  defaultValue={mevcut?.paraBirimi ?? "TRY"}
                  className="input"
                >
                  {PARA_BIRIMI.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`kdv-${k}`}>KDV Oranı (%)</label>
                <input
                  id={`kdv-${k}`}
                  name="kdvOrani"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  defaultValue={mevcut?.kdvOrani ?? 20}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`durum-${k}`}>Durum</label>
                <select
                  id={`durum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "aktif"}
                  className="input"
                >
                  {URUN_DURUM.map((d) => (
                    <option key={d} value={d}>
                      {d === "aktif" ? "Aktif" : "Pasif"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="stokTakibi"
                    value="1"
                    checked={stokTakibi}
                    onChange={(e) => setStokTakibi(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Stok takibi yapılsın
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hizmet kalemlerinde kapalı bırakın — stoğu olmayan bir kalem için
                  bakiye ve uyarı üretmenin anlamı yok.
                </p>
              </div>

              {stokTakibi && (
                <div>
                  <label className="label" htmlFor={`kritik-${k}`}>Kritik Stok Seviyesi</label>
                  <input
                    id={`kritik-${k}`}
                    name="kritikStok"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={mevcut?.kritikStok ?? 0}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    0 = uyarma. Bakiye bu değerin altına düşünce uyarı verilir.
                  </p>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`aciklama-${k}`}>Açıklama</label>
                <textarea
                  id={`aciklama-${k}`}
                  name="aciklama"
                  rows={2}
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
