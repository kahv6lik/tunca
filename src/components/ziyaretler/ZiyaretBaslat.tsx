"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MapPin, Play } from "lucide-react";
import { ziyaretBaslat, type FormState } from "@/app/(app)/ziyaretler/actions";

/**
 * Ziyaret başlatma (Faz 17 / A4, A5).
 *
 * Konum GÖNDERİMDEN ÖNCE, tarayıcıdan alınır ve gizli alanlara yazılır;
 * doğrulama sunucuda yapılır — istemcinin "yerindeyim" demesi tek başına
 * kanıt olamaz, ama koordinatı ancak tarayıcı verebilir.
 *
 * İZİN REDDEDİLİRSE ziyaret YİNE AÇILIR, "konum doğrulanamadı" (sarı) olarak
 * işaretlenir. Teknik bir aksaklık, personeli işini yapamaz hâle
 * getirmemelidir (karar 4, v1.17.0).
 */
export default function ZiyaretBaslat({
  firmalar,
  sabitFirmaId,
}: {
  firmalar: { id: string; ad: string }[];
  sabitFirmaId?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(ziyaretBaslat, {});
  const [konum, setKonum] = useState<{ enlem: string; boylam: string } | null>(null);
  const [durum, setDurum] = useState<string | null>(null);
  const [aliniyor, setAliniyor] = useState(false);

  function konumAl() {
    if (!navigator.geolocation) {
      setDurum("Tarayıcı konum servisini desteklemiyor; ziyaret konumsuz açılacak.");
      return;
    }
    setAliniyor(true);
    setDurum("Konum alınıyor…");
    navigator.geolocation.getCurrentPosition(
      (k) => {
        setKonum({
          enlem: k.coords.latitude.toFixed(6),
          boylam: k.coords.longitude.toFixed(6),
        });
        setDurum(`Konum alındı (±${Math.round(k.coords.accuracy)} m).`);
        setAliniyor(false);
      },
      () => {
        setDurum("Konum alınamadı; ziyaret 'doğrulanamadı' olarak açılacak.");
        setAliniyor(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {sabitFirmaId ? (
        <input type="hidden" name="firmaId" value={sabitFirmaId} />
      ) : (
        <div className="min-w-[220px]">
          <label className="label" htmlFor="zfirma">Firma</label>
          <select id="zfirma" name="firmaId" required className="input">
            <option value="">Seçin…</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>
      )}

      <input type="hidden" name="enlem" value={konum?.enlem ?? ""} />
      <input type="hidden" name="boylam" value={konum?.boylam ?? ""} />

      <button
        type="button"
        onClick={konumAl}
        disabled={aliniyor}
        className="btn-secondary"
      >
        <MapPin className="h-4 w-4" /> {konum ? "Konumu yenile" : "Konumumu al"}
      </button>

      <Baslat />

      {(durum || state.error) && (
        <p
          className={`w-full text-xs ${
            state.error ? "text-rose-400" : "text-muted-foreground"
          }`}
        >
          {state.error ?? durum}
        </p>
      )}
    </form>
  );
}

function Baslat() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Play className="h-4 w-4" /> {pending ? "Başlatılıyor…" : "Ziyareti Başlat"}
    </button>
  );
}
