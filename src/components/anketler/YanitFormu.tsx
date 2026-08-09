"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { yanitiKaydet, type YanitState } from "@/app/anket/[token]/actions";
import { olcekAraligi, type SoruTanimi } from "@/lib/anket-tanimlar";

/**
 * Anket yanıt formu (Faz 19 / N3).
 *
 * OTURUMSUZ bir sayfada çalışır. Girdi adları `s_<soruId>` biçimindedir;
 * sunucu yalnızca bu öneki tanır ve soruyu TANIMDAN doğrular — istemciden
 * gelen değere hiçbir aşamada güvenilmez.
 */
export default function YanitFormu({
  token,
  sorular,
  anonim,
}: {
  token: string;
  sorular: SoruTanimi[];
  anonim: boolean;
}) {
  const [state, formAction] = useFormState<YanitState, FormData>(
    yanitiKaydet.bind(null, token),
    {}
  );

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
        <p className="text-lg font-semibold text-foreground">Teşekkür ederiz</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Yanıtlarınız kaydedildi. Bu sayfayı kapatabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {anonim && (
        <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Bu anket <strong className="text-foreground">anonimdir</strong>:
          yanıtlarınız adınıza veya firmanıza bağlanmaz.
        </p>
      )}

      {sorular.map((soru, i) => (
        <div key={soru.id} className="card p-5">
          <p className="mb-3 font-medium text-foreground">
            {i + 1}. {soru.metin}
            {soru.zorunlu && <span className="ml-1 text-rose-400">*</span>}
          </p>
          <Girdi soru={soru} />
        </div>
      ))}

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}

      <Gonder />
    </form>
  );
}

function Girdi({ soru }: { soru: SoruTanimi }) {
  const ad = `s_${soru.id}`;
  const aralik = olcekAraligi(soru.tip);

  if (aralik) {
    // Ölçek radyo düğmeleriyle sunulur: dokunmatik ekranda kaydırıcıdan
    // (slider) çok daha isabetli ve seçilen değer hep görünür durur.
    const secenekler = Array.from(
      { length: aralik.max - aralik.min + 1 },
      (_, i) => aralik.min + i
    );
    return (
      <div className="flex flex-wrap gap-2">
        {secenekler.map((d) => (
          <label
            key={d}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border/70 text-sm text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/15 has-[:checked]:text-primary"
          >
            <input type="radio" name={ad} value={d} className="sr-only" />
            {d}
          </label>
        ))}
      </div>
    );
  }

  if (soru.tip === "evethayir") {
    return (
      <div className="flex gap-2">
        {[
          { deger: "evet", etiket: "Evet" },
          { deger: "hayir", etiket: "Hayır" },
        ].map((s) => (
          <label
            key={s.deger}
            className="cursor-pointer rounded-lg border border-border/70 px-4 py-2 text-sm text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/15 has-[:checked]:text-primary"
          >
            <input type="radio" name={ad} value={s.deger} className="sr-only" />
            {s.etiket}
          </label>
        ))}
      </div>
    );
  }

  if (soru.tip === "coktan") {
    return (
      <div className="space-y-2">
        {soru.secenekler.map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/15"
          >
            <input type="radio" name={ad} value={s} />
            {s}
          </label>
        ))}
      </div>
    );
  }

  return <textarea name={ad} rows={3} className="input" />;
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Gönderiliyor…" : "Yanıtları Gönder"}
    </button>
  );
}
