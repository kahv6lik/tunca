"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X, ExternalLink } from "lucide-react";
import ModalKatman from "@/components/ui/ModalKatman";
import CamKatmanlari from "@/components/ui/CamKatmanlari";
import { StatusBadge } from "@/components/ui/badge";
import {
  PANEL_ANAHTARI,
  aramaTuru,
  panelCoz,
  type OzetYanit,
} from "@/lib/arama-tanimlar";

/**
 * Yan panel — Faz 20 / U2.
 *
 * Ortağın bulgusu: "bir kaydın ne olduğunu görmek için sayfadan çıkmak, sonra
 * geri dönüp yerimi yeniden bulmak gerekiyor." Panel listenin ÜSTÜNE açılır;
 * liste, süzgeçleri ve kaydırma konumu olduğu yerde kalır.
 *
 * Panel ÖZET gösterir, tam detayın yerini almaz — her zaman "Tam sayfada aç"
 * bağlantısı taşır. Düzenleme paneldeN yapılmaz (satır içi düzenleme bu fazın
 * kapsamı DIŞIDIR); panel bakmak içindir.
 *
 * Açık olup olmadığı URL'de yaşar (`?panel=firma:<id>`): sayfa yenilenince
 * panel açık kalır, bağlantı paylaşılabilir ve geri tuşu paneli kapatır.
 */
export default function YanPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const parametreler = useSearchParams();
  const hedef = panelCoz(parametreler.get(PANEL_ANAHTARI));

  const [veri, setVeri] = useState<OzetYanit | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const anahtar = hedef ? `${hedef.tur}:${hedef.id}` : null;

  useEffect(() => {
    if (!anahtar) {
      setVeri(null);
      setHata(null);
      return;
    }
    const [tur, ...kalan] = anahtar.split(":");
    const id = kalan.join(":");
    let iptal = false;
    setVeri(null);
    setHata(null);

    (async () => {
      try {
        const yanit = await fetch(
          `/api/ozet?tur=${encodeURIComponent(tur)}&id=${encodeURIComponent(id)}`
        );
        if (!yanit.ok) {
          if (!iptal) {
            setHata(
              yanit.status === 403
                ? "Bu kaydı görüntüleme yetkiniz yok."
                : "Kayıt bulunamadı."
            );
          }
          return;
        }
        const gelen = (await yanit.json()) as OzetYanit;
        if (!iptal) setVeri(gelen);
      } catch {
        if (!iptal) setHata("Özet alınamadı.");
      }
    })();

    return () => {
      iptal = true;
    };
  }, [anahtar]);

  function kapat() {
    const yeni = new URLSearchParams(parametreler.toString());
    yeni.delete(PANEL_ANAHTARI);
    const sorgu = yeni.toString();
    // `replace`: panel açmak geçmişe bir adım eklemişti, kapatmak yenisini
    // eklemesin — kullanıcı geri tuşuyla paneli tekrar tekrar açmasın.
    router.replace(sorgu ? `${pathname}?${sorgu}` : pathname, { scroll: false });
  }

  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape" && hedef) kapat();
    }
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  });

  if (!hedef) return null;
  const tanim = aramaTuru(hedef.tur);

  return (
    <ModalKatman
      className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm"
      onClick={kapat}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        aria-label="Kayıt özeti"
        className="cam h-full w-full max-w-md overflow-y-auto border-l border-border/40 p-5"
      >
        <CamKatmanlari />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tanim?.etiket ?? "Kayıt"}
            </p>
            <h2 className="mt-0.5 break-words text-lg font-semibold text-foreground">
              {veri?.baslik ?? "Yükleniyor…"}
            </h2>
            {veri?.durum && (
              <div className="mt-2">
                <StatusBadge durum={veri.durum} />
              </div>
            )}
          </div>
          <button
            onClick={kapat}
            aria-label="Paneli kapat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hata ? (
          <p className="mt-6 text-sm text-muted-foreground">{hata}</p>
        ) : !veri ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            <dl className="mt-5 divide-y divide-border/50 border-y border-border/50">
              {veri.satirlar.map((s) => (
                <div
                  key={s.etiket}
                  className="flex items-start justify-between gap-4 py-2.5"
                >
                  <dt className="shrink-0 text-xs text-muted-foreground">
                    {s.etiket}
                  </dt>
                  <dd className="min-w-0 break-words text-right text-sm text-foreground">
                    {s.deger}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              href={veri.rota}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" />
              Tam sayfada aç
            </Link>
          </>
        )}
      </aside>
    </ModalKatman>
  );
}
