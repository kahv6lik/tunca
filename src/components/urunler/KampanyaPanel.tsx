"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import {
  kampanyaOlustur,
  kampanyaGuncelle,
  type FormState,
} from "@/app/(app)/kampanyalar/actions";
import { KAMPANYA_TIP, KAMPANYA_DURUM } from "@/lib/constants";

type Secenek = { id: string; ad: string };

export type KampanyaDegerleri = {
  id: string;
  kod: string;
  ad: string;
  aciklama: string;
  tip: string;
  durum: string;
  baslangic: string;
  bitis: string;
  deger: number;
  alN: number;
  odeM: number;
  kota: number;
  urunIdler: string[];
  paketIdler: string[];
  firmaIdler: string[];
};

const DURUM_ETIKET: Record<string, string> = {
  taslak: "Taslak",
  aktif: "Aktif",
  duraklatildi: "Duraklatıldı",
  sonaerdi: "Sona erdi",
};

/**
 * Kampanya tanım paneli (Faz 14 / T3).
 *
 * Kapsam listeleri BOŞ bırakılabilir ve bu "hepsi" demektir. En sık
 * kullanılan hâlin en az iş gerektirmesi bilinçli bir tercih: her ürünü tek
 * tek işaretlemek zorunda kalmak kampanya açmayı caydırırdı.
 */
export default function KampanyaPanel({
  urunler,
  paketler,
  firmalar,
  mevcut,
}: {
  urunler: Secenek[];
  paketler: Secenek[];
  firmalar: Secenek[];
  mevcut?: KampanyaDegerleri;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? kampanyaGuncelle.bind(null, mevcut!.id) : kampanyaOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [tip, setTip] = useState(mevcut?.tip ?? "yuzde");

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);
  const k = mevcut?.id ?? "yeni";
  const tipTanimi = KAMPANYA_TIP.find((t) => t.deger === tip);

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </button>
      )}

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {duzenleme ? "Kampanyayı Düzenle" : "Yeni Kampanya"}
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
                <label className="label" htmlFor={`kkod-${k}`}>Kampanya Kodu *</label>
                <input id={`kkod-${k}`} name="kod" required defaultValue={mevcut?.kod} className="input" />
              </div>

              <div>
                <label className="label" htmlFor={`kad-${k}`}>Kampanya Adı *</label>
                <input id={`kad-${k}`} name="ad" required defaultValue={mevcut?.ad} className="input" />
              </div>

              <div>
                <label className="label" htmlFor={`ktip-${k}`}>Kampanya Tipi *</label>
                <select
                  id={`ktip-${k}`}
                  name="tip"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="input"
                >
                  {KAMPANYA_TIP.map((t) => (
                    <option key={t.deger} value={t.deger}>{t.etiket}</option>
                  ))}
                </select>
                {tipTanimi && (
                  <p className="mt-1 text-xs text-muted-foreground">{tipTanimi.aciklama}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor={`kdurum-${k}`}>Durum</label>
                <select
                  id={`kdurum-${k}`}
                  name="durum"
                  defaultValue={mevcut?.durum ?? "taslak"}
                  className="input"
                >
                  {KAMPANYA_DURUM.map((d) => (
                    <option key={d} value={d}>{DURUM_ETIKET[d]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`kbas-${k}`}>Başlangıç *</label>
                <input
                  id={`kbas-${k}`}
                  name="baslangic"
                  type="date"
                  required
                  defaultValue={mevcut?.baslangic}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`kbit-${k}`}>Bitiş *</label>
                <input
                  id={`kbit-${k}`}
                  name="bitis"
                  type="date"
                  required
                  defaultValue={mevcut?.bitis}
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Bitiş günü dahildir (gün sonuna kadar geçerli).
                </p>
              </div>

              {/* Tipe göre değer alanları */}
              {tip === "alnodem" ? (
                <>
                  <div>
                    <label className="label" htmlFor={`kaln-${k}`}>Alınan Adet (X) *</label>
                    <input
                      id={`kaln-${k}`}
                      name="alN"
                      type="number"
                      min={1}
                      defaultValue={mevcut?.alN || 3}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`kodem-${k}`}>Ödenen Adet (Y) *</label>
                    <input
                      id={`kodem-${k}`}
                      name="odeM"
                      type="number"
                      min={1}
                      defaultValue={mevcut?.odeM || 2}
                      className="input"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Y, X'ten küçük olmalı (3 al 2 öde gibi).
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="label" htmlFor={`kdeger-${k}`}>
                    {tip === "yuzde"
                      ? "İndirim Oranı (%) *"
                      : tip === "paketfiyat"
                        ? "Kampanya Birim Fiyatı *"
                        : "İndirim Tutarı *"}
                  </label>
                  <input
                    id={`kdeger-${k}`}
                    name="deger"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={mevcut?.deger ?? 0}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label" htmlFor={`kkota-${k}`}>Kota (adet)</label>
                <input
                  id={`kkota-${k}`}
                  name="kota"
                  type="number"
                  min={0}
                  defaultValue={mevcut?.kota ?? 0}
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  0 = sınırsız. Her satışta otomatik düşer.
                </p>
              </div>

              {/* ── Kapsam ── */}
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                <Kapsam
                  ad="urunIdler"
                  baslik="Ürünler"
                  secenekler={urunler}
                  secili={mevcut?.urunIdler ?? []}
                />
                <Kapsam
                  ad="paketIdler"
                  baslik="Paketler"
                  secenekler={paketler}
                  secili={mevcut?.paketIdler ?? []}
                />
                <Kapsam
                  ad="firmaIdler"
                  baslik="Firmalar"
                  secenekler={firmalar}
                  secili={mevcut?.firmaIdler ?? []}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`kacik-${k}`}>Açıklama</label>
                <textarea
                  id={`kacik-${k}`}
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

/** Çoklu seçim kutusu — boş bırakmak "hepsi" demektir. */
function Kapsam({
  ad,
  baslik,
  secenekler,
  secili,
}: {
  ad: string;
  baslik: string;
  secenekler: Secenek[];
  secili: string[];
}) {
  return (
    <div>
      <label className="label" htmlFor={ad}>{baslik}</label>
      <select
        id={ad}
        name={ad}
        multiple
        defaultValue={secili}
        size={5}
        className="input h-auto"
      >
        {secenekler.map((s) => (
          <option key={s.id} value={s.id}>{s.ad}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">Boş = hepsi</p>
    </div>
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
