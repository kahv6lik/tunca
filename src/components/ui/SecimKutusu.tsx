"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aramalı tek seçimli açılır kutu (v1.12.1).
 *
 * Neden `<select>` değil: departman gibi 40 seçenekli listelerde tarayıcının
 * kendi açılır menüsünde arama yoktur; kullanıcı listeyi gözle tarar. Burada
 * açılınca küçük bir arama kutusu gelir ve yazdıkça süzülür.
 *
 * Değer, gizli bir `<input>` ile forma taşınır — yani form gönderimi
 * bakımından sıradan bir alan gibi davranır, ek bir action gerekmez.
 *
 * ELLE DEĞER GİRİLEMEZ: arama kutusu yalnızca süzer, yazılan metin değer
 * olmaz. Listede olmayan bir değer (ör. listeden sonradan çıkarılmış bir
 * departman) mevcut kayıtta duruyorsa gösterilir ve "listede yok" olarak
 * işaretlenir; kullanıcı isterse geçerli bir değerle değiştirir.
 */
export default function SecimKutusu({
  name,
  id,
  secenekler,
  deger,
  placeholder = "Seçiniz…",
  aramaPlaceholder = "Ara…",
  required,
  temizlenebilir = true,
}: {
  name: string;
  id?: string;
  secenekler: readonly string[];
  deger?: string | null;
  placeholder?: string;
  aramaPlaceholder?: string;
  required?: boolean;
  temizlenebilir?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState(deger ?? "");
  const [arama, setArama] = useState("");
  const kutu = useRef<HTMLDivElement>(null);
  const aramaGirdi = useRef<HTMLInputElement>(null);

  // Dışarı tıklayınca kapan.
  useEffect(() => {
    if (!acik) return;
    const kapat = (e: MouseEvent) => {
      if (kutu.current && !kutu.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("mousedown", kapat);
    return () => document.removeEventListener("mousedown", kapat);
  }, [acik]);

  useEffect(() => {
    if (acik) aramaGirdi.current?.focus();
    else setArama("");
  }, [acik]);

  /**
   * Türkçe duyarlı arama: "İ/ı" ve "I/i" çiftleri yüzünden düz
   * `toLowerCase()` yanlış eşleşir ("İnsan" araması "insan" yazınca
   * bulunmalıdır). Ayrıca aksan farkları da yok sayılır.
   */
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase("tr")
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c");

  const suzulmus = useMemo(() => {
    const q = normalize(arama.trim());
    if (!q) return secenekler;
    return secenekler.filter((s) => normalize(s).includes(q));
  }, [arama, secenekler]);

  const listedeYok = !!secili && !secenekler.includes(secili);

  return (
    <div ref={kutu} className="relative">
      {/* Değer forma bu gizli girdiyle gider. */}
      <input type="hidden" name={name} value={secili} />
      {/* required davranışı: boşsa tarayıcı gönderimi engellesin. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={secili}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}

      <button
        type="button"
        id={id}
        onClick={() => setAcik((a) => !a)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={cn("truncate", !secili && "text-muted-foreground")}>
          {secili || placeholder}
          {listedeYok && (
            <span className="ml-1.5 text-xs text-amber-500">(listede yok)</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {temizlenebilir && secili && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Seçimi temizle"
              onClick={(e) => {
                e.stopPropagation();
                setSecili("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSecili("");
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              acik && "rotate-180"
            )}
          />
        </span>
      </button>

      {acik && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={aramaGirdi}
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAcik(false);
                // Enter: tek sonuç kaldıysa onu seç — klavyeyle hızlı giriş.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (suzulmus.length === 1) {
                    setSecili(suzulmus[0]);
                    setAcik(false);
                  }
                }
              }}
              placeholder={aramaPlaceholder}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {suzulmus.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Eşleşen seçenek yok
              </p>
            ) : (
              suzulmus.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSecili(s);
                    setAcik(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                    s === secili
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="truncate">{s}</span>
                  {s === secili && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
