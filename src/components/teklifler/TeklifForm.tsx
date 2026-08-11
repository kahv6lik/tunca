"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { teklifOlustur, teklifGuncelle, type FormState } from "@/app/(app)/teklifler/actions";
import { TEKLIF_DURUM, TEKLIF_BIRIMLERI, PARA_BIRIMI, durumBadge } from "@/lib/constants";
import { formatPara } from "@/lib/format";
import {
  satirFiyatiHesapla,
  satirinKampanyalari,
  type KapsamliKampanya,
} from "@/lib/fiyat-saf";

type UrunSecenek = {
  id: string;
  kod: string;
  ad: string;
  birim: string;
  listeFiyat: number;
  kdvOrani: number;
};

type Secenek = { id: string; ad: string };

export type Kalem = {
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  /** Katalog bağı — serbest metin kalemlerde boştur. */
  urunId: string;
  kampanyaId: string;
};

export type TeklifDegerleri = {
  id: string;
  firmaId: string;
  firsatId: string;
  kisiId: string;
  no: string;
  baslik: string;
  durum: string;
  paraBirimi: string;
  indirimOrani: number;
  kdvOrani: number;
  gecerlilikTarihi: string;
  notlar: string;
  sartlar: string;
  kalemler: Kalem[];
};

const BOS_KALEM: Kalem = {
  aciklama: "",
  miktar: 1,
  birim: "adet",
  birimFiyat: 0,
  urunId: "",
  kampanyaId: "",
};

/**
 * Teklif formu (Faz 7 / C7).
 *
 * Toplamlar burada yalnızca ÖNİZLEME içindir; kaydedilen rakamlar sunucuda
 * yeniden hesaplanır. İstemciden gelen toplama güvenilmez.
 */
export default function TeklifForm({
  firmalar,
  firsatlar,
  kisiler,
  urunler = [],
  kampanyalar = [],
  mevcut,
  varsayilanNo,
  sabitFirmaId,
  varsayilanFirmaId,
  varsayilanFirsatId,
  varsayilanBaslik,
}: {
  firmalar: Secenek[];
  firsatlar?: Secenek[];
  kisiler?: Secenek[];
  /** Ürün kataloğu — kalem satırında fiyat ve KDV buradan gelir. */
  urunler?: UrunSecenek[];
  /**
   * Kampanya KATALOĞU kapsamıyla birlikte gelir; süzme satır satır burada
   * yapılır (siparişteki desen). Sunucuda bir kez süzülmüş liste yanlış
   * olurdu: ilk çizimde firma ve ürün henüz boştur.
   */
  kampanyalar?: KapsamliKampanya[];
  mevcut?: TeklifDegerleri;
  varsayilanNo?: string;
  sabitFirmaId?: string;
  /**
   * Fırsattan gelindiğinde ön seçimler (Faz 13 / H7). "Teklif hazırla"
   * bağlantısı firma ve fırsatı querystring'de taşır; kullanıcı aynı
   * bilgileri ikinci kez seçmek zorunda kalmasın.
   */
  varsayilanFirmaId?: string;
  varsayilanFirsatId?: string;
  varsayilanBaslik?: string;
}) {
  const duzenleme = Boolean(mevcut);
  const action = duzenleme ? teklifGuncelle.bind(null, mevcut!.id) : teklifOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  const [kalemler, setKalemler] = useState<Kalem[]>(
    mevcut?.kalemler.length ? mevcut.kalemler : [{ ...BOS_KALEM }]
  );
  /*
    Firma DENETİMLİ alandır: kampanya kapsamı ona bağlıdır ve firma
    değişince satırların uygun kampanya listesi de değişmelidir.
  */
  const [firmaId, setFirmaId] = useState(
    sabitFirmaId ?? mevcut?.firmaId ?? varsayilanFirmaId ?? ""
  );
  const [indirim, setIndirim] = useState(mevcut?.indirimOrani ?? 0);
  const [kdv, setKdv] = useState(mevcut?.kdvOrani ?? 20);
  const [paraBirimi, setParaBirimi] = useState(mevcut?.paraBirimi ?? "TRY");

  /*
    Satırın uygun kampanyaları — seçili firma ve satırın ürünüyle süzülür.
    Süzgeç sunucudakiyle AYNI saf fonksiyondur; ayrı yazılsaydı formda
    görünüp kaydederken düşen kampanyalar çıkardı.
  */
  const satirKampanyalari = kalemler.map((k) =>
    satirinKampanyalari(kampanyalar, { firmaId, urunId: k.urunId || null })
  );

  // Önizleme — sunucudaki hesabın aynısı: kampanya → belge iskontosu → KDV.
  const kampanyaIndirimleri = kalemler.map((k, i) => {
    if (!k.kampanyaId) return 0;
    const aday = satirKampanyalari[i].filter((x) => x.kampanyaId === k.kampanyaId);
    if (aday.length === 0) return 0;
    return satirFiyatiHesapla(
      { urunId: k.urunId, listeFiyat: k.birimFiyat || 0, kdvOrani: kdv },
      k.miktar || 0,
      { kampanyalar: aday, secilenKampanyaId: k.kampanyaId }
    ).indirimTutari;
  });

  const araToplam = kalemler.reduce((s, k) => s + (k.miktar || 0) * (k.birimFiyat || 0), 0);
  const kampanyaIndirimi = kampanyaIndirimleri.reduce((s, x) => s + x, 0);
  const indirimTutari =
    kampanyaIndirimi + ((araToplam - kampanyaIndirimi) * indirim) / 100;
  const matrah = araToplam - indirimTutari;
  const kdvTutari = (matrah * kdv) / 100;
  const toplam = matrah + kdvTutari;

  function kalemGuncelle(i: number, alan: keyof Kalem, deger: string | number) {
    setKalemler((k) => k.map((x, j) => (j === i ? { ...x, [alan]: deger } : x)));
  }

  /** Seçili kampanya bu bağlamda hâlâ geçerli mi? */
  function gecerliMi(kampanyaId: string, firma: string, urunId: string | null) {
    if (!kampanyaId) return false;
    return satirinKampanyalari(kampanyalar, { firmaId: firma, urunId }).some(
      (x) => x.kampanyaId === kampanyaId
    );
  }

  /** Ürün seçilince açıklama, birim, fiyat katalogdan gelir. */
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
              // Ürün değişince eski kampanya geçersiz kalabilir.
              kampanyaId: gecerliMi(k.kampanyaId, firmaId, urunId) ? k.kampanyaId : "",
            }
          : k
      )
    );
  }

  /** Firma değişince geçersiz kalan kampanya seçimleri temizlenir. */
  function firmaSec(yeni: string) {
    setFirmaId(yeni);
    setKalemler((ks) =>
      ks.map((k) =>
        gecerliMi(k.kampanyaId, yeni, k.urunId || null) ? k : { ...k, kampanyaId: "" }
      )
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Teklif Bilgileri</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="no">
              Teklif No *
            </label>
            <input
              id="no"
              name="no"
              required
              defaultValue={mevcut?.no ?? varsayilanNo}
              className="input font-mono"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="label" htmlFor="baslik">
              Başlık *
            </label>
            <input
              id="baslik"
              name="baslik"
              required
              defaultValue={mevcut?.baslik ?? varsayilanBaslik}
              className="input"
              placeholder="ör. 2026 yılı danışmanlık hizmeti"
            />
          </div>

          {sabitFirmaId ? (
            <input type="hidden" name="firmaId" value={sabitFirmaId} />
          ) : (
            <div>
              <label className="label" htmlFor="firmaId">
                Firma *
              </label>
              <select
                id="firmaId"
                name="firmaId"
                required
                value={firmaId}
                onChange={(e) => firmaSec(e.target.value)}
                className="input"
              >
                <option value="">Seçin…</option>
                {firmalar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </div>
          )}

          {firsatlar && (
            <div>
              <label className="label" htmlFor="firsatId">
                Fırsat
              </label>
              <select
                id="firsatId"
                name="firsatId"
                defaultValue={mevcut?.firsatId ?? varsayilanFirsatId ?? ""}
                className="input"
              >
                <option value="">—</option>
                {firsatlar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </div>
          )}

          {kisiler && (
            <div>
              <label className="label" htmlFor="kisiId">
                Muhatap
              </label>
              <select
                id="kisiId"
                name="kisiId"
                defaultValue={mevcut?.kisiId ?? ""}
                className="input"
              >
                <option value="">—</option>
                {kisiler.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="durum">
              Durum
            </label>
            <select
              id="durum"
              name="durum"
              defaultValue={mevcut?.durum ?? "taslak"}
              className="input"
            >
              {TEKLIF_DURUM.filter((d) => d !== "revizyon").map((d) => (
                <option key={d} value={d}>
                  {durumBadge(d).label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="gecerlilikTarihi">
              Geçerlilik Tarihi
            </label>
            <input
              id="gecerlilikTarihi"
              name="gecerlilikTarihi"
              type="date"
              defaultValue={mevcut?.gecerlilikTarihi}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="paraBirimi">
              Para Birimi
            </label>
            <select
              id="paraBirimi"
              name="paraBirimi"
              value={paraBirimi}
              onChange={(e) => setParaBirimi(e.target.value)}
              className="input"
            >
              {PARA_BIRIMI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kalemler */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Kalemler</h2>
          <button
            type="button"
            onClick={() => setKalemler((k) => [...k, { ...BOS_KALEM }])}
            className="btn-secondary h-9 px-3 text-sm"
          >
            <Plus className="h-4 w-4" /> Kalem Ekle
          </button>
        </div>

        <div className="space-y-3">
          {kalemler.map((k, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-12">
              {/* Katalog bağı (v1.23.0): ürün seçilince fiyat ve birim gelir,
                  ürüne tanımlı kampanyalar da böylece görünür hâle gelir. */}
              {urunler.length > 0 && (
                <div className="sm:col-span-12">
                  {i === 0 && <label className="label">Ürün (katalogdan)</label>}
                  <select
                    name={`kalem-${i}-urunId`}
                    value={k.urunId}
                    onChange={(e) => urunSec(i, e.target.value)}
                    className="input"
                  >
                    <option value="">Katalog dışı — serbest metin</option>
                    {urunler.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.kod} — {u.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-5">
                {i === 0 && <label className="label">Açıklama</label>}
                <input
                  name={`kalem-${i}-aciklama`}
                  value={k.aciklama}
                  onChange={(e) => kalemGuncelle(i, "aciklama", e.target.value)}
                  className="input"
                  placeholder="Hizmet / ürün açıklaması"
                />
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label className="label">Miktar</label>}
                <input
                  name={`kalem-${i}-miktar`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={k.miktar}
                  onChange={(e) => kalemGuncelle(i, "miktar", Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label className="label">Birim</label>}
                <select
                  name={`kalem-${i}-birim`}
                  value={k.birim}
                  onChange={(e) => kalemGuncelle(i, "birim", e.target.value)}
                  className="input"
                >
                  {TEKLIF_BIRIMLERI.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label className="label">Birim Fiyat</label>}
                <input
                  name={`kalem-${i}-birimFiyat`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={k.birimFiyat}
                  onChange={(e) => kalemGuncelle(i, "birimFiyat", Number(e.target.value))}
                  className="input"
                />
              </div>
              <div className="flex items-end sm:col-span-1">
                <button
                  type="button"
                  disabled={kalemler.length === 1}
                  onClick={() => setKalemler((x) => x.filter((_, j) => j !== i))}
                  aria-label="Kalemi sil"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/*
                Kampanya alanı HER ZAMAN çizilir; liste boşsa SEBEBİ yazar.
                Alanı gizlemek, kullanıcıya "kampanya diye bir şey yok"
                dedirtiyordu — oysa çoğu zaman kampanya vardı ama kapsamı
                yüzünden süzülmüştü.
              */}
              <div className="sm:col-span-12">
                {satirKampanyalari[i].length > 0 ? (
                  <select
                    name={`kalem-${i}-kampanyaId`}
                    value={k.kampanyaId}
                    onChange={(e) => kalemGuncelle(i, "kampanyaId", e.target.value)}
                    className="input"
                  >
                    <option value="">Kampanya yok</option>
                    {satirKampanyalari[i].map((kmp) => (
                      <option key={kmp.kampanyaId} value={kmp.kampanyaId}>
                        {kmp.kod} — {kmp.ad}
                        {kmp.kalanKota > 0 ? ` (${kmp.kalanKota} hak)` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {kampanyalar.length === 0
                      ? "Tanımlı aktif kampanya yok."
                      : !firmaId
                        ? "Önce firma seçin — kampanyaların bir kısmı firmaya özeldir."
                        : !k.urunId
                          ? "Ürün seçin — kampanyaların bir kısmı belirli ürünlere tanımlıdır."
                          : "Bu firma ve ürün için geçerli kampanya yok."}
                  </p>
                )}
                {kampanyaIndirimleri[i] > 0 && (
                  <p className="mt-1 text-xs text-emerald-500">
                    Kampanya indirimi: {formatPara(kampanyaIndirimleri[i], paraBirimi)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toplamlar */}
      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-foreground">Toplam</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="indirimOrani">
                İndirim (%)
              </label>
              <input
                id="indirimOrani"
                name="indirimOrani"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={indirim}
                onChange={(e) => setIndirim(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="kdvOrani">
                KDV (%)
              </label>
              <input
                id="kdvOrani"
                name="kdvOrani"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={kdv}
                onChange={(e) => setKdv(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <dl className="space-y-2 self-end rounded-xl border border-border/60 p-4 text-sm">
            <Satir etiket="Ara toplam" deger={formatPara(araToplam, paraBirimi)} />
            <Satir etiket={`İndirim (%${indirim})`} deger={`- ${formatPara(indirimTutari, paraBirimi)}`} />
            <Satir etiket={`KDV (%${kdv})`} deger={formatPara(kdvTutari, paraBirimi)} />
            <div className="border-t border-border/60 pt-2">
              <Satir etiket="Genel toplam" deger={formatPara(toplam, paraBirimi)} kalin />
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Kaydedilen rakamlar sunucuda yeniden hesaplanır.
            </p>
          </dl>
        </div>
      </div>

      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="notlar">
              Notlar
            </label>
            <textarea
              id="notlar"
              name="notlar"
              rows={4}
              defaultValue={mevcut?.notlar}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="sartlar">
              Şartlar
            </label>
            <textarea
              id="sartlar"
              name="sartlar"
              rows={4}
              defaultValue={mevcut?.sartlar}
              className="input"
              placeholder="Ödeme koşulları, teslim süresi…"
            />
          </div>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Kaydedildi.
        </p>
      )}

      <div className="flex justify-end">
        <Kaydet duzenleme={duzenleme} />
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
    <div className="flex items-center justify-between gap-4">
      <dt className={kalin ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {etiket}
      </dt>
      <dd className={kalin ? "text-base font-bold text-foreground" : "text-foreground"}>
        {deger}
      </dd>
    </div>
  );
}

function Kaydet({ duzenleme }: { duzenleme: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri Kaydet" : "Teklifi Oluştur"}
    </button>
  );
}
