"use client";

import { useState, useTransition } from "react";
import { Eye, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import {
  kiraciDurumDegistir,
  kiraciSil,
  kiraciOlarakGoruntule,
} from "@/app/admin/actions";

/** "Kiracı olarak görüntüle" düğmesi (B5). */
export function ImpersonateDugmesi({
  tenantId,
  kiraciAd,
}: {
  tenantId: string;
  kiraciAd: string;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        if (
          !confirm(
            `"${kiraciAd}" kuruluşunu bu kuruluşun yöneticisi olarak görüntüleyeceksiniz.\n\n` +
              `Yapacağınız her işlem denetim günlüğüne SİZİN adınıza yazılır. Devam edilsin mi?`
          )
        )
          return;
        basla(async () => {
          await kiraciOlarakGoruntule(tenantId);
        });
      }}
      className="btn-secondary"
    >
      <Eye className="h-4 w-4" />
      {bekliyor ? "Geçiliyor…" : "Kiracı olarak görüntüle"}
    </button>
  );
}

/** Askıya alma / yeniden açma (B1). */
export function DurumDugmesi({
  tenantId,
  durum,
}: {
  tenantId: string;
  durum: string;
}) {
  const [bekliyor, basla] = useTransition();
  const aktif = durum === "aktif";

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() =>
        basla(async () => {
          await kiraciDurumDegistir(tenantId, aktif ? "askida" : "aktif");
        })
      }
      className="btn-secondary"
    >
      {aktif ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
      {aktif ? "Askıya al" : "Yeniden aç"}
    </button>
  );
}

/**
 * Kuruluşu ve tüm verisini silme (B1).
 *
 * Onay için kuruluş adının birebir yazılması gerekir; sunucu tarafı da aynı
 * kontrolü yineler — arayüzdeki onay kutusu tek başına koruma değildir.
 */
export function KiraciSilPaneli({
  tenantId,
  kiraciAd,
  kayitSayisi,
}: {
  tenantId: string;
  kiraciAd: string;
  kayitSayisi: number;
}) {
  const [ad, setAd] = useState("");
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  return (
    <div className="card border-rose-500/30 p-5">
      <h2 className="mb-1 font-semibold text-rose-400">Kuruluşu Sil</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Bu kuruluşa ait <strong>{kayitSayisi}</strong> kayıt (kullanıcılar, firmalar,
        yatırım destekleri, eğitimler, hizmetler, gruplar ve denetim günlüğü) kalıcı
        olarak silinir. Geri dönüşü yoktur. Onaylamak için kuruluş adını yazın:{" "}
        <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">{kiraciAd}</code>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder={kiraciAd}
          className="input max-w-xs"
        />
        <button
          type="button"
          disabled={bekliyor || ad !== kiraciAd}
          onClick={() =>
            basla(async () => {
              try {
                await kiraciSil(tenantId, ad);
              } catch (e) {
                // redirect() de bir hata fırlatır; onu yutmuyoruz.
                if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
                setHata(e instanceof Error ? e.message : "Silinemedi.");
              }
            })
          }
          className="btn-danger"
        >
          <Trash2 className="h-4 w-4" />
          {bekliyor ? "Siliniyor…" : "Kalıcı olarak sil"}
        </button>
      </div>
      {hata && <p className="mt-2 text-sm text-rose-400">{hata}</p>}
    </div>
  );
}
