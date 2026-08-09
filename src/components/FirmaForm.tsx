"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/(app)/firmalar/actions";
import { FIRMA_DURUM, SEKTORLER, DIGER_SEKTOR } from "@/lib/constants";
import { ILLER, ilceler } from "@/lib/tr-iller";
import OzelAlanGirdileri from "@/components/OzelAlanGirdileri";
import type { OzelAlanTanimi } from "@/lib/ozel-alan-tanimlar";

type FirmaValues = {
  ad?: string;
  vergiNo?: string | null;
  sektor?: string | null;
  il?: string | null;
  ilce?: string | null;
  yetkiliAd?: string | null;
  telefon?: string | null;
  email?: string | null;
  adres?: string | null;
  durum?: string | null;
  notlar?: string | null;
  enlem?: number | null;
  boylam?: number | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : label}
    </button>
  );
}

export default function FirmaForm({
  action,
  initial,
  submitLabel = "Kaydet",
  cancelHref = "/firmalar",
  ozelAlanlar = [],
  ozelDegerler = {},
  geocodingAcik = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: FirmaValues;
  submitLabel?: string;
  cancelHref?: string;
  ozelAlanlar?: OzelAlanTanimi[];
  ozelDegerler?: Record<string, string>;
  /** Harita anahtarı tanımlı mı? Arayüz kullanıcıya bunu açıkça söyler. */
  geocodingAcik?: boolean;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const v = initial ?? {};

  // Sektör: hazır listede varsa seç, yoksa "Diğer" + elle değer
  const sektorBilinen = !!v.sektor && (SEKTORLER as readonly string[]).includes(v.sektor);
  const [sektorSecim, setSektorSecim] = useState(
    v.sektor ? (sektorBilinen ? (v.sektor as string) : DIGER_SEKTOR) : ""
  );
  const [sektorDiger, setSektorDiger] = useState(
    v.sektor && !sektorBilinen ? (v.sektor as string) : ""
  );

  // İl / İlçe: bağımlı açılır menüler
  const ilBilinen = !!v.il && ILLER.includes(v.il);
  const [il, setIl] = useState(ilBilinen ? (v.il as string) : "");
  const [ilce, setIlce] = useState(v.ilce ?? "");

  return (
    <form action={formAction} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="ad">
            Firma Unvanı *
          </label>
          <input id="ad" name="ad" required className="input" defaultValue={v.ad ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="vergiNo">Vergi No</label>
          <input id="vergiNo" name="vergiNo" className="input" defaultValue={v.vergiNo ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="sektor-secim">Sektör</label>
          <select
            id="sektor-secim"
            className="input"
            value={sektorSecim}
            onChange={(e) => setSektorSecim(e.target.value)}
          >
            <option value="">Seçiniz…</option>
            {SEKTORLER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={DIGER_SEKTOR}>{DIGER_SEKTOR}</option>
          </select>
          {sektorSecim === DIGER_SEKTOR ? (
            <input
              name="sektor"
              className="input mt-2"
              placeholder="Sektörü yazın"
              value={sektorDiger}
              onChange={(e) => setSektorDiger(e.target.value)}
            />
          ) : (
            <input type="hidden" name="sektor" value={sektorSecim} />
          )}
        </div>

        <div>
          <label className="label" htmlFor="il">İl</label>
          <select
            id="il"
            name="il"
            className="input"
            value={il}
            onChange={(e) => {
              setIl(e.target.value);
              setIlce(""); // il değişince ilçe sıfırlanır
            }}
          >
            <option value="">Seçiniz…</option>
            {ILLER.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ilce">İlçe</label>
          <select
            id="ilce"
            name="ilce"
            className="input"
            value={ilce}
            onChange={(e) => setIlce(e.target.value)}
            disabled={!il}
          >
            <option value="">{il ? "Seçiniz…" : "Önce il seçin"}</option>
            {ilceler(il).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="yetkiliAd">Yetkili Kişi</label>
          <input id="yetkiliAd" name="yetkiliAd" className="input" defaultValue={v.yetkiliAd ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="telefon">Telefon</label>
          <input id="telefon" name="telefon" className="input" defaultValue={v.telefon ?? ""} />
        </div>

        <div>
          <label className="label" htmlFor="email">E-posta</label>
          <input id="email" name="email" type="email" className="input" defaultValue={v.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="durum">Durum</label>
          <select id="durum" name="durum" className="input" defaultValue={v.durum ?? "aktif"}>
            {FIRMA_DURUM.map((d) => (
              <option key={d} value={d}>
                {d === "aktif" ? "Aktif" : "Pasif"}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="adres">Adres</label>
          <input id="adres" name="adres" className="input" defaultValue={v.adres ?? ""} />
        </div>

        <KonumAlanlari
          enlem={v.enlem ?? null}
          boylam={v.boylam ?? null}
          geocodingAcik={geocodingAcik}
        />

        <div className="md:col-span-2">
          <label className="label" htmlFor="notlar">Notlar</label>
          <textarea id="notlar" name="notlar" rows={3} className="input" defaultValue={v.notlar ?? ""} />
        </div>

        {/* Kiracıya özel alanlar (Faz 11 / E6) */}
        {ozelAlanlar.length > 0 && (
          <div className="md:col-span-2 border-t border-border/60 pt-4">
            <p className="mb-3 text-sm font-semibold text-foreground/90">Özel Alanlar</p>
            <div className="grid gap-5 md:grid-cols-2">
              <OzelAlanGirdileri alanlar={ozelAlanlar} degerler={ozelDegerler} />
            </div>
          </div>
        )}
      </div>

      {state.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <Submit label={submitLabel} />
        <Link href={cancelHref} className="btn-secondary">
          İptal
        </Link>
      </div>
    </form>
  );
}

/**
 * Konum alanları (Faz 17 / A3).
 *
 * Koordinat ELLE girilebilir; boş bırakılırsa ve harita anahtarı tanımlıysa
 * sunucu adresten üretmeye çalışır. Anahtar yoksa arayüz bunu saklamaz —
 * "neden koordinat gelmedi" sorusu kullanıcıyı meşgul etmemeli.
 *
 * "Bulunduğum konumu kullan" tarayıcının konum servisini kullanır: saha
 * personeli firmanın önünde dururken tek dokunuşla koordinatı yazar. İzin
 * reddedilirse alan boş kalır ve kayıt yine açılır.
 */
function KonumAlanlari({
  enlem,
  boylam,
  geocodingAcik,
}: {
  enlem: number | null;
  boylam: number | null;
  geocodingAcik: boolean;
}) {
  const [deger, setDeger] = useState({
    enlem: enlem === null ? "" : String(enlem),
    boylam: boylam === null ? "" : String(boylam),
  });
  const [durum, setDurum] = useState<string | null>(null);

  function konumumuAl() {
    if (!navigator.geolocation) {
      setDurum("Tarayıcı konum servisini desteklemiyor.");
      return;
    }
    setDurum("Konum alınıyor…");
    navigator.geolocation.getCurrentPosition(
      (k) => {
        setDeger({
          enlem: k.coords.latitude.toFixed(6),
          boylam: k.coords.longitude.toFixed(6),
        });
        setDurum(null);
      },
      () => setDurum("Konum alınamadı (izin verilmedi)."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="md:col-span-2 border-t border-border/60 pt-4">
      <p className="mb-1 text-sm font-semibold text-foreground/90">Konum</p>
      <p className="mb-3 text-xs text-muted-foreground">
        {geocodingAcik
          ? "Boş bırakırsanız adresten otomatik bulunur. Elle girilen koordinat üstündür."
          : "Harita anahtarı tanımlı olmadığı için koordinat elle girilir."}
      </p>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="enlem">Enlem</label>
          <input
            id="enlem"
            name="enlem"
            className="input"
            placeholder="39.925533"
            value={deger.enlem}
            onChange={(e) => setDeger((d) => ({ ...d, enlem: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="boylam">Boylam</label>
          <input
            id="boylam"
            name="boylam"
            className="input"
            placeholder="32.866287"
            value={deger.boylam}
            onChange={(e) => setDeger((d) => ({ ...d, boylam: e.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={konumumuAl} className="btn-secondary">
            Bulunduğum konumu kullan
          </button>
        </div>
      </div>

      {durum && <p className="mt-2 text-xs text-muted-foreground">{durum}</p>}
    </div>
  );
}
