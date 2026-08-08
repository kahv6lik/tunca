"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  siparisOlustur,
  siparisGuncelle,
  type FormState,
} from "@/app/(app)/siparisler/actions";
import { PARA_BIRIMI, URUN_BIRIMLERI } from "@/lib/constants";
import { formatPara } from "@/lib/format";
import { satirFiyatiHesapla, type FiyatKampanyasi } from "@/lib/fiyat-saf";

type UrunSecenek = {
  id: string;
  kod: string;
  ad: string;
  birim: string;
  listeFiyat: number;
  kdvOrani: number;
  stokTakibi: boolean;
  stokMiktar: number;
};

export type SiparisKalemDegeri = {
  urunId: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  iskontoOrani: number;
  kdvOrani: number;
  kampanyaId: string;
};

export type SiparisDegerleri = {
  id: string;
  firmaId: string;
  kisiId: string;
  paraBirimi: string;
  notlar: string;
  kalemler: SiparisKalemDegeri[];
};

const BOS_KALEM: SiparisKalemDegeri = {
  urunId: "",
  aciklama: "",
  miktar: 1,
  birim: "adet",
  birimFiyat: 0,
  iskontoOrani: 0,
  kdvOrani: 20,
  kampanyaId: "",
};

/**
 * Sipariş formu — Faz 15 / S1.
 *
 * Toplamlar burada yalnızca ÖNİZLEMEDİR; kaydedilen rakamlar sunucuda
 * `fiyat-saf.ts` ile yeniden hesaplanır (teklifteki desen). Önizleme de
 * AYNI fonksiyonu çağırır, böylece ekranda görünen ile kaydedilen ayrışmaz.
 */
export default function SiparisForm({
  firmalar,
  urunler,
  kampanyalar,
  kisiler,
  mevcut,
  varsayilanFirmaId,
  varsayilanTeklifId,
  varsayilanKalemler,
  varsayilanParaBirimi,
  varsayilanKisiId,
}: {
  firmalar: { id: string; ad: string }[];
  urunler: UrunSecenek[];
  kampanyalar: FiyatKampanyasi[];
  kisiler?: { id: string; ad: string }[];
  mevcut?: SiparisDegerleri;
  varsayilanFirmaId?: string;
  varsayilanTeklifId?: string;
  /**
   * Tekliften gelen ön dolgu (S2). `mevcut` ile KARIŞTIRILMAMALIDIR:
   * `mevcut` "bu siparişi düzenliyorum" demektir ve formu güncelleme
   * action'ına bağlar. Ön dolgu ise hâlâ YENİ bir sipariştir.
   */
  varsayilanKalemler?: SiparisKalemDegeri[];
  varsayilanParaBirimi?: string;
  varsayilanKisiId?: string;
}) {
  const action = mevcut ? siparisGuncelle.bind(null, mevcut.id) : siparisOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  const [kalemler, setKalemler] = useState<SiparisKalemDegeri[]>(
    mevcut?.kalemler.length
      ? mevcut.kalemler
      : varsayilanKalemler?.length
        ? varsayilanKalemler
        : [{ ...BOS_KALEM }]
  );

  function guncelle(i: number, alan: keyof SiparisKalemDegeri, deger: string | number) {
    setKalemler((ks) => ks.map((k, j) => (j === i ? { ...k, [alan]: deger } : k)));
  }

  /** Ürün seçilince açıklama, birim, fiyat ve KDV katalogdan gelir. */
  function urunSec(i: number, urunId: string) {
    const u = urunler.find((x) => x.id === urunId);
    setKalemler((ks) =>
      ks.map((k, j) =>
        j === i
          ? {
              ...k,
              urunId,
              aciklama: u ? u.ad : k.aciklama,
              birim: u ? u.birim : k.birim,
              birimFiyat: u ? u.listeFiyat : k.birimFiyat,
              kdvOrani: u ? u.kdvOrani : k.kdvOrani,
            }
          : k
      )
    );
  }

  // Önizleme — sunucudaki hesabın aynısı.
  const satirlar = kalemler.map((k) =>
    satirFiyatiHesapla(
      { urunId: k.urunId, listeFiyat: k.birimFiyat, kdvOrani: k.kdvOrani },
      k.miktar,
      {
        kampanyalar: k.kampanyaId
          ? kampanyalar.filter((x) => x.kampanyaId === k.kampanyaId)
          : [],
        secilenKampanyaId: k.kampanyaId || null,
        elIskontoOrani: k.iskontoOrani,
      }
    )
  );

  const araToplam = kalemler.reduce((s, k) => s + k.birimFiyat * k.miktar, 0);
  const indirim = satirlar.reduce((s, x) => s + x.indirimTutari, 0);
  const kdv = satirlar.reduce((s, x) => s + x.kdvTutari, 0);
  const toplam = araToplam - indirim + kdv;

  // Stok uyarısı — engel DEĞİL, bilgi: asıl kontrol onay anındadır.
  const stokUyarilari = kalemler
    .map((k) => {
      const u = urunler.find((x) => x.id === k.urunId);
      if (!u?.stokTakibi || u.stokMiktar >= k.miktar) return null;
      return `${u.ad}: elde ${u.stokMiktar} ${u.birim}, istenen ${k.miktar}`;
    })
    .filter(Boolean) as string[];

  return (
    <form action={formAction} className="space-y-6">
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        {varsayilanTeklifId && (
          <input type="hidden" name="teklifId" value={varsayilanTeklifId} />
        )}

        <div>
          <label className="label" htmlFor="firmaId">Firma *</label>
          <select
            id="firmaId"
            name="firmaId"
            required
            defaultValue={mevcut?.firmaId ?? varsayilanFirmaId ?? ""}
            className="input"
          >
            <option value="">Seçin…</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>{f.ad}</option>
            ))}
          </select>
        </div>

        {kisiler && kisiler.length > 0 && (
          <div>
            <label className="label" htmlFor="kisiId">Muhatap</label>
            <select
              id="kisiId"
              name="kisiId"
              defaultValue={mevcut?.kisiId ?? varsayilanKisiId ?? ""}
              className="input"
            >
              <option value="">—</option>
              {kisiler.map((k) => (
                <option key={k.id} value={k.id}>{k.ad}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="paraBirimi">Para Birimi</label>
          <select
            id="paraBirimi"
            name="paraBirimi"
            defaultValue={mevcut?.paraBirimi ?? varsayilanParaBirimi ?? "TRY"}
            className="input"
          >
            {PARA_BIRIMI.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="notlar">Notlar</label>
          <textarea
            id="notlar"
            name="notlar"
            rows={2}
            defaultValue={mevcut?.notlar}
            className="input"
          />
        </div>
      </div>

      {/* Kalemler */}
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Sipariş Kalemleri</h3>
          <button
            type="button"
            onClick={() => setKalemler((k) => [...k, { ...BOS_KALEM }])}
            className="btn-secondary h-8 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Kalem Ekle
          </button>
        </div>

        <div className="space-y-4">
          {kalemler.map((k, i) => (
            <div key={i} className="rounded-xl border border-border/60 p-3">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className="label text-xs" htmlFor={`kalem-${i}-urunId`}>Ürün</label>
                  <select
                    id={`kalem-${i}-urunId`}
                    name={`kalem-${i}-urunId`}
                    value={k.urunId}
                    onChange={(e) => urunSec(i, e.target.value)}
                    className="input"
                  >
                    <option value="">Katalog dışı</option>
                    {urunler.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.kod} — {u.ad}
                        {u.stokTakibi ? ` (stok ${u.stokMiktar})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-8">
                  <label className="label text-xs" htmlFor={`kalem-${i}-aciklama`}>
                    Açıklama *
                  </label>
                  <input
                    id={`kalem-${i}-aciklama`}
                    name={`kalem-${i}-aciklama`}
                    required
                    value={k.aciklama}
                    onChange={(e) => guncelle(i, "aciklama", e.target.value)}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs" htmlFor={`kalem-${i}-miktar`}>Miktar</label>
                  <input
                    id={`kalem-${i}-miktar`}
                    name={`kalem-${i}-miktar`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={k.miktar}
                    onChange={(e) => guncelle(i, "miktar", Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs" htmlFor={`kalem-${i}-birim`}>Birim</label>
                  <select
                    id={`kalem-${i}-birim`}
                    name={`kalem-${i}-birim`}
                    value={k.birim}
                    onChange={(e) => guncelle(i, "birim", e.target.value)}
                    className="input"
                  >
                    {URUN_BIRIMLERI.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs" htmlFor={`kalem-${i}-birimFiyat`}>
                    Birim Fiyat
                  </label>
                  <input
                    id={`kalem-${i}-birimFiyat`}
                    name={`kalem-${i}-birimFiyat`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={k.birimFiyat}
                    onChange={(e) => guncelle(i, "birimFiyat", Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs" htmlFor={`kalem-${i}-iskonto`}>
                    İskonto (%)
                  </label>
                  <input
                    id={`kalem-${i}-iskonto`}
                    name={`kalem-${i}-iskonto`}
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={k.iskontoOrani}
                    onChange={(e) => guncelle(i, "iskontoOrani", Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs" htmlFor={`kalem-${i}-kdv`}>KDV (%)</label>
                  <input
                    id={`kalem-${i}-kdv`}
                    name={`kalem-${i}-kdv`}
                    type="number"
                    step="0.1"
                    min={0}
                    value={k.kdvOrani}
                    onChange={(e) => guncelle(i, "kdvOrani", Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end justify-between gap-2">
                  <div className="text-right text-sm">
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="font-medium">{formatPara(satirlar[i]?.netTutar ?? 0)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKalemler((ks) => ks.filter((_, j) => j !== i))}
                    aria-label="Kalemi sil"
                    className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {kampanyalar.length > 0 && (
                  <div className="sm:col-span-12">
                    <label className="label text-xs" htmlFor={`kalem-${i}-kampanyaId`}>
                      Kampanya
                    </label>
                    <select
                      id={`kalem-${i}-kampanyaId`}
                      name={`kalem-${i}-kampanyaId`}
                      value={k.kampanyaId}
                      onChange={(e) => guncelle(i, "kampanyaId", e.target.value)}
                      className="input"
                    >
                      <option value="">Kampanya yok</option>
                      {kampanyalar.map((kmp) => (
                        <option key={kmp.kampanyaId} value={kmp.kampanyaId}>
                          {kmp.kod} — {kmp.ad}
                          {kmp.kalanKota > 0 ? ` (${kmp.kalanKota} hak)` : ""}
                        </option>
                      ))}
                    </select>
                    {satirlar[i]?.kampanya && (
                      <p className="mt-1 text-xs text-emerald-500">
                        İndirim: {formatPara(satirlar[i].indirimTutari)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toplamlar */}
      <div className="card p-6">
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <Satir etiket="Ara toplam" deger={formatPara(araToplam)} />
          <Satir etiket="İndirim" deger={`− ${formatPara(indirim)}`} />
          <Satir etiket="KDV" deger={formatPara(kdv)} />
          <div className="border-t border-border/60 pt-1">
            <Satir etiket="Genel toplam" deger={formatPara(toplam)} kalin />
          </div>
        </dl>
        <p className="mt-3 text-right text-xs text-muted-foreground">
          Tutarlar kaydederken sunucuda yeniden hesaplanır.
        </p>
      </div>

      {stokUyarilari.length > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="mb-1 font-medium text-amber-400">Stok uyarısı</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {stokUyarilari.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Sipariş kaydedilebilir; stok yeterliliği ONAY anında yeniden
            denetlenir ve yetersizse onay verilemez.
          </p>
        </div>
      )}

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Kaydet duzenleme={Boolean(mevcut)} />
      </div>
    </form>
  );
}

function Satir({
  etiket,
  deger,
  kalin,
}: {
  etiket: string;
  deger: string;
  kalin?: boolean;
}) {
  return (
    <div className={`flex justify-between ${kalin ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      <dt>{etiket}</dt>
      <dd>{deger}</dd>
    </div>
  );
}

function Kaydet({ duzenleme }: { duzenleme: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending
        ? "Kaydediliyor…"
        : duzenleme
          ? "Güncelle ve onaya gönder"
          : "Kaydet ve onaya gönder"}
    </button>
  );
}
