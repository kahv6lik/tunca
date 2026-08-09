"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { aiAyarKaydet } from "@/app/(app)/ai/actions";

/**
 * AI açma/kapama paneli — Faz 21.
 *
 * Kapatma HER AN mümkündür ve tek tıktır: veriyi dışarı açan bir kararın
 * geri alınması, alınmasından kolay olmalıdır.
 *
 * Anahtar yoksa düğme yine çalışır ama durum "hazır değil" der — kiracı
 * kararını şimdi verip sunucu yöneticisinin anahtarı eklemesini bekleyebilir.
 */
export default function AiAyarPanel({
  acik,
  yonetebilir,
  anahtarVar,
  model,
  calisiyor,
}: {
  acik: boolean;
  yonetebilir: boolean;
  anahtarVar: boolean;
  model: string;
  calisiyor: boolean;
}) {
  const [durum, setDurum] = useState(acik);
  const [bekliyor, basla] = useTransition();

  function degistir(yeni: boolean) {
    setDurum(yeni);
    basla(async () => {
      await aiAyarKaydet(yeni);
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Dil modeli özellikleri
        </p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Firma özetini paragraf hâline getirme ve doğal dilde sorgu, bir dil
          modeline istek gönderir. Kapalıyken bu iki özellik çalışmaz; skorlama
          ve kural tabanlı sorgu çalışmaya devam eder.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Durum:{" "}
          {calisiyor ? (
            <span className="text-emerald-400">çalışıyor · {model}</span>
          ) : !anahtarVar ? (
            <span className="text-amber-400">
              sağlayıcı anahtarı tanımlı değil
            </span>
          ) : (
            <span className="text-muted-foreground">kapalı</span>
          )}
        </p>
      </div>

      {yonetebilir ? (
        <button
          onClick={() => degistir(!durum)}
          disabled={bekliyor}
          className={durum ? "btn-secondary" : "btn-primary"}
        >
          {bekliyor ? "Kaydediliyor…" : durum ? "Kapat" : "Aç"}
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">
          Bu ayarı yalnızca kuruluş yöneticisi değiştirebilir.
        </span>
      )}
    </div>
  );
}
