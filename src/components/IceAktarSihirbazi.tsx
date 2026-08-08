"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Upload, CheckCircle2, AlertTriangle, ArrowRight, Download } from "lucide-react";
import {
  dosyaAnalizEt,
  iceAktar,
  type AnalizState,
  type AktarimState,
} from "@/app/(app)/ice-aktar/actions";
import { ICE_AKTARILABILIR, iceSutunlar, veriKumesiBul } from "@/lib/disa-aktar-tanimlar";

/**
 * İçe aktarım sihirbazı — Faz 9 / E2.
 *
 * Üç adım: dosya seç → sütunları eşleştir ve ön izle → aktar. Yazma yalnızca
 * son adımda olur; kullanıcı ne olacağını görmeden onaylamaz.
 */
export default function IceAktarSihirbazi({ izinliKumeler }: { izinliKumeler: string[] }) {
  const [analiz, analizAction] = useFormState<AnalizState, FormData>(dosyaAnalizEt, {});
  const [aktarim, aktarimAction] = useFormState<AktarimState, FormData>(iceAktar, {});
  const [kume, setKume] = useState(izinliKumeler[0] ?? "");

  const secilenKume = veriKumesiBul(analiz.kume ?? kume);
  const gecerliSatirlar = analiz.onIzleme?.satirlar.filter((s) => s.durum === "gecerli") ?? [];

  if (aktarim.ok) {
    return (
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <h2 className="text-lg font-semibold text-foreground">İçe aktarım tamamlandı</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{aktarim.eklenen}</strong> kayıt eklendi
          {aktarim.atlanan ? `, ${aktarim.atlanan} satır atlandı` : ""}.
        </p>

        {aktarim.hatalar && aktarim.hatalar.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="mb-2 text-sm font-medium text-amber-500">Atlanan satırlar</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {aktarim.hatalar.map((h) => (
                <li key={h.satirNo}>
                  <span className="font-mono">Satır {h.satirNo}</span> — {h.hata}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <a href="/ice-aktar" className="btn-primary">
            Yeni İçe Aktarım
          </a>
          <a href="/firmalar" className="btn-secondary">
            Firmalara git
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Adım — dosya ve veri kümesi */}
      <form action={analizAction} className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            1
          </span>
          <h2 className="font-semibold text-foreground">Dosya seçin</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="kume">
              Ne aktarıyorsunuz?
            </label>
            <select
              id="kume"
              name="kume"
              value={kume}
              onChange={(e) => setKume(e.target.value)}
              className="input"
            >
              {ICE_AKTARILABILIR.filter((k) => izinliKumeler.includes(k.deger)).map((k) => (
                <option key={k.deger} value={k.deger}>
                  {k.etiket}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="dosya">
              Excel veya CSV dosyası
            </label>
            <input
              id="dosya"
              name="dosya"
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              required
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:text-foreground"
            />
          </div>
        </div>

        {/* Eşleştirme gönderildiğinde aynı dosya yeniden seçilmelidir; bu
            bilinçli: dosyayı sunucuda saklamamak için (geçici dosya yönetimi
            ve gizlilik yükü getirir). */}
        {analiz.basliklar && (
          <p className="mt-3 text-xs text-muted-foreground">
            Eşleştirmeyi değiştirdiyseniz dosyayı yeniden seçip
            &quot;Analiz Et&quot; deyin.
          </p>
        )}

        {secilenKume && (
          <div className="mt-4 rounded-xl border border-border/60 p-4 text-sm">
            <p className="mb-1 font-medium text-foreground">Beklenen sütunlar</p>
            <p className="text-muted-foreground">
              {iceSutunlar(secilenKume).map((s) => (
                <span key={s.anahtar}>
                  {s.etiket}
                  {s.zorunlu && <span className="text-rose-400">*</span>}
                  {", "}
                </span>
              ))}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              <span className="text-rose-400">*</span> zorunlu. Sütun adları birebir
              aynı olmak zorunda değil — bir sonraki adımda eşleştirirsiniz.{" "}
              <a
                href={`/api/disa-aktar?tur=${secilenKume.deger}&bicim=xlsx`}
                className="text-primary hover:underline"
              >
                <Download className="inline h-3 w-3" /> Örnek şablon indir
              </a>
            </p>
          </div>
        )}

        {analiz.error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {analiz.error}
          </p>
        )}

        {/* Eşleştirme alanları — 2. adımda seçilenler buradan gönderilir */}
        {analiz.basliklar && secilenKume && (
          <div className="mt-5 border-t border-border/60 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <h2 className="font-semibold text-foreground">Sütunları eşleştirin</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {iceSutunlar(secilenKume).map((s) => (
                <div key={s.anahtar} className="flex items-center gap-2">
                  <label
                    className="w-40 shrink-0 text-sm text-foreground"
                    htmlFor={`eslesme-${s.anahtar}`}
                  >
                    {s.etiket}
                    {s.zorunlu && <span className="text-rose-400">*</span>}
                  </label>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <select
                    id={`eslesme-${s.anahtar}`}
                    name={`eslesme-${s.anahtar}`}
                    defaultValue={analiz.eslesme?.[s.anahtar] ?? ""}
                    className="input h-9 py-0 text-sm"
                  >
                    <option value="">— aktarma —</option>
                    {analiz.basliklar!.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <AnalizDugmesi yeniden={Boolean(analiz.basliklar)} />
        </div>
      </form>

      {/* 3. Adım — ön izleme ve aktarım */}
      {analiz.onIzleme && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <h2 className="font-semibold text-foreground">Ön izleme ve onay</h2>
          </div>

          <div className="mb-4 flex flex-wrap gap-4">
            <span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
              <CheckCircle2 className="mr-1 inline h-4 w-4" />
              {analiz.onIzleme.gecerli} satır aktarılacak
            </span>
            {analiz.onIzleme.hatali > 0 && (
              <span className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                <AlertTriangle className="mr-1 inline h-4 w-4" />
                {analiz.onIzleme.hatali} satır atlanacak
              </span>
            )}
            {analiz.toplamSatir != null &&
              analiz.toplamSatir > analiz.onIzleme.satirlar.length && (
                <span className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
                  Dosyada {analiz.toplamSatir} satır var; ilk{" "}
                  {analiz.onIzleme.satirlar.length} tanesi işlenecek
                </span>
              )}
          </div>

          <div className="mb-4 max-h-80 overflow-auto rounded-xl border border-border/60">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="sticky top-0 bg-muted/60">
                <tr>
                  <th className="th">Satır</th>
                  {secilenKume && iceSutunlar(secilenKume).map((s) => (
                    <th key={s.anahtar} className="th whitespace-nowrap">
                      {s.etiket}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {analiz.onIzleme.satirlar.slice(0, 100).map((satir) => (
                  <tr
                    key={satir.satirNo}
                    className={satir.durum === "hata" ? "bg-rose-500/5" : ""}
                  >
                    <td className="td font-mono text-xs">
                      {satir.satirNo}
                      {satir.durum === "hata" && (
                        <span
                          className="ml-1 text-rose-400"
                          title={satir.hata}
                          aria-label={satir.hata}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    {secilenKume && iceSutunlar(secilenKume).map((s) => (
                      <td key={s.anahtar} className="td max-w-[220px] truncate">
                        {satir.veri[s.anahtar] || (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analiz.onIzleme.hatali > 0 && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
              Hatalı satırlar <strong>aktarılmayacak</strong>, geri kalanlar
              aktarılacak. Hatanın sebebini görmek için satır numarasının yanındaki
              uyarı işaretinin üzerine gelin.
            </div>
          )}

          <form action={aktarimAction} className="flex items-center justify-end gap-3">
            <input type="hidden" name="kume" value={analiz.kume} />
            <input
              type="hidden"
              name="satirlar"
              value={JSON.stringify(gecerliSatirlar)}
            />
            {aktarim.error && (
              <p className="mr-auto text-sm text-rose-400">{aktarim.error}</p>
            )}
            <AktarDugmesi sayi={analiz.onIzleme.gecerli} />
          </form>
        </div>
      )}
    </div>
  );
}

function AnalizDugmesi({ yeniden }: { yeniden: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      <Upload className="h-4 w-4" />
      {pending ? "Okunuyor…" : yeniden ? "Yeniden Analiz Et" : "Analiz Et"}
    </button>
  );
}

function AktarDugmesi({ sayi }: { sayi: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || sayi === 0}>
      {pending ? "Aktarılıyor…" : `${sayi} Kaydı Aktar`}
    </button>
  );
}
