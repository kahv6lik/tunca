"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Pencil, X } from "lucide-react";
import { createFirsat, updateFirsat, type FormState } from "@/app/(app)/firsatlar/actions";
import { FIRSAT_DURUM, PARA_BIRIMI, durumBadge } from "@/lib/constants";
import OzelAlanGirdileri from "@/components/OzelAlanGirdileri";
import type { OzelAlanTanimi } from "@/lib/ozel-alan-tanimlar";

/** Firma seçicideki "yeni firma" sözde değeri — sunucu tarafıyla aynı. */
const YENI_FIRMA = "__yeni__";

type Secenek = { id: string; ad: string };
type AsamaSecenek = { id: string; ad: string; olasilik: number };

export type FirsatDegerleri = {
  id: string;
  firmaId: string;
  kisiId: string;
  asamaId: string;
  baslik: string;
  tutar: number;
  paraBirimi: string;
  olasilik: number;
  kapanisTarihi: string;
  sorumluId: string;
  durum: string;
  kapanisSebebi: string;
  aciklama: string;
};

/**
 * Fırsat ekleme / düzenleme paneli (Faz 6 / C2).
 *
 * `firmaId` sabitlenmişse (firma detay sayfası) firma seçici gizlenir ve
 * kişi listesi o firmanınkilerle sınırlıdır. Sunucu tarafı da kişinin
 * seçilen firmaya ait olduğunu ayrıca doğrular.
 */
export default function FirsatPanel({
  asamalar,
  firmalar,
  kullanicilar,
  kisiler,
  sabitFirmaId,
  mevcut,
  ozelAlanlar = [],
  ozelDegerler = {},
  yeniFirmaAcilabilir = false,
}: {
  asamalar: AsamaSecenek[];
  firmalar?: Secenek[];
  kullanicilar: { id: string; name: string }[];
  kisiler?: Secenek[];
  sabitFirmaId?: string;
  mevcut?: FirsatDegerleri;
  ozelAlanlar?: OzelAlanTanimi[];
  ozelDegerler?: Record<string, string>;
  /** Kullanıcının firma oluşturma izni var mı? (Faz 13 / H6) */
  yeniFirmaAcilabilir?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const duzenleme = Boolean(mevcut);

  const action = duzenleme ? updateFirsat.bind(null, mevcut!.id) : createFirsat;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  const [asamaId, setAsamaId] = useState(mevcut?.asamaId ?? asamalar[0]?.id ?? "");
  const [olasilik, setOlasilik] = useState(
    mevcut?.olasilik ?? asamalar[0]?.olasilik ?? 0
  );
  const [durum, setDurum] = useState(mevcut?.durum ?? "acik");
  const [firmaSecim, setFirmaSecim] = useState(mevcut?.firmaId ?? "");

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  return (
    <>
      {duzenleme ? (
        <button onClick={() => setAcik(true)} className="btn-secondary h-9 px-3 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Düzenle
        </button>
      ) : (
        <button onClick={() => setAcik(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Yeni Fırsat
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
                {duzenleme ? "Fırsatı Düzenle" : "Yeni Fırsat"}
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
                <label className="label" htmlFor={`baslik-${mevcut?.id ?? "yeni"}`}>
                  Başlık *
                </label>
                <input
                  id={`baslik-${mevcut?.id ?? "yeni"}`}
                  name="baslik"
                  required
                  defaultValue={mevcut?.baslik}
                  className="input"
                  placeholder="ör. 2026 danışmanlık anlaşması"
                />
              </div>

              {sabitFirmaId ? (
                <input type="hidden" name="firmaId" value={sabitFirmaId} />
              ) : (
                <div>
                  <label className="label" htmlFor={`firma-${mevcut?.id ?? "yeni"}`}>
                    Firma *
                  </label>
                  <select
                    id={`firma-${mevcut?.id ?? "yeni"}`}
                    name="firmaId"
                    required
                    value={firmaSecim}
                    onChange={(e) => setFirmaSecim(e.target.value)}
                    className="input"
                  >
                    <option value="">Seçin…</option>
                    {/* Yeni firmayı akışı bırakmadan açmak (Faz 13 / H6).
                        Yalnızca YENİ fırsatta sunulur: var olan bir fırsatı
                        düzenlerken firmayı değiştirmek zaten ayrı bir karar. */}
                    {yeniFirmaAcilabilir && !duzenleme && (
                      <option value={YENI_FIRMA}>+ Yeni firma ekle…</option>
                    )}
                    {(firmalar ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {firmaSecim === YENI_FIRMA && (
                <div>
                  <label className="label" htmlFor="yeniFirmaAd">
                    Yeni Firma Adı *
                  </label>
                  <input
                    id="yeniFirmaAd"
                    name="yeniFirmaAd"
                    required
                    className="input"
                    placeholder="ör. Akdeniz Tekstil A.Ş."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Firma kaydı açılır ve sıradaki firma numarasını alır.
                  </p>
                </div>
              )}

              {kisiler && (
                <div>
                  <label className="label" htmlFor={`kisi-${mevcut?.id ?? "yeni"}`}>
                    Kişi
                  </label>
                  <select
                    id={`kisi-${mevcut?.id ?? "yeni"}`}
                    name="kisiId"
                    defaultValue={mevcut?.kisiId ?? ""}
                    className="input"
                  >
                    <option value="">—</option>
                    {kisiler.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor={`asama-${mevcut?.id ?? "yeni"}`}>
                  Aşama *
                </label>
                <select
                  id={`asama-${mevcut?.id ?? "yeni"}`}
                  name="asamaId"
                  required
                  value={asamaId}
                  onChange={(e) => {
                    setAsamaId(e.target.value);
                    // Aşamanın varsayılan olasılığı öneri olarak kopyalanır;
                    // kullanıcı isterse elle değiştirir.
                    const a = asamalar.find((x) => x.id === e.target.value);
                    if (a) setOlasilik(a.olasilik);
                  }}
                  className="input"
                >
                  {asamalar.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`sorumlu-${mevcut?.id ?? "yeni"}`}>
                  Sorumlu
                </label>
                <select
                  id={`sorumlu-${mevcut?.id ?? "yeni"}`}
                  name="sorumluId"
                  defaultValue={mevcut?.sorumluId ?? ""}
                  className="input"
                >
                  <option value="">—</option>
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`tutar-${mevcut?.id ?? "yeni"}`}>
                  Tutar
                </label>
                <input
                  id={`tutar-${mevcut?.id ?? "yeni"}`}
                  name="tutar"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={mevcut?.tutar ?? 0}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`pb-${mevcut?.id ?? "yeni"}`}>
                  Para Birimi
                </label>
                <select
                  id={`pb-${mevcut?.id ?? "yeni"}`}
                  name="paraBirimi"
                  defaultValue={mevcut?.paraBirimi ?? "TRY"}
                  className="input"
                >
                  {PARA_BIRIMI.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor={`olasilik-${mevcut?.id ?? "yeni"}`}>
                  Olasılık (%)
                </label>
                <input
                  id={`olasilik-${mevcut?.id ?? "yeni"}`}
                  name="olasilik"
                  type="number"
                  min={0}
                  max={100}
                  value={olasilik}
                  onChange={(e) => setOlasilik(Number(e.target.value))}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`kapanis-${mevcut?.id ?? "yeni"}`}>
                  Tahmini Kapanış
                </label>
                <input
                  id={`kapanis-${mevcut?.id ?? "yeni"}`}
                  name="kapanisTarihi"
                  type="date"
                  defaultValue={mevcut?.kapanisTarihi}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor={`durum-${mevcut?.id ?? "yeni"}`}>
                  Durum
                </label>
                <select
                  id={`durum-${mevcut?.id ?? "yeni"}`}
                  name="durum"
                  value={durum}
                  onChange={(e) => setDurum(e.target.value)}
                  className="input"
                >
                  {FIRSAT_DURUM.map((d) => (
                    <option key={d} value={d}>
                      {durumBadge(d).label}
                    </option>
                  ))}
                </select>
              </div>

              {durum === "kaybedildi" && (
                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`sebep-${mevcut?.id ?? "yeni"}`}>
                    Kayıp Sebebi
                  </label>
                  <input
                    id={`sebep-${mevcut?.id ?? "yeni"}`}
                    name="kapanisSebebi"
                    defaultValue={mevcut?.kapanisSebebi}
                    className="input"
                    placeholder="ör. fiyat, rakip, bütçe iptal"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="label" htmlFor={`aciklama-${mevcut?.id ?? "yeni"}`}>
                  Açıklama
                </label>
                <textarea
                  id={`aciklama-${mevcut?.id ?? "yeni"}`}
                  name="aciklama"
                  rows={3}
                  defaultValue={mevcut?.aciklama}
                  className="input"
                />
              </div>

              {/* Kiracıya özel alanlar (Faz 11 / E6) */}
              <OzelAlanGirdileri alanlar={ozelAlanlar} degerler={ozelDegerler} />

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
