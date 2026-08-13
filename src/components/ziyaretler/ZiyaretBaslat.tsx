"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MapPin, Play } from "lucide-react";
import { ziyaretBaslat, type FormState } from "@/app/(app)/ziyaretler/actions";

/**
 * Ziyaret başlatma (Faz 17 / A4, A5).
 *
 * KONUM AYRI BİR DÜĞME DEĞİL, BAŞLATMANIN PARÇASIDIR (v1.26.1).
 *
 * ORTAĞIN BULGUSU: "Ziyarete başla dediğimizde konum alsın, ayrıca 'konum al'
 * basmasın." Eskiden iki adım vardı ve ikisi de zorunlu değildi: "Konumumu
 * al"a basmadan "Ziyareti Başlat"a basan kullanıcı ziyareti KONUMSUZ açıyor,
 * kayıt sessizce "doğrulanamadı" oluyordu. Sahada en kolay unutulan adım,
 * doğrulamanın dayandığı tek veriydi.
 *
 * Artık tek düğme var: basıldığında önce konum istenir, sonra form
 * gönderilir. Konum GÖNDERİMDEN ÖNCE tarayıcıdan alınır ve gizli alanlara
 * yazılır; doğrulama sunucuda yapılır — istemcinin "yerindeyim" demesi tek
 * başına kanıt olamaz, ama koordinatı ancak tarayıcı verebilir.
 *
 * İZİN REDDEDİLİRSE ya da konum gelmezse ziyaret YİNE AÇILIR, "konum
 * doğrulanamadı" (sarı) olarak işaretlenir. Teknik bir aksaklık, personeli
 * işini yapamaz hâle getirmemelidir (karar 4, v1.17.0).
 *
 * KONUM YALNIZCA BAŞLANGIÇTA ALINIR. Ziyaret bitince hiçbir şey sorulmaz ve
 * arka planda hiçbir dinleyici kalmaz — sürekli takip YOKTUR. Bu, KVKK
 * aydınlatma metninin (v1.12.2) verdiği sözdür ve uygulamayı bağlar.
 */
export default function ZiyaretBaslat({
  firmalar,
  sabitFirmaId,
}: {
  firmalar: { id: string; ad: string }[];
  sabitFirmaId?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(ziyaretBaslat, {});
  const [durum, setDurum] = useState<string | null>(null);
  const [aliniyor, setAliniyor] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const enlemRef = useRef<HTMLInputElement>(null);
  const boylamRef = useRef<HTMLInputElement>(null);

  /**
   * Konumu bir kez ister; başarısız olursa boş döner — HATA FIRLATMAZ.
   *
   * Değerler React durumuna değil doğrudan gizli alanlara yazılır: durum
   * güncellemesinin çizime yansımasını beklemeden formu göndermek
   * gerekiyor, aradaki bir çizim turunda gönderim eski değerle giderdi.
   */
  function konumIste(): Promise<void> {
    return new Promise((bitir) => {
      if (!navigator.geolocation) {
        setDurum("Tarayıcı konum servisini desteklemiyor; ziyaret konumsuz açılıyor.");
        bitir();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (k) => {
          if (enlemRef.current) enlemRef.current.value = k.coords.latitude.toFixed(6);
          if (boylamRef.current) boylamRef.current.value = k.coords.longitude.toFixed(6);
          setDurum(`Konum alındı (±${Math.round(k.coords.accuracy)} m).`);
          bitir();
        },
        () => {
          setDurum("Konum alınamadı; ziyaret 'doğrulanamadı' olarak açılıyor.");
          bitir();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function baslat() {
    if (aliniyor) return;
    // Firma seçilmeden konum istemek gereksiz bir izin sorusu olurdu.
    if (!formRef.current?.reportValidity()) return;

    setAliniyor(true);
    setDurum("Konum alınıyor…");
    await konumIste();
    setAliniyor(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
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

      {/* Denetimsiz: değerler `konumIste` tarafından doğrudan yazılır. */}
      <input ref={enlemRef} type="hidden" name="enlem" defaultValue="" />
      <input ref={boylamRef} type="hidden" name="boylam" defaultValue="" />

      <Baslat onBaslat={baslat} aliniyor={aliniyor} />

      <p className="w-full text-xs text-muted-foreground">
        <MapPin className="mr-1 inline h-3 w-3" />
        Konum yalnızca ziyaret başlarken bir kez alınır; ziyaret boyunca takip
        edilmez.
      </p>

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

/**
 * Tek düğme: konumu alır, sonra formu gönderir.
 *
 * `type="button"`dır — tarayıcının kendi gönderimi konumu beklemeden
 * çalışırdı. Gönderim `requestSubmit()` ile, konum geldikten SONRA yapılır.
 */
function Baslat({
  onBaslat,
  aliniyor,
}: {
  onBaslat: () => void;
  aliniyor: boolean;
}) {
  const { pending } = useFormStatus();
  const mesgul = pending || aliniyor;
  return (
    <button
      type="button"
      onClick={onBaslat}
      className="btn-primary"
      disabled={mesgul}
    >
      <Play className="h-4 w-4" />
      {aliniyor ? "Konum alınıyor…" : pending ? "Başlatılıyor…" : "Ziyareti Başlat"}
    </button>
  );
}
