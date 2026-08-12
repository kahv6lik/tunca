"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

export type CokluSecenek = { id: string; ad: string };

/**
 * Onay kutulu çoklu seçim listesi — v1.25.1.
 *
 * ORTAĞIN BULGUSU: "kampanya düzenleme ekranındaki ürünler / paketler /
 * firmalar kısmında çoklu seçme yaparken karışıklık oluyor."
 *
 * Sebebi tarayıcının `<select multiple>` öğesiydi: seçim yalnızca ARKA PLAN
 * RENGİYLE gösteriliyor, Ctrl/Cmd basılı tutulmadan tıklamak önceki bütün
 * seçimleri SESSİZCE siliyor ve kaç öğe seçildiği hiçbir yerde yazmıyordu.
 * Uzun listede (yüzlerce firma) seçili olanlar görüş alanının dışında kalıp
 * tamamen görünmez oluyordu.
 *
 * ÇÖZÜM ÜÇ PARÇADIR:
 *   1. Her satırın SOLUNDA onay kutusu — seçim renk değil, işarettir.
 *   2. Üstte SAYAÇ — "kaç tane seçtim?" listeye bakmadan yanıtlanır.
 *   3. "Tümünü seç" / "Temizle" — tek tek tıklamak zorunda kalınmaz.
 *
 * ARAMA ALANI 8'DEN UZUN LİSTELERDE çıkar: kısa listede kutucuk yer kaplar,
 * uzun listede ise aranan firmayı bulmak kaydırma işine döner.
 *
 * FORMA `<input type="checkbox">` OLARAK yazılır; action tarafı
 * `formData.getAll(ad)` ile okuduğu için sunucuda HİÇBİR ŞEY DEĞİŞMEZ —
 * `<select multiple>` de aynı biçimde gönderiyordu.
 */
export default function CokluSecim({
  ad,
  baslik,
  secenekler,
  secili,
  ipucu = "Boş = hepsi",
}: {
  /** Form alan adı — her seçili öğe bu adla gönderilir. */
  ad: string;
  baslik: string;
  secenekler: CokluSecenek[];
  /** Açılışta işaretli olanlar. */
  secili: string[];
  ipucu?: string;
}) {
  const [secim, setSecim] = useState<string[]>(secili);
  const [ara, setAra] = useState("");

  const ARAMA_ESIGI = 8;
  const aramaVar = secenekler.length > ARAMA_ESIGI;

  // Türkçe duyarsız süzme: "ISPARTA" yazan "ısparta"yı da bulmalı.
  const gorunen = useMemo(() => {
    const terim = ara.trim().toLocaleLowerCase("tr");
    if (!terim) return secenekler;
    return secenekler.filter((s) =>
      s.ad.toLocaleLowerCase("tr").includes(terim)
    );
  }, [ara, secenekler]);

  function degistir(id: string) {
    setSecim((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  /*
    "Tümünü seç" GÖRÜNEN listeyi seçer, bütün katalogu değil: kullanıcı
    arama yaptıysa niyeti "şu aramaya uyanların hepsi"dir. Aramanın dışında
    kalan seçimlere DOKUNULMAZ — süzgeç bir görünüm işidir, seçimi silmemeli.
  */
  const gorunenIdler = gorunen.map((s) => s.id);
  const hepsiSecili =
    gorunenIdler.length > 0 && gorunenIdler.every((id) => secim.includes(id));

  function tumunuDegistir() {
    setSecim((s) =>
      hepsiSecili
        ? s.filter((id) => !gorunenIdler.includes(id))
        : [...new Set([...s, ...gorunenIdler])]
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="label mb-0">{baslik}</label>
        {secenekler.length > 0 && (
          <button
            type="button"
            onClick={tumunuDegistir}
            className="text-xs text-primary hover:underline"
          >
            {hepsiSecili ? "Temizle" : "Tümünü seç"}
          </button>
        )}
      </div>

      {/* SAYAÇ: seçimin kaç öğe olduğu listeye bakmadan okunur. */}
      <p className="mb-1.5 text-xs text-muted-foreground">
        {secim.length === 0
          ? "Hiçbiri seçili değil"
          : `${secim.length} / ${secenekler.length} seçili`}
      </p>

      {aramaVar && (
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder="Ara…"
            aria-label={`${baslik} içinde ara`}
            className="input h-8 pl-8 text-xs"
          />
        </div>
      )}

      <div
        role="group"
        aria-label={baslik}
        className="max-h-44 overflow-y-auto overscroll-contain rounded-xl border border-border/60 p-1"
      >
        {gorunen.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {secenekler.length === 0 ? "Kayıt yok." : "Aramaya uyan yok."}
          </p>
        ) : (
          gorunen.map((s) => {
            const isaretli = secim.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                  isaretli ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {/*
                  Görsel kutu: seçim RENK değil, İŞARETTİR.

                  Gerçek `<input>` bu kutunun TAM ÜSTÜNDE, saydam olarak
                  durur — `sr-only` DEĞİL. Sebebi v1.26.0'ın bulgusudur:
                  `sr-only` öğe 1px'e sıkıştırılıp akıştan koptuğu için,
                  tıklayınca odaklanan kutuyu "görünür kılmak" isteyen
                  tarayıcı listeyi ve modalı zıplatıyordu. Girdi kendi
                  yerinde durursa kaydıracak bir şey kalmaz.
                */}
                <span
                  className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isaretli
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    name={ad}
                    value={s.id}
                    checked={isaretli}
                    onChange={() => degistir(s.id)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  {isaretli && <Check aria-hidden className="h-3 w-3" />}
                </span>
                <span className="min-w-0 break-words">{s.ad}</span>
              </label>
            );
          })
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{ipucu}</p>
    </div>
  );
}
