"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ModalKatman from "@/components/ui/ModalKatman";
import CamKatmanlari from "@/components/ui/CamKatmanlari";
import { dogalDildeSorgu } from "@/app/(app)/ai-actions";
import {
  Building2,
  Contact,
  Target,
  FileText,
  ShoppingCart,
  FolderKanban,
  LifeBuoy,
  Search,
  Wand2,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import {
  ARAMA_TURLERI,
  EN_AZ_TERIM,
  HIZLI_EYLEMLER,
  PANEL_ANAHTARI,
  aramaTuru,
  eylemleriSuz,
  panelDegeri,
  type AramaSonucu,
  type HizliEylem,
} from "@/lib/arama-tanimlar";

/**
 * Komut paleti — Faz 20 / U1.
 *
 * Ctrl/Cmd + K ile her yerden açılır. Amacı ortağın bulgusudur: "modellerin
 * içinden gezmemek", yani bir kayda ulaşmak için önce doğru menüyü bulmak
 * zorunda kalmamak.
 *
 * İzin süzgeci SUNUCUDA uygulanır (`/api/arama`); burada gelen sonuç
 * çizilir. Eylem listesi de kullanıcının izinleriyle sunucudan gelir —
 * "yeni sipariş" yazıp yetkisiz bir sayfaya düşmek kötü bir deneyimdir.
 */

const IKONLAR: Record<string, LucideIcon> = {
  firma: Building2,
  kisi: Contact,
  firsat: Target,
  teklif: FileText,
  siparis: ShoppingCart,
  proje: FolderKanban,
  destek: LifeBuoy,
};

export default function KomutPaleti({
  izinler,
  aiAcik = false,
}: {
  izinler: string[];
  /** Faz 21 / G3 — doğal dilde sorgu satırı yalnızca izin varsa gösterilir. */
  aiAcik?: boolean;
}) {
  const router = useRouter();
  const patika = usePathname();
  const parametreler = useSearchParams();
  const [acik, setAcik] = useState(false);
  const [terim, setTerim] = useState("");
  const [sonuclar, setSonuclar] = useState<AramaSonucu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [secili, setSecili] = useState(0);
  const girdi = useRef<HTMLInputElement>(null);
  const [sorguBekliyor, setSorguBekliyor] = useState(false);
  const [sorguHatasi, setSorguHatasi] = useState<string | null>(null);

  const izinKumesi = new Set(izinler);
  const eylemler = eylemleriSuz(
    HIZLI_EYLEMLER.filter((e) => izinKumesi.has(e.izin)),
    terim
  );

  // Ctrl/Cmd + K — her yerden. Girdi alanındayken de çalışır ki kullanıcı
  // "önce tıklamayı bırak" zorunda kalmasın.
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAcik((a) => !a);
      }
      if (e.key === "Escape") setAcik(false);
    }
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, []);

  useEffect(() => {
    if (acik) setTimeout(() => girdi.current?.focus(), 30);
    else {
      setTerim("");
      setSonuclar([]);
      setSecili(0);
      setSorguHatasi(null);
    }
  }, [acik]);

  /**
   * Arama GECİKMELİDİR (250 ms): her tuşta sunucuya gitmek, yedi modülü
   * birden sorgulayan bir uç için gereksiz yük olurdu.
   */
  useEffect(() => {
    if (terim.trim().length < EN_AZ_TERIM) {
      setSonuclar([]);
      return;
    }
    let iptal = false;
    setYukleniyor(true);
    const zamanlayici = setTimeout(async () => {
      try {
        const yanit = await fetch(`/api/arama?q=${encodeURIComponent(terim)}`);
        const veri = (await yanit.json()) as { sonuclar: AramaSonucu[] };
        if (!iptal) setSonuclar(veri.sonuclar ?? []);
      } catch {
        if (!iptal) setSonuclar([]);
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    }, 250);

    return () => {
      iptal = true;
      clearTimeout(zamanlayici);
    };
  }, [terim]);

  /** Bulunduğumuz sayfanın süzgeçleri korunarak panel parametresi eklenir. */
  function panelSorgusu(tur: string, id: string): string {
    const yeni = new URLSearchParams(parametreler.toString());
    yeni.set(PANEL_ANAHTARI, panelDegeri(tur, id));
    return yeni.toString();
  }

  const ogeler: { anahtar: string; adres: string; render: React.ReactNode }[] = [
    ...sonuclar.map((s) => {
      const tur = aramaTuru(s.tur);
      const Ikon = IKONLAR[tur?.ikon ?? ""] ?? Search;
      /*
        Özeti olan türler YAN PANELDE açılır (U2): kullanıcı çoğu zaman
        "bu kayıt neydi" sorusunu yanıtlamak ister, sayfa değiştirmek değil.
        Paneldeki "Tam sayfada aç" bağlantısı diğerini bir tık uzakta tutar.
      */
      const adres = s.panel
        ? `${patika}?${panelSorgusu(s.tur, s.id)}`
        : `${tur?.rota ?? "/"}/${s.id}`;
      return {
        anahtar: `${s.tur}-${s.id}`,
        adres,
        render: (
          <>
            <Ikon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{s.baslik}</span>
              {s.alt && (
                <span className="block truncate text-xs text-muted-foreground">
                  {s.alt}
                </span>
              )}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground/70">
              {tur?.etiket}
            </span>
          </>
        ),
      };
    }),
    ...eylemler.map((e: HizliEylem) => ({
      anahtar: e.anahtar,
      adres: e.rota,
      render: (
        <>
          <CornerDownLeft className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {e.etiket}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground/70">eylem</span>
        </>
      ),
    })),
  ];

  const git = useCallback(
    (adres: string) => {
      setAcik(false);
      router.push(adres);
    },
    [router]
  );

  /**
   * Doğal dilde sorgu (Faz 21 / G3).
   *
   * Palet zaten "ne yapmak istiyorum" kutusudur; cümleyi ayrı bir ekrana
   * taşımak, kullanıcıyı önce doğru yeri bulmaya zorlardı — paletin var
   * oluş sebebinin tersi.
   */
  function sorguCalistir() {
    if (terim.trim().length < 3 || sorguBekliyor) return;
    setSorguBekliyor(true);
    setSorguHatasi(null);
    (async () => {
      const sonuc = await dogalDildeSorgu(terim);
      setSorguBekliyor(false);
      if (sonuc.ok && sonuc.adres) {
        setAcik(false);
        router.push(sonuc.adres);
      } else {
        setSorguHatasi(sonuc.hata ?? "Sorgu anlaşılamadı.");
      }
    })();
  }

  function listeTusu(e: React.KeyboardEvent) {
    if (ogeler.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSecili((s) => (s + 1) % ogeler.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSecili((s) => (s - 1 + ogeler.length) % ogeler.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const oge = ogeler[Math.min(secili, ogeler.length - 1)];
      if (oge) git(oge.adres);
    }
  }

  return (
    <>
      {/*
        Üst çubuktaki tetikleyici — kısayolu bilmeyen kullanıcı da görsün.
        Üst çubuktaki eski (işlevsiz) arama kutusunun yerini alır; bir arama
        kutusu gibi görünmesi bilinçlidir, kullanıcı zaten oraya tıklıyordu.
      */}
      <button
        type="button"
        onClick={() => setAcik(true)}
        aria-label="Ara"
        className="cam relative hidden h-9 w-full max-w-xs flex-1 items-center gap-2 rounded-xl border border-border/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 md:flex"
      >
        <CamKatmanlari />
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Ara…</span>
        <kbd className="ml-auto shrink-0 rounded border border-border/70 px-1 text-[10px] leading-4">
          ⌘K
        </kbd>
      </button>

      {acik && (
        <ModalKatman
          className="fixed inset-0 z-[60] flex items-start justify-center bg-background/80 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setAcik(false)}
        >
          <div
            className="cam w-full max-w-xl overflow-hidden rounded-2xl border border-border/40 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <CamKatmanlari />
            <div className="flex items-center gap-2 border-b border-border/60 px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={girdi}
                value={terim}
                onChange={(e) => {
                  setTerim(e.target.value);
                  setSecili(0);
                }}
                onKeyDown={listeTusu}
                placeholder="Firma, kontak, teklif, sipariş ara ya da bir işlem seç…"
                className="w-full bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {yukleniyor && (
                <span className="shrink-0 text-[11px] text-muted-foreground">…</span>
              )}
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {ogeler.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {terim.trim().length < EN_AZ_TERIM
                    ? `Aramak için en az ${EN_AZ_TERIM} harf yazın.`
                    : "Sonuç bulunamadı."}
                </p>
              ) : (
                <ul>
                  {ogeler.map((o, i) => (
                    <li key={o.anahtar}>
                      <button
                        onMouseEnter={() => setSecili(i)}
                        onClick={() => git(o.adres)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          i === secili ? "bg-primary/10" : "hover:bg-muted/40"
                        }`}
                      >
                        {o.render}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Doğal dilde sorgu (Faz 21 / G3) */}
            {aiAcik && terim.trim().length >= 3 && (
              <div className="border-t border-border/60 px-2 py-2">
                <button
                  onClick={sorguCalistir}
                  disabled={sorguBekliyor}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {sorguBekliyor
                      ? "Aranıyor…"
                      : `"${terim}" olarak süz`}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">
                    doğal dil
                  </span>
                </button>
                {sorguHatasi && (
                  <p className="px-3 pt-1 text-xs text-rose-400">{sorguHatasi}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
              <span>↑↓ gez · ↵ aç · Esc kapat</span>
              <span>{ARAMA_TURLERI.length} modülde arar</span>
            </div>
          </div>
        </ModalKatman>
      )}
    </>
  );
}
