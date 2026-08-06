"use client";

import { useTransition } from "react";
import { Copy, Send, Check, XCircle, Trash2 } from "lucide-react";
import {
  teklifDurumDegistir,
  teklifRevizeEt,
  teklifSil,
} from "@/app/(app)/teklifler/actions";

/**
 * Teklif detayındaki işlem düğmeleri (Faz 7 / C7).
 *
 * "Revize et" mevcut sürümü dondurup kalemleriyle birlikte yeni bir taslak
 * açar — bu yüzden onay istenir; geri alınabilir bir işlem değildir.
 */
export default function TeklifIslemleri({
  id,
  no,
  durum,
  duzenleyebilir,
  olusturabilir,
  silebilir,
}: {
  id: string;
  no: string;
  durum: string;
  duzenleyebilir: boolean;
  olusturabilir: boolean;
  silebilir: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const dondurulmus = durum === "revizyon";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {duzenleyebilir && !dondurulmus && durum !== "gonderildi" && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => basla(async () => void (await teklifDurumDegistir(id, "gonderildi")))}
          className="btn-secondary h-9 px-3 text-sm"
        >
          <Send className="h-4 w-4" /> Gönderildi
        </button>
      )}

      {duzenleyebilir && durum === "gonderildi" && (
        <>
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => basla(async () => void (await teklifDurumDegistir(id, "kabul")))}
            className="btn-secondary h-9 border-emerald-500/40 px-3 text-sm text-emerald-500"
          >
            <Check className="h-4 w-4" /> Kabul
          </button>
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => basla(async () => void (await teklifDurumDegistir(id, "red")))}
            className="btn-secondary h-9 px-3 text-sm"
          >
            <XCircle className="h-4 w-4" /> Red
          </button>
        </>
      )}

      {olusturabilir && !dondurulmus && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => {
            if (
              !confirm(
                `${no} revize edilecek.\n\nMevcut sürüm değiştirilemez hâle gelir ve ` +
                  `kalemleriyle birlikte yeni bir taslak açılır. Devam edilsin mi?`
              )
            )
              return;
            basla(async () => void (await teklifRevizeEt(id)));
          }}
          className="btn-secondary h-9 px-3 text-sm"
        >
          <Copy className="h-4 w-4" /> Revize Et
        </button>
      )}

      {silebilir && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => {
            if (!confirm(`${no} numaralı teklif kalıcı olarak silinsin mi?`)) return;
            basla(async () => void (await teklifSil(id)));
          }}
          aria-label="Teklifi sil"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
