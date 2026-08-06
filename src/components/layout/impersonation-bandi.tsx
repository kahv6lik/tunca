"use client";

import { useTransition } from "react";
import { Eye, LogOut } from "lucide-react";
import { impersonationBitir } from "@/app/admin/actions";

/**
 * Impersonation uyarı bandı (Faz 5 / B5).
 *
 * Platform yöneticisi bir müşterinin bağlamındayken bu bant her sayfada,
 * en üstte, kapatılamaz biçimde durur. Kimin adına bakıldığının bir an bile
 * belirsiz kalmaması içindir — bu bağlamda yapılan her işlem denetim
 * günlüğüne gerçek yönetici kimliğiyle yazılır.
 */
export function ImpersonationBandi({
  kiraciAd,
  yoneticiEmail,
}: {
  kiraciAd: string;
  yoneticiEmail: string;
}) {
  const [bekliyor, basla] = useTransition();

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200 backdrop-blur-xl md:px-6">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        <strong>{kiraciAd}</strong> kuruluşunu görüntülüyorsunuz ({yoneticiEmail}).
        Yaptığınız her işlem denetim günlüğüne sizin adınıza yazılır.
      </span>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            await impersonationBitir();
          })
        }
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-amber-500/30"
      >
        <LogOut className="h-3.5 w-3.5" />
        {bekliyor ? "Çıkılıyor…" : "Görüntülemeyi bitir"}
      </button>
    </div>
  );
}
