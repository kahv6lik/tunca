"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, X, ClipboardCheck } from "lucide-react";
import { hareketEkle, sayimKaydet, type FormState } from "@/app/(app)/stok/actions";
import { STOK_HAREKET_TUR } from "@/lib/constants";

type UrunSecenek = { id: string; kod: string; ad: string; birim: string; stokMiktar: number };

/**
 * Stok hareketi / sayım paneli (Faz 14 / T7).
 *
 * Kullanıcı her zaman POZİTİF miktar girer; işaretin kararı sunucudaki tür
 * tanımına aittir (`isaretliMiktar`). Kullanıcıya eksi sayı yazdırmak, en
 * sık yapılan veri giriş hatalarından biridir.
 */
export default function StokPanel({
  urunler,
  sayim = false,
  sabitUrunId,
}: {
  urunler: UrunSecenek[];
  sayim?: boolean;
  sabitUrunId?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [state, formAction] = useFormState<FormState, FormData>(
    sayim ? sayimKaydet : hareketEkle,
    {}
  );
  const [urunId, setUrunId] = useState(sabitUrunId ?? "");

  if (state.ok && acik) setTimeout(() => setAcik(false), 0);

  const secili = urunler.find((u) => u.id === urunId);

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className={sayim ? "btn-secondary" : "btn-primary"}
      >
        {sayim ? (
          <>
            <ClipboardCheck className="h-4 w-4" /> Sayım Gir
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Stok Hareketi
          </>
        )}
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div className="card my-8 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {sayim ? "Stok Sayımı" : "Stok Hareketi"}
              </h2>
              <button
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4">
              <div>
                <label className="label" htmlFor="stok-urun">Ürün *</label>
                <select
                  id="stok-urun"
                  name="urunId"
                  required
                  value={urunId}
                  onChange={(e) => setUrunId(e.target.value)}
                  className="input"
                >
                  <option value="">Seçin…</option>
                  {urunler.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kod} — {u.ad} ({u.stokMiktar} {u.birim})
                    </option>
                  ))}
                </select>
                {secili && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mevcut bakiye: {secili.stokMiktar} {secili.birim}
                  </p>
                )}
              </div>

              {sayim ? (
                <div>
                  <label className="label" htmlFor="stok-sayilan">Sayılan Miktar *</label>
                  <input
                    id="stok-sayilan"
                    name="sayilanMiktar"
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    className="input"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fark kadar düzeltme hareketi yazılır; bakiye doğrudan
                    değiştirilmez — sayım farkı kayda geçer.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label" htmlFor="stok-tur">Hareket Türü *</label>
                    <select id="stok-tur" name="tur" required className="input" defaultValue="giris">
                      {STOK_HAREKET_TUR.filter((t) => t.deger !== "sayim").map((t) => (
                        <option key={t.deger} value={t.deger}>{t.etiket}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="stok-miktar">Miktar *</label>
                    <input
                      id="stok-miktar"
                      name="miktar"
                      type="number"
                      step="0.01"
                      required
                      className="input"
                      placeholder="Pozitif sayı girin"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Yönü tür belirler; eksi yazmanıza gerek yok.
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="stok-referans">Referans</label>
                    <input
                      id="stok-referans"
                      name="referans"
                      className="input"
                      placeholder="ör. irsaliye no"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="label" htmlFor="stok-aciklama">Açıklama</label>
                <input id="stok-aciklama" name="aciklama" className="input" />
              </div>

              {state.error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
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
      {pending ? "İşleniyor…" : "Kaydet"}
    </button>
  );
}
