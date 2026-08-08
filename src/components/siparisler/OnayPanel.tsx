"use client";

import ModalKatman from "@/components/ui/ModalKatman";
import { useState, useTransition } from "react";
import { Check, X, Ban } from "lucide-react";
import {
  siparisOnayla,
  siparisReddet,
  siparisIptal,
} from "@/app/(app)/siparisler/actions";

/**
 * Onay / ret / iptal paneli — Faz 15 / S3.
 *
 * Ret GEREKÇE İSTER: "reddedildi" tek başına satış personeline hiçbir şey
 * anlatmaz ve aynı sipariş aynı hatayla yeniden gelir.
 *
 * Hatalar (stok yetersiz, kota bitti) sunucudan gelir ve burada AYNEN
 * gösterilir — kullanıcı neyin eksik olduğunu kalem kalem görmelidir.
 */
export default function OnayPanel({
  siparisId,
  durum,
}: {
  siparisId: string;
  durum: string;
}) {
  const [redAcik, setRedAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function onayla() {
    setHata(null);
    basla(async () => {
      try {
        await siparisOnayla(siparisId);
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Onay verilemedi.");
      }
    });
  }

  function iptal() {
    if (!confirm("Sipariş iptal edilecek; düşülen stok ve kota iade edilir. Onaylıyor musunuz?")) {
      return;
    }
    setHata(null);
    basla(async () => {
      try {
        await siparisIptal(siparisId);
      } catch (e) {
        setHata(e instanceof Error ? e.message : "İptal edilemedi.");
      }
    });
  }

  const onaylanabilir = durum === "onaybekliyor" || durum === "taslak" || durum === "reddedildi";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {onaylanabilir && (
          <>
            <button onClick={onayla} disabled={bekliyor} className="btn-primary">
              <Check className="h-4 w-4" /> {bekliyor ? "İşleniyor…" : "Onayla"}
            </button>
            <button
              onClick={() => setRedAcik(true)}
              disabled={bekliyor}
              className="btn-secondary"
            >
              <X className="h-4 w-4" /> Reddet
            </button>
          </>
        )}
        {durum === "onaylandi" && (
          <button onClick={iptal} disabled={bekliyor} className="btn-secondary">
            <Ban className="h-4 w-4" /> Siparişi İptal Et
          </button>
        )}
      </div>

      {hata && (
        <p className="max-w-md whitespace-pre-line rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {hata}
        </p>
      )}

      {redAcik && (
        <ModalKatman
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setRedAcik(false)}
        >
          <div className="card my-16 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Siparişi Reddet</h2>
            <form action={siparisReddet.bind(null, siparisId)} className="grid gap-4">
              <div>
                <label className="label" htmlFor="redSebebi">Gerekçe *</label>
                <textarea
                  id="redSebebi"
                  name="redSebebi"
                  rows={3}
                  required
                  className="input"
                  placeholder="ör. iskonto yetkisi aşıldı, müşteri limiti dolu"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Gerekçe siparişi girene bildirim olarak gider.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRedAcik(false)} className="btn-secondary">
                  Vazgeç
                </button>
                <button type="submit" className="btn-primary">Reddet</button>
              </div>
            </form>
          </div>
        </ModalKatman>
      )}
    </div>
  );
}
