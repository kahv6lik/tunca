"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Paperclip, Camera, Download, FileText, ImageIcon } from "lucide-react";
import { ekYukle, ekSil, type FormState } from "@/app/(app)/dosya-actions";
import {
  AZAMI_DOSYA_BAYT,
  KABUL_EDILEN,
  boyutMetni,
  turBul,
} from "@/lib/dosya-tanimlar";
import DeleteButton from "@/components/DeleteButton";

export type EkOzeti = {
  id: string;
  ad: string;
  mimeTuru: string;
  boyut: number;
  yukleyen: string | null;
  tarih: string;
};

export type EkBagi = {
  firmaId?: string;
  aktiviteId?: string;
  destekId?: string;
  siparisId?: string;
  teklifId?: string;
};

/**
 * Dosya ekleri paneli (Faz 17 / A1, A2).
 *
 * Aynı bileşen firma, aktivite, destek kaydı, sipariş ve teklif ekranlarında
 * kullanılır — ek kuralı her yerde aynı olduğu için arayüzü de tek yerde
 * tutmak, "bir ekranda 10 MB, ötekinde sınırsız" gibi tutarsızlıkları
 * imkânsız kılar.
 *
 * FOTOĞRAF ÇEKME ayrı bir girdidir (`capture="environment"`): mobil tarayıcı
 * doğrudan arka kamerayı açar. Masaüstünde bu girdi dosya seçiciye düşer,
 * bu yüzden ikinci bir "dosya seç" düğmesi de durur.
 */
export default function EkPaneli({
  bag,
  ekler,
  yukleyebilir,
  silebilir,
}: {
  bag: EkBagi;
  ekler: EkOzeti[];
  yukleyebilir: boolean;
  silebilir: boolean;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(ekYukle, {});
  const form = useRef<HTMLFormElement>(null);
  const [yerelHata, setYerelHata] = useState<string | null>(null);

  /**
   * Boyut istemcide de bakılır — yalnızca kibarlık olsun diye: 10 MB'lık bir
   * dosyayı sunucuya gönderip reddedilmesini beklemek, sahada mobil veriyle
   * çalışan kullanıcıyı boşuna bekletir. ASIL kontrol sunucudadır.
   */
  function secildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    setYerelHata(null);
    if (!dosya) return;
    if (dosya.size > AZAMI_DOSYA_BAYT) {
      setYerelHata(
        `Dosya çok büyük (${boyutMetni(dosya.size)}). Üst sınır ${boyutMetni(AZAMI_DOSYA_BAYT)}.`
      );
      e.target.value = "";
      return;
    }
    form.current?.requestSubmit();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Paperclip className="h-4 w-4" /> Ekler ({ekler.length})
        </h3>

        {yukleyebilir && (
          <form ref={form} action={formAction} className="flex items-center gap-2">
            {Object.entries(bag).map(([alan, deger]) =>
              deger ? <input key={alan} type="hidden" name={alan} value={deger} /> : null
            )}

            <label className="btn-secondary h-8 cursor-pointer px-2.5 text-xs">
              <Camera className="h-3.5 w-3.5" /> Fotoğraf
              <input
                type="file"
                name="dosya"
                accept="image/*"
                capture="environment"
                onChange={secildi}
                className="hidden"
              />
            </label>

            <label className="btn-secondary h-8 cursor-pointer px-2.5 text-xs">
              <Paperclip className="h-3.5 w-3.5" /> Dosya
              <input
                type="file"
                name="dosya"
                accept={KABUL_EDILEN}
                onChange={secildi}
                className="hidden"
              />
            </label>

            <Durum />
          </form>
        )}
      </div>

      {(yerelHata || state.error) && (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {yerelHata ?? state.error}
        </p>
      )}

      {ekler.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Henüz ek yok. Görsel, PDF, Office belgesi ya da metin dosyası
          eklenebilir (en fazla {boyutMetni(AZAMI_DOSYA_BAYT)}).
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ekler.map((e) => {
            const gorsel = turBul(e.mimeTuru)?.gorsel ?? false;
            const adres = `/api/dosya?id=${e.id}`;
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 p-2"
              >
                {gorsel ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={adres}
                    alt={e.ad}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <a
                    href={adres}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {e.ad}
                  </a>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {boyutMetni(e.boyut)} · {e.tarih}
                    {e.yukleyen ? ` · ${e.yukleyen}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={adres}
                    download
                    aria-label={`${e.ad} indir`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {silebilir && (
                    <DeleteButton
                      action={ekSil.bind(null, e.id)}
                      label="Sil"
                      confirmText={`"${e.ad}" silinecek. Bu işlem geri alınamaz.`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Durum() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ImageIcon className="h-3.5 w-3.5 animate-pulse" /> Yükleniyor…
    </span>
  );
}
