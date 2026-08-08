"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import {
  paketOlustur,
  paketGuncelle,
  type FormState,
} from "@/app/(app)/paketler/actions";
import { PARA_BIRIMI, URUN_DURUM } from "@/lib/constants";
import { formatPara } from "@/lib/format";
import { paketBirimFiyati } from "@/lib/fiyat-saf";

type UrunSecenek = { id: string; kod: string; ad: string; listeFiyat: number };

export type PaketDegerleri = {
  id: string;
  kod: string;
  ad: string;
  aciklama: string;
  firmaId: string;
  paraBirimi: string;
  sabitFiyat: boolean;
  fiyat: number;
  iskontoOrani: number;
  durum: string;
  kalemler: { urunId: string; miktar: number }[];
};

/**
 * Paket ekleme / düzenleme paneli (Faz 14 / T2).
 *
 * Önizleme, sunucudaki fiyat motorunun AYNI fonksiyonunu (`paketBirimFiyati`)
 * çağırır. İstemcide ayrı bir formül yazmak, ekranda görünen rakamla
 * kaydedilen rakamın ayrışmasına açık kapı bırakırdı.
 */
export default function PaketPanel({
  urunler,
  firmalar,
  mevcut,
}: {
  urunler: UrunSecenek[];
  firmalar: { id: string; ad: string }[];
  mevcut?: PaketDegerleri;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? paketGuncelle.bind(null, mevcut!.id) : paketOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  const [kalemler, setKalemler] = useState<{ urunId: string; miktar: number }[]>(
    mevcut?.kalemler.length ? mevcut.kalemler : [{ urunId: "", miktar: 1 }]
  );
  const [sabitFiyat, setSabitFiyat] = useState(mevcut?.sabitFiyat ?? false);
  const [fiyat, setFiyat] = useState(mevcut?.fiyat ?? 0);
  const [iskonto, setIskonto] = useState(mevcut?.iskontoOrani ?? 0);

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const urunOf = (id: string) => urunler.find((u) => u.id === id);
  const dolular = kalemler.filter((k) => k.urunId);
  const listeToplam = dolular.reduce(
    (s, k) => s + (urunOf(k.urunId)?.listeFiyat ?? 0) * k.miktar,
    0
  );

  const onizlemePaketi = {
    paketId: mevcut?.id ?? "yeni",
    sabitFiyat,
    fiyat,
    iskontoOrani: iskonto,
    kalemler: dolular.map((k) => ({
      urunId: k.urunId,
      miktar: k.miktar,
      listeFiyat: urunOf(k.urunId)?.listeFiyat ?? 0,
    })),
  };

  const paketToplam = dolular.reduce((s, k) => {
    const birim = paketBirimFiyati(
      onizlemePaketi,
      k.urunId,
      urunOf(k.urunId)?.listeFiyat ?? 0
    );
    return s + (birim ?? 0) * k.miktar;
  }, 0);

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-8 px-2.5 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Paket
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
                {duzenleme ? "Paketi Düzenle" : "Yeni Paket"}
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
                <label className="label" htmlFor="paket-kod">Paket Kodu *</label>
                <input id="paket-kod" name="kod" required defaultValue={mevcut?.kod} className="input" />
              </div>

              <div>
                <label className="label" htmlFor="paket-ad">Paket Adı *</label>
                <input id="paket-ad" name="ad" required defaultValue={mevcut?.ad} className="input" />
              </div>

              <div>
                <label className="label" htmlFor="paket-firma">Firma</label>
                <select
                  id="paket-firma"
                  name="firmaId"
                  defaultValue={mevcut?.firmaId ?? ""}
                  className="input"
                >
                  <option value="">Tüm firmalar (genel paket)</option>
                  {firmalar.map((f) => (
                    <option key={f.id} value={f.id}>{f.ad}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Firma seçilirse paket yalnızca o müşteriye sunulur.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="paket-durum">Durum</label>
                <select
                  id="paket-durum"
                  name="durum"
                  defaultValue={mevcut?.durum ?? "aktif"}
                  className="input"
                >
                  {URUN_DURUM.map((d) => (
                    <option key={d} value={d}>{d === "aktif" ? "Aktif" : "Pasif"}</option>
                  ))}
                </select>
              </div>

              {/* ── Kalemler ── */}
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <label className="label mb-0">Paket İçeriği *</label>
                  <button
                    type="button"
                    onClick={() => setKalemler((k) => [...k, { urunId: "", miktar: 1 }])}
                    className="btn-secondary h-8 px-2.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Ürün Ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {kalemler.map((k, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        name={`kalem-${i}-urunId`}
                        value={k.urunId}
                        onChange={(e) =>
                          setKalemler((ks) =>
                            ks.map((x, j) => (j === i ? { ...x, urunId: e.target.value } : x))
                          )
                        }
                        className="input flex-1"
                      >
                        <option value="">Ürün seçin…</option>
                        {urunler.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.kod} — {u.ad}
                          </option>
                        ))}
                      </select>
                      <input
                        name={`kalem-${i}-miktar`}
                        type="number"
                        step="0.01"
                        min={0}
                        value={k.miktar}
                        onChange={(e) =>
                          setKalemler((ks) =>
                            ks.map((x, j) =>
                              j === i ? { ...x, miktar: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="input w-28"
                        aria-label="Miktar"
                      />
                      <button
                        type="button"
                        onClick={() => setKalemler((ks) => ks.filter((_, j) => j !== i))}
                        aria-label="Kalemi sil"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fiyatlama ── */}
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="sabitFiyat"
                    value="1"
                    checked={sabitFiyat}
                    onChange={(e) => setSabitFiyat(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Sabit paket fiyatı uygula
                </label>
              </div>

              {sabitFiyat ? (
                <div>
                  <label className="label" htmlFor="paket-fiyat">Paket Fiyatı</label>
                  <input
                    id="paket-fiyat"
                    name="fiyat"
                    type="number"
                    step="0.01"
                    min={0}
                    value={fiyat}
                    onChange={(e) => setFiyat(Number(e.target.value))}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kalemlere liste değerine orantılı dağıtılır.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="paket-iskonto">İskonto (%)</label>
                  <input
                    id="paket-iskonto"
                    name="iskontoOrani"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={iskonto}
                    onChange={(e) => setIskonto(Number(e.target.value))}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label" htmlFor="paket-pb">Para Birimi</label>
                <select
                  id="paket-pb"
                  name="paraBirimi"
                  defaultValue={mevcut?.paraBirimi ?? "TRY"}
                  className="input"
                >
                  {PARA_BIRIMI.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="paket-aciklama">Açıklama</label>
                <textarea
                  id="paket-aciklama"
                  name="aciklama"
                  rows={2}
                  defaultValue={mevcut?.aciklama}
                  className="input"
                />
              </div>

              {/* Önizleme — sunucudaki hesabın aynısı */}
              {dolular.length > 0 && (
                <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Liste toplamı</span>
                    <span>{formatPara(listeToplam)}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold text-foreground">
                    <span>Paket toplamı</span>
                    <span>{formatPara(paketToplam)}</span>
                  </div>
                  {listeToplam > 0 && (
                    <p className="mt-1 text-xs text-emerald-500">
                      Müşteri avantajı: {formatPara(listeToplam - paketToplam)} (%
                      {Math.round(((listeToplam - paketToplam) / listeToplam) * 100)})
                    </p>
                  )}
                </div>
              )}

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
