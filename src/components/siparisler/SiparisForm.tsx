"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Trash2, Package } from "lucide-react";
import {
  siparisOlustur,
  siparisGuncelle,
  type FormState,
} from "@/app/(app)/siparisler/actions";
import { PARA_BIRIMI, URUN_BIRIMLERI } from "@/lib/constants";
import { formatPara } from "@/lib/format";
import PaketSecici from "@/components/urunler/PaketSecici";
import {
  satirFiyatiHesapla,
  satirinKampanyalari,
  firmaninPaketleri,
  paketiKalemlereAc,
  paketGrubuHesapla,
  type KapsamliKampanya,
  type KapsamliPaket,
} from "@/lib/fiyat-saf";

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
  /**
   * Satır bir paketten açıldıysa hangi paketten geldiği (v1.25.0).
   * Görünmez bir damgadır: kullanıcı doğrudan seçmez, "Paketten kalem ekle"
   * ile gelir ve satırın birim fiyatının neden liste fiyatından farklı
   * olduğunu açıklar.
   */
  paketId: string;
  /**
   * Kaç PAKET satıldığı (v1.27.0). `miktar` ürün adedidir; paket adedi ayrı
   * durur çünkü kampanya kotası PAKET sayar, ürün sayısı değil.
   */
  paketAdedi: number;
  /** Bir pakette bu üründen kaç adet var — paket adedi değişince kullanılır. */
  birimMiktar: number;
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
  projeId?: string;
  paraBirimi: string;
  notlar: string;
  kalemler: SiparisKalemDegeri[];
};

const BOS_KALEM: SiparisKalemDegeri = {
  urunId: "",
  paketId: "",
  paketAdedi: 0,
  birimMiktar: 0,
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
  paketler = [],
  kisiler,
  mevcut,
  varsayilanFirmaId,
  varsayilanTeklifId,
  varsayilanKalemler,
  varsayilanParaBirimi,
  varsayilanKisiId,
  projeler,
  varsayilanProjeId,
}: {
  firmalar: { id: string; ad: string }[];
  urunler: UrunSecenek[];
  kampanyalar: KapsamliKampanya[];
  /** Paket kataloğu KAPSAMIYLA gelir; süzme istemcide yapılır (v1.25.0). */
  paketler?: KapsamliPaket[];
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
  /** Proje bağı OPSİYONELDİR (Faz 16): tek seferlik satışlar projesiz olur. */
  projeler?: { id: string; kod: string; ad: string }[];
  varsayilanProjeId?: string;
}) {
  const action = mevcut ? siparisGuncelle.bind(null, mevcut.id) : siparisOlustur;
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  /*
    Firma DENETİMLİ bir alandır çünkü kampanya kapsamı ona bağlıdır: firma
    değişince satırlardaki uygun kampanya listesi de değişmelidir.
  */
  const [firmaId, setFirmaId] = useState(
    mevcut?.firmaId ?? varsayilanFirmaId ?? ""
  );

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
              // Ürün değişince paket damgası da düşer: damga "bu ÜRÜN şu
              // paketten geldi" demektir, ürün değişince iddia yalan olur.
              paketId: "",
              aciklama: u ? u.ad : k.aciklama,
              birim: u ? u.birim : k.birim,
              birimFiyat: u ? u.listeFiyat : k.birimFiyat,
              kdvOrani: u ? u.kdvOrani : k.kdvOrani,
              // Ürün değişince eski kampanya artık geçerli olmayabilir;
              // seçili bırakmak "indirim var" yanılgısı verirdi.
              kampanyaId: gecerliMi(k.kampanyaId, firmaId, urunId) ? k.kampanyaId : "",
            }
          : k
      )
    );
  }

  /*
    PAKETTEN KALEM EKLEME (v1.25.0).

    Paket TEK BİR SATIR OLARAK EKLENMEZ, kalemlerine açılır: her ürün kendi
    satırı olur. Tek opak satır olsaydı satırın `urunId`'si boş kalırdı ve
    onay anındaki stok düşümü (satırın ürününe bakar) SESSİZCE hiç
    çalışmazdı — paket satılır, depodan hiçbir şey düşmezdi. Kalemlere
    açmak kısmi sevkiyatı, iadeyi ve ürün bazlı raporu da bozmaz.

    Birim fiyat paketten gelir (`paketBirimFiyati`): sabit paket fiyatı
    kalemlere liste değerine ORANTILI dağıtılır (Faz 14 kararı). Kullanıcı
    sonradan fiyatı ya da miktarı değiştirebilir; satır o andan sonra
    sıradan bir satırdır ama `paketId` damgası kalır.
  */
  const uygunPaketler = firmaninPaketleri(paketler, firmaId || null);

  function paketEkle(paketId: string) {
    const paket = uygunPaketler.find((p) => p.paketId === paketId);
    if (!paket) return;

    setKalemler((ks) => {
      /*
        AYNI PAKET İKİ KEZ EKLENİRSE ADEDİ ARTAR, satır ÇOĞALMAZ (v1.27.0).
        Ortağın istediği "4 paket 5 paket sipariş verilebilmeli" budur;
        aynı paketi ikinci kez ayrı bir grup olarak eklemek, kampanyayı da
        iki kez uygulanır hâle getirirdi.
      */
      if (ks.some((k) => k.paketId === paketId)) {
        return ks.map((k) =>
          k.paketId === paketId
            ? {
                ...k,
                paketAdedi: k.paketAdedi + 1,
                miktar: k.birimMiktar * (k.paketAdedi + 1),
              }
            : k
        );
      }

      const yeniler: SiparisKalemDegeri[] = paketiKalemlereAc(paket).map((s) => ({
        ...BOS_KALEM,
        urunId: s.urunId,
        paketId: s.paketId,
        paketAdedi: 1,
        birimMiktar: s.miktar,
        aciklama: s.aciklama,
        miktar: s.miktar,
        birim: s.birim,
        birimFiyat: s.birimFiyat,
        kdvOrani: s.kdvOrani,
      }));

      // Kullanıcı forma yeni girdiyse tek boş satır duruyordur; paketin
      // kalemleri onun YERİNE geçer, altına boş bir satır bırakmaz.
      const bosMu = ks.length === 1 && !ks[0].urunId && !ks[0].aciklama.trim();
      return bosMu ? yeniler : [...ks, ...yeniler];
    });
  }

  /** Paket adedi değişince grubun BÜTÜN satırlarının miktarı yeniden kurulur. */
  function paketAdediDegistir(paketId: string, adet: number) {
    const guvenli = Math.max(adet, 0);
    setKalemler((ks) =>
      ks.map((k) =>
        k.paketId === paketId
          ? { ...k, paketAdedi: guvenli, miktar: k.birimMiktar * guvenli }
          : k
      )
    );
  }

  /*
    Kampanya PAKETE seçilir, satıra değil: paket bir bütündür ve "paket
    fiyatı 1000 TL" kampanyası paketin tamamına uygulanmalıdır. Seçim
    grubun bütün satırlarına yazılır; sunucu da aynı şekilde gruplar.
  */
  function paketKampanyaSec(paketId: string, kampanyaId: string) {
    setKalemler((ks) =>
      ks.map((k) => (k.paketId === paketId ? { ...k, kampanyaId } : k))
    );
  }

  function paketSil(paketId: string) {
    setKalemler((ks) => {
      const kalan = ks.filter((k) => k.paketId !== paketId);
      return kalan.length > 0 ? kalan : [{ ...BOS_KALEM }];
    });
  }

  /** Seçili kampanya, verilen bağlamda hâlâ geçerli mi? */
  function gecerliMi(
    kampanyaId: string,
    firma: string,
    urunId: string | null,
    paketId: string | null = null
  ): boolean {
    if (!kampanyaId) return false;
    return satirinKampanyalari(kampanyalar, {
      firmaId: firma,
      urunId,
      paketId,
    }).some((x) => x.kampanyaId === kampanyaId);
  }

  /** Bir paket damgası, verilen firmada hâlâ geçerli mi? */
  function paketGecerliMi(paketId: string, firma: string): boolean {
    if (!paketId) return false;
    return firmaninPaketleri(paketler, firma || null).some(
      (p) => p.paketId === paketId
    );
  }

  /**
   * Firma değişince geçersiz kalan kampanya VE paket damgaları temizlenir.
   *
   * Paket damgası da firmaya bağlıdır: A firmasına özel bir paketten açılan
   * satır, firma B'ye çevrildiğinde "B ile şu paket anlaşması var" demeye
   * devam ederdi. Fiyat elle değiştirilmeden kalır — kullanıcının girdiği
   * rakama dokunmayız — ama iddia düşer.
   */
  function firmaSec(yeni: string) {
    setFirmaId(yeni);
    setKalemler((ks) =>
      ks.map((k) => ({
        ...k,
        kampanyaId: gecerliMi(
          k.kampanyaId,
          yeni,
          k.urunId || null,
          k.paketId || null
        )
          ? k.kampanyaId
          : "",
        paketId: paketGecerliMi(k.paketId, yeni) ? k.paketId : "",
      }))
    );
  }

  /*
    Satırın uygun kampanyaları — SEÇİLİ FİRMA ve SATIRIN ÜRÜNÜ ile süzülür.
    Süzgeç sunucudakiyle AYNI saf fonksiyondur (`satirinKampanyalari`);
    ayrı yazılsaydı formda görünüp kaydederken düşen kampanyalar çıkardı.
  */
  const satirKampanyalari = kalemler.map((k) =>
    satirinKampanyalari(kampanyalar, {
      firmaId,
      urunId: k.urunId || null,
      // Paket kapsamlı kampanya satırın damgasıyla sorulur (v1.26.1).
      paketId: k.paketId || null,
    })
  );

  /*
    GRUPLAMA (v1.27.0) — paket bir BÜTÜNDÜR.

    Ortağın bulgusu: "paket fiyatı 1000 TL atandı ama ürün bazında
    hesaplandığı için 2000 TL oluyor." Paketten açılan satırlar tek tek
    fiyatlanırsa paket, ürünlerin toplamına iner. Artık aynı `paketId`yi
    taşıyan satırlar TEK GRUPTUR: adet paket cinsindendir, kampanya bir kez
    ve paketin tamamına uygulanır, indirim satırlara pay edilir.

    Satırlar yine ayrı ayrı KAYDEDİLİR — stok, kısmi sevkiyat ve ürün
    raporu bozulmasın diye (v1.25.0 kararı).
  */
  type Grup =
    | { tur: "urun"; indeks: number }
    | { tur: "paket"; paketId: string; indeksler: number[] };

  const gruplar: Grup[] = [];
  kalemler.forEach((k, i) => {
    if (!k.paketId) {
      gruplar.push({ tur: "urun", indeks: i });
      return;
    }
    const varOlan = gruplar.find(
      (g): g is Extract<Grup, { tur: "paket" }> =>
        g.tur === "paket" && g.paketId === k.paketId
    );
    if (varOlan) varOlan.indeksler.push(i);
    else gruplar.push({ tur: "paket", paketId: k.paketId, indeksler: [i] });
  });

  /** Satır başına önizleme sonucu — hangi gruptan geldiği fark etmez. */
  const satirlar: {
    indirimTutari: number;
    netTutar: number;
    kdvTutari: number;
    kampanya: { kod: string } | null;
  }[] = kalemler.map(() => ({
    indirimTutari: 0,
    netTutar: 0,
    kdvTutari: 0,
    kampanya: null,
  }));

  /** Paket grubunun özeti — başlıkta gösterilir. */
  const paketOzet = new Map<
    string,
    { paketBirimFiyati: number; brut: number; indirim: number; net: number }
  >();

  for (const g of gruplar) {
    if (g.tur === "urun") {
      const k = kalemler[g.indeks];
      const s = satirFiyatiHesapla(
        { urunId: k.urunId, listeFiyat: k.birimFiyat, kdvOrani: k.kdvOrani },
        k.miktar,
        {
          kampanyalar: k.kampanyaId
            ? satirKampanyalari[g.indeks].filter(
                (x) => x.kampanyaId === k.kampanyaId
              )
            : [],
          secilenKampanyaId: k.kampanyaId || null,
          elIskontoOrani: k.iskontoOrani,
        }
      );
      satirlar[g.indeks] = {
        indirimTutari: s.indirimTutari,
        netTutar: s.netTutar,
        kdvTutari: s.kdvTutari,
        kampanya: s.kampanya,
      };
      continue;
    }

    const ilk = kalemler[g.indeksler[0]];
    const secilen = ilk.kampanyaId
      ? (satirKampanyalari[g.indeksler[0]].find(
          (x) => x.kampanyaId === ilk.kampanyaId
        ) ?? null)
      : null;

    const sonuc = paketGrubuHesapla(
      g.indeksler.map((i) => ({
        urunId: kalemler[i].urunId,
        birimMiktar: kalemler[i].birimMiktar,
        birimFiyat: kalemler[i].birimFiyat,
        kdvOrani: kalemler[i].kdvOrani,
      })),
      ilk.paketAdedi,
      secilen
    );

    g.indeksler.forEach((i, j) => {
      const c = sonuc.satirlar[j];
      satirlar[i] = {
        indirimTutari: c.indirimTutari,
        netTutar: c.tutar,
        kdvTutari: c.kdvTutari,
        kampanya: sonuc.kampanya,
      };
    });

    paketOzet.set(g.paketId, {
      paketBirimFiyati: sonuc.paketBirimFiyati,
      brut: sonuc.brut,
      indirim: sonuc.indirimTutari,
      net: sonuc.netTutar,
    });
  }

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
            value={firmaId}
            onChange={(e) => firmaSec(e.target.value)}
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

        {projeler && projeler.length > 0 && (
          <div>
            <label className="label" htmlFor="projeId">Proje</label>
            <select
              id="projeId"
              name="projeId"
              defaultValue={mevcut?.projeId ?? varsayilanProjeId ?? ""}
              className="input"
            >
              <option value="">— (projesiz)</option>
              {projeler.map((p) => (
                <option key={p.id} value={p.id}>{p.kod} — {p.ad}</option>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Sipariş Kalemleri</h3>
          <div className="flex items-center gap-2">
            <PaketSecici paketler={uygunPaketler} firmaSecili={Boolean(firmaId)} onSec={paketEkle} />
            <button
              type="button"
              onClick={() => setKalemler((k) => [...k, { ...BOS_KALEM }])}
              className="btn-secondary h-8 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Kalem Ekle
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {gruplar.map((g) =>
            g.tur === "paket" ? (
              <PaketGrubu
                key={`p-${g.paketId}`}
                paketAd={
                  paketler.find((p) => p.paketId === g.paketId)?.ad ?? "Paket"
                }
                kalemler={g.indeksler.map((i) => ({ i, k: kalemler[i] }))}
                ozet={paketOzet.get(g.paketId)}
                adaylar={satirKampanyalari[g.indeksler[0]]}
                kampanyaVarMi={kampanyalar.length > 0}
                firmaSecili={Boolean(firmaId)}
                satirlar={satirlar}
                onAdet={(a) => paketAdediDegistir(g.paketId, a)}
                onKampanya={(id) => paketKampanyaSec(g.paketId, id)}
                onSil={() => paketSil(g.paketId)}
                onFiyat={(i, v) => guncelle(i, "birimFiyat", v)}
              />
            ) : (
              <UrunSatiri
                key={`u-${g.indeks}`}
                i={g.indeks}
                k={kalemler[g.indeks]}
                urunler={urunler}
                adaylar={satirKampanyalari[g.indeks]}
                kampanyaVarMi={kampanyalar.length > 0}
                firmaSecili={Boolean(firmaId)}
                sonuc={satirlar[g.indeks]}
                onUrun={(id) => urunSec(g.indeks, id)}
                onAlan={(alan, v) => guncelle(g.indeks, alan, v)}
                onSil={() =>
                  setKalemler((ks) => {
                    const kalan = ks.filter((_, j) => j !== g.indeks);
                    return kalan.length > 0 ? kalan : [{ ...BOS_KALEM }];
                  })
                }
              />
            )
          )}
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

type SatirSonucu = {
  indirimTutari: number;
  netTutar: number;
  kdvTutari: number;
  kampanya: { kod: string } | null;
};

/** Kampanya alanı — liste boşken de çizilir ve SEBEBİNİ yazar (v1.23.0). */
function KampanyaAlani({
  id,
  ad,
  deger,
  adaylar,
  kampanyaVarMi,
  firmaSecili,
  urunSecili,
  onSec,
  ipucu,
}: {
  id: string;
  /** Form alan adı; paket grubunda `undefined` (satırlara gizli yazılır). */
  ad?: string;
  deger: string;
  adaylar: KapsamliKampanya[];
  kampanyaVarMi: boolean;
  firmaSecili: boolean;
  urunSecili: boolean;
  onSec: (kampanyaId: string) => void;
  ipucu?: string;
}) {
  if (adaylar.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {!kampanyaVarMi
          ? "Tanımlı aktif kampanya yok."
          : !firmaSecili
            ? "Önce firma seçin — kampanyaların bir kısmı firmaya özeldir."
            : !urunSecili
              ? "Ürün seçin — kampanyaların bir kısmı belirli ürünlere tanımlıdır."
              : (ipucu ?? "Bu firma ve ürün için geçerli kampanya yok.")}
      </p>
    );
  }
  return (
    <select
      id={id}
      name={ad}
      value={deger}
      onChange={(e) => onSec(e.target.value)}
      className="input"
    >
      <option value="">Kampanya yok</option>
      {adaylar.map((kmp) => (
        <option key={kmp.kampanyaId} value={kmp.kampanyaId}>
          {kmp.kod} — {kmp.ad}
          {kmp.kalanKota > 0 ? ` (${kmp.kalanKota} hak)` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * PAKET GRUBU — v1.27.0.
 *
 * Paket TEK BİR KUTUDUR: adedi paket cinsindendir ("4 paket"), kampanyası
 * bir kez seçilir ve paketin TAMAMINA uygulanır. İçindeki ürünler
 * listelenir; her birinin birim fiyatı düzeltilebilir ama miktarı paket
 * adedinden türer — pakette 2 adet varsa 4 pakette 8 adet olur.
 *
 * Satırlar yine ayrı ayrı kaydedilir (gizli alanlarla): stok düşümü, kısmi
 * sevkiyat ve ürün raporu satırın ürününe bakar (v1.25.0 kararı).
 */
function PaketGrubu({
  paketAd,
  kalemler,
  ozet,
  adaylar,
  kampanyaVarMi,
  firmaSecili,
  satirlar,
  onAdet,
  onKampanya,
  onSil,
  onFiyat,
}: {
  paketAd: string;
  kalemler: { i: number; k: SiparisKalemDegeri }[];
  ozet?: { paketBirimFiyati: number; brut: number; indirim: number; net: number };
  adaylar: KapsamliKampanya[];
  kampanyaVarMi: boolean;
  firmaSecili: boolean;
  satirlar: SatirSonucu[];
  onAdet: (adet: number) => void;
  onKampanya: (kampanyaId: string) => void;
  onSil: () => void;
  onFiyat: (i: number, deger: number) => void;
}) {
  const ilk = kalemler[0].k;

  return (
    <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-3">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-sky-500" />
          <div>
            <p className="text-sm font-semibold text-foreground">{paketAd}</p>
            <p className="text-xs text-muted-foreground">
              Paket · {kalemler.length} ürün
              {ozet ? ` · paket bedeli ${formatPara(ozet.paketBirimFiyati)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="w-28">
            <label className="label text-xs" htmlFor={`paket-${ilk.paketId}-adet`}>
              Paket adedi
            </label>
            <input
              id={`paket-${ilk.paketId}-adet`}
              type="number"
              step="1"
              min={1}
              value={ilk.paketAdedi}
              onChange={(e) => onAdet(Number(e.target.value))}
              className="input"
            />
          </div>
          <div className="text-right text-sm">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="font-medium">{formatPara(ozet?.net ?? 0)}</p>
          </div>
          <button
            type="button"
            onClick={onSil}
            aria-label="Paketi çıkar"
            className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Paketin ürünleri */}
      <div className="mb-3 space-y-1.5">
        {kalemler.map(({ i, k }) => (
          <div
            key={i}
            className="grid items-center gap-2 rounded-lg bg-background/60 px-2 py-1.5 sm:grid-cols-12"
          >
            {/* Satır alanları gizli gider: sunucu her ürünü ayrı kaydeder. */}
            <input type="hidden" name={`kalem-${i}-urunId`} value={k.urunId} />
            <input type="hidden" name={`kalem-${i}-paketId`} value={k.paketId} />
            <input type="hidden" name={`kalem-${i}-paketAdedi`} value={k.paketAdedi} />
            <input type="hidden" name={`kalem-${i}-aciklama`} value={k.aciklama} />
            <input type="hidden" name={`kalem-${i}-miktar`} value={k.miktar} />
            <input type="hidden" name={`kalem-${i}-birim`} value={k.birim} />
            <input type="hidden" name={`kalem-${i}-kdv`} value={k.kdvOrani} />
            <input type="hidden" name={`kalem-${i}-iskonto`} value={k.iskontoOrani} />
            <input
              type="hidden"
              name={`kalem-${i}-kampanyaId`}
              value={k.kampanyaId}
            />

            <p className="truncate text-sm sm:col-span-5">{k.aciklama}</p>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {k.birimMiktar} × {k.paketAdedi} = <strong>{k.miktar}</strong> {k.birim}
            </p>
            <div className="sm:col-span-3">
              <input
                type="number"
                step="0.01"
                min={0}
                value={k.birimFiyat}
                onChange={(e) => onFiyat(i, Number(e.target.value))}
                aria-label={`${k.aciklama} birim fiyatı`}
                className="input h-8 text-xs"
              />
            </div>
            <p className="text-right text-xs sm:col-span-2">
              {formatPara(satirlar[i]?.netTutar ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <label className="label text-xs" htmlFor={`paket-${ilk.paketId}-kampanya`}>
          Kampanya (paketin tamamına)
        </label>
        <KampanyaAlani
          id={`paket-${ilk.paketId}-kampanya`}
          deger={ilk.kampanyaId}
          adaylar={adaylar}
          kampanyaVarMi={kampanyaVarMi}
          firmaSecili={firmaSecili}
          urunSecili
          onSec={onKampanya}
          ipucu="Bu firma ve paket için geçerli kampanya yok."
        />
        {ozet && ozet.indirim > 0 && (
          <p className="mt-1 text-xs text-emerald-500">
            İndirim: {formatPara(ozet.indirim)} · {formatPara(ozet.brut)} →{" "}
            {formatPara(ozet.net)}
          </p>
        )}
      </div>
    </div>
  );
}

/** Sıradan ürün satırı — pakete ait olmayan kalemler. */
function UrunSatiri({
  i,
  k,
  urunler,
  adaylar,
  kampanyaVarMi,
  firmaSecili,
  sonuc,
  onUrun,
  onAlan,
  onSil,
}: {
  i: number;
  k: SiparisKalemDegeri;
  urunler: UrunSecenek[];
  adaylar: KapsamliKampanya[];
  kampanyaVarMi: boolean;
  firmaSecili: boolean;
  sonuc?: SatirSonucu;
  onUrun: (urunId: string) => void;
  onAlan: (alan: keyof SiparisKalemDegeri, deger: string | number) => void;
  onSil: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <input type="hidden" name={`kalem-${i}-paketId`} value="" />
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-4">
          <label className="label text-xs" htmlFor={`kalem-${i}-urunId`}>Ürün</label>
          <select
            id={`kalem-${i}-urunId`}
            name={`kalem-${i}-urunId`}
            value={k.urunId}
            onChange={(e) => onUrun(e.target.value)}
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
            onChange={(e) => onAlan("aciklama", e.target.value)}
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
            onChange={(e) => onAlan("miktar", Number(e.target.value))}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label text-xs" htmlFor={`kalem-${i}-birim`}>Birim</label>
          <select
            id={`kalem-${i}-birim`}
            name={`kalem-${i}-birim`}
            value={k.birim}
            onChange={(e) => onAlan("birim", e.target.value)}
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
            onChange={(e) => onAlan("birimFiyat", Number(e.target.value))}
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
            onChange={(e) => onAlan("iskontoOrani", Number(e.target.value))}
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
            onChange={(e) => onAlan("kdvOrani", Number(e.target.value))}
            className="input"
          />
        </div>

        <div className="sm:col-span-2 flex items-end justify-between gap-2">
          <div className="text-right text-sm">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="font-medium">{formatPara(sonuc?.netTutar ?? 0)}</p>
          </div>
          <button
            type="button"
            onClick={onSil}
            aria-label="Kalemi sil"
            className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="sm:col-span-12">
          <label className="label text-xs" htmlFor={`kalem-${i}-kampanyaId`}>
            Kampanya
          </label>
          <KampanyaAlani
            id={`kalem-${i}-kampanyaId`}
            ad={`kalem-${i}-kampanyaId`}
            deger={k.kampanyaId}
            adaylar={adaylar}
            kampanyaVarMi={kampanyaVarMi}
            firmaSecili={firmaSecili}
            urunSecili={Boolean(k.urunId)}
            onSec={(v) => onAlan("kampanyaId", v)}
          />
          {sonuc?.kampanya && (
            <p className="mt-1 text-xs text-emerald-500">
              İndirim: {formatPara(sonuc.indirimTutari)}
            </p>
          )}
        </div>
      </div>
    </div>
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
