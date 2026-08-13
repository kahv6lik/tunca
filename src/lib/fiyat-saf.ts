/**
 * Fiyat motoru — Faz 14 / T6.
 *
 * Bir satırın fiyatı TEK bir saf fonksiyondan geçer. Neden bu kadar katı:
 * fiyat hesabı üç ayrı yerde (teklif, sipariş, rapor) tekrarlanırsa er ya da
 * geç üçü farklı rakam üretir ve müşteriye hangi rakamın söylendiği
 * bilinemez hâle gelir. Burası tek doğru kaynaktır.
 *
 * `server-only` DEĞİLDİR: veritabanı bilmez, yalnızca sayı alır ve sayı
 * döndürür. Testler onu doğrudan sınar; form önizlemesi de aynı fonksiyonu
 * kullanabilir.
 *
 * ═══ SIRA (değiştirilmesi kırıcı bir karardır) ═══
 *
 *   1. LİSTE FİYATI       — ürünün kataloğdaki fiyatı
 *   2. FİRMAYA ÖZEL PAKET — varsa liste fiyatının YERİNE geçer
 *   3. KAMPANYA           — 2'nin sonucunun ÜZERİNE uygulanır
 *   4. KDV                — en sonda, indirimli tutar üzerinden
 *
 * Paket kampanyadan ÖNCE gelir çünkü paket "bu müşterinin fiyatı budur"
 * anlaşmasıdır; kampanya ise o fiyatın üzerine yapılan geçici bir jesttir.
 * Ters sırada, sözleşmeli müşteri kampanyadan hiç yararlanamazdı.
 *
 * ═══ TEK KAMPANYA ═══
 *
 * Aday kampanyalardan yalnızca BİRİ uygulanır: müşteriye en avantajlı olan
 * (`enIyiKampanya`). Üst üste binen indirimler hem hesabı hem de müşteriye
 * yapılan savunmayı imkânsızlaştırır ("%20 + %15 neden %35 değil?").
 * Kullanıcı isterse seçimi elle değiştirir; motor yalnızca öneriyi üretir.
 */

import { type KampanyaTipi } from "./constants";

export type FiyatUrunu = {
  urunId: string;
  listeFiyat: number;
  kdvOrani: number;
};

/** Firmaya sunulan paket — kalem başına birim fiyat üretir. */
export type FiyatPaketi = {
  paketId: string;
  /** Sabit paket fiyatı verilmişse kalem birim fiyatı buradan türetilir. */
  sabitFiyat: boolean;
  fiyat: number;
  iskontoOrani: number;
  /** Paketteki kalemler — sabit fiyatı kalemlere dağıtmak için gerekir. */
  kalemler: { urunId: string; miktar: number; listeFiyat: number }[];
};

export type FiyatKampanyasi = {
  kampanyaId: string;
  kod: string;
  ad: string;
  tip: KampanyaTipi;
  deger: number;
  alN: number;
  odeM: number;
  /** 0 = sınırsız. Kalan hak, kotanın kullanılan kısmı düşülmüş hâlidir. */
  kalanKota: number;
};

export type FiyatSonucu = {
  /** Katalogdaki ham fiyat × miktar */
  listeTutar: number;
  /** Paket uygulandıktan sonraki birim fiyat */
  birimFiyat: number;
  /** Paket + kampanya sonrası, KDV hariç tutar */
  netTutar: number;
  indirimTutari: number;
  kdvTutari: number;
  toplam: number;
  /** Uygulanan kampanya (yoksa null) */
  kampanya: FiyatKampanyasi | null;
  /** Hesabın hangi adımlardan geçtiği — arayüzde "neden bu fiyat?" için */
  adimlar: string[];
};

const YUVARLA = (n: number) => Math.round(n * 100) / 100;

/**
 * Paketten kalem birim fiyatı çıkarır.
 *
 * Sabit paket fiyatı, kalemlerin LİSTE DEĞERİNE ORANTILI dağıtılır. Eşit
 * bölmek yanlış olurdu: 100 TL'lik ürünle 10.000 TL'lik ürün aynı payı
 * almamalı — iade ve kısmi sevkiyatta rakam saçmalardı.
 */
export function paketBirimFiyati(
  paket: FiyatPaketi,
  urunId: string,
  listeFiyat: number
): number | null {
  const kalem = paket.kalemler.find((k) => k.urunId === urunId);
  if (!kalem) return null;

  if (!paket.sabitFiyat) {
    return YUVARLA(listeFiyat * (1 - paket.iskontoOrani / 100));
  }

  const listeToplam = paket.kalemler.reduce(
    (s, k) => s + k.listeFiyat * k.miktar,
    0
  );
  // Paketteki her kalem bedelsizse (liste toplamı 0) orantı kurulamaz;
  // sabit fiyat kalem sayısına eşit bölünür.
  if (listeToplam <= 0) {
    const adet = paket.kalemler.reduce((s, k) => s + k.miktar, 0);
    return adet > 0 ? YUVARLA(paket.fiyat / adet) : 0;
  }

  const pay = (kalem.listeFiyat * kalem.miktar) / listeToplam;
  return YUVARLA((paket.fiyat * pay) / kalem.miktar);
}

/**
 * Bir kampanyanın SATIR üzerindeki indirimini hesaplar (KDV hariç).
 *
 * Kalan kota, indirimi SINIRLAR: 5 adetlik hakkı kalan bir kampanyadan 8
 * adet satılırsa indirim yalnızca 5 adede uygulanır. Sessizce 8 adede
 * uygulamak kotayı anlamsız kılardı; satışı reddetmek de gereksiz sert olur.
 */
export function kampanyaIndirimi(
  kampanya: FiyatKampanyasi,
  birimFiyat: number,
  miktar: number
): { indirim: number; kullanilanAdet: number } {
  const adet =
    kampanya.kalanKota > 0 ? Math.min(miktar, kampanya.kalanKota) : miktar;

  if (adet <= 0) return { indirim: 0, kullanilanAdet: 0 };

  switch (kampanya.tip) {
    case "yuzde": {
      const oran = Math.min(Math.max(kampanya.deger, 0), 100);
      return {
        indirim: YUVARLA(birimFiyat * adet * (oran / 100)),
        kullanilanAdet: adet,
      };
    }

    case "tutar": {
      // Sabit tutar ADET BAŞINA değil, satırın tamamına uygulanır; ama
      // satırın kendisinden büyük olamaz (negatif fiyat üretmemeli).
      const indirim = Math.min(Math.max(kampanya.deger, 0), birimFiyat * adet);
      return { indirim: YUVARLA(indirim), kullanilanAdet: adet };
    }

    case "alnodem": {
      // "3 al 2 öde": her N adette (N − M) adet bedava.
      const n = Math.max(kampanya.alN, 0);
      const m = Math.max(kampanya.odeM, 0);
      if (n <= 0 || m <= 0 || m >= n) return { indirim: 0, kullanilanAdet: 0 };

      const grup = Math.floor(adet / n);
      const bedava = grup * (n - m);
      return {
        indirim: YUVARLA(birimFiyat * bedava),
        kullanilanAdet: grup * n,
      };
    }

    case "paketfiyat": {
      // Kampanya, birim fiyatı doğrudan belirler.
      const hedef = Math.max(kampanya.deger, 0);
      const fark = (birimFiyat - hedef) * adet;
      return {
        indirim: fark > 0 ? YUVARLA(fark) : 0,
        kullanilanAdet: fark > 0 ? adet : 0,
      };
    }

    default:
      // Tanınmayan tip indirim üretmez. Bilinmeyen bir kuralı "herhalde
      // yüzdedir" diye yorumlamak yanlış fiyat üretmekten beterdir.
      return { indirim: 0, kullanilanAdet: 0 };
  }
}

/** Aday kampanyalardan müşteriye en avantajlı olanı seçer. */
export function enIyiKampanya(
  adaylar: FiyatKampanyasi[],
  birimFiyat: number,
  miktar: number
): { kampanya: FiyatKampanyasi; indirim: number } | null {
  let enIyi: { kampanya: FiyatKampanyasi; indirim: number } | null = null;

  for (const k of adaylar) {
    const { indirim } = kampanyaIndirimi(k, birimFiyat, miktar);
    if (indirim <= 0) continue;
    // Eşitlikte İLK kampanya kazanır: sıralama çağıranın elindedir ve
    // rastgele değişen bir seçim raporları açıklanamaz kılardı.
    if (!enIyi || indirim > enIyi.indirim) enIyi = { kampanya: k, indirim };
  }

  return enIyi;
}

/**
 * Satır fiyatını uçtan uca hesaplar.
 *
 * `secilenKampanyaId` verilirse motorun önerisi yerine O kampanya uygulanır
 * (kullanıcı bilinçli olarak başka bir kampanyayı seçebilir); verilen
 * kampanya adaylar arasında yoksa hiç kampanya uygulanmaz — istemciden gelen
 * bir id'ye güvenip indirim vermek, indirim yetkisini herkese açardı.
 */
export function satirFiyatiHesapla(
  urun: FiyatUrunu,
  miktar: number,
  secenekler: {
    paket?: FiyatPaketi | null;
    kampanyalar?: FiyatKampanyasi[];
    secilenKampanyaId?: string | null;
    /** Kullanıcının elle girdiği ek iskonto (%) — kampanyadan SONRA. */
    elIskontoOrani?: number;
  } = {}
): FiyatSonucu {
  const adet = Math.max(miktar, 0);
  const adimlar: string[] = [];

  const listeTutar = YUVARLA(urun.listeFiyat * adet);
  adimlar.push(`Liste fiyatı: ${urun.listeFiyat} × ${adet}`);

  // 1) Paket
  let birimFiyat = urun.listeFiyat;
  if (secenekler.paket) {
    const paketli = paketBirimFiyati(secenekler.paket, urun.urunId, urun.listeFiyat);
    if (paketli !== null) {
      birimFiyat = paketli;
      adimlar.push(`Paket fiyatı uygulandı: birim ${paketli}`);
    }
  }

  // 2) Kampanya
  const adaylar = secenekler.kampanyalar ?? [];
  let secilen: { kampanya: FiyatKampanyasi; indirim: number } | null = null;

  if (secenekler.secilenKampanyaId) {
    const k = adaylar.find((x) => x.kampanyaId === secenekler.secilenKampanyaId);
    if (k) {
      const { indirim } = kampanyaIndirimi(k, birimFiyat, adet);
      if (indirim > 0) secilen = { kampanya: k, indirim };
    }
  } else {
    secilen = enIyiKampanya(adaylar, birimFiyat, adet);
  }

  let indirimTutari = secilen?.indirim ?? 0;
  if (secilen) {
    adimlar.push(`Kampanya "${secilen.kampanya.kod}": −${secilen.indirim}`);
  }

  // 3) Elle iskonto — kampanyadan sonra, kalan tutar üzerinden.
  const araTutar = birimFiyat * adet - indirimTutari;
  const elOran = Math.min(Math.max(secenekler.elIskontoOrani ?? 0, 0), 100);
  if (elOran > 0) {
    const elIndirim = YUVARLA(araTutar * (elOran / 100));
    indirimTutari = YUVARLA(indirimTutari + elIndirim);
    adimlar.push(`Elle iskonto %${elOran}: −${elIndirim}`);
  }

  const netTutar = Math.max(YUVARLA(birimFiyat * adet - indirimTutari), 0);
  const kdvTutari = YUVARLA(netTutar * (urun.kdvOrani / 100));

  return {
    listeTutar,
    birimFiyat: YUVARLA(birimFiyat),
    netTutar,
    indirimTutari: YUVARLA(indirimTutari),
    kdvTutari,
    toplam: YUVARLA(netTutar + kdvTutari),
    kampanya: secilen?.kampanya ?? null,
    adimlar,
  };
}

/**
 * Bir kampanyanın belirli bir anda ve firmada GEÇERLİ olup olmadığı.
 *
 * Durum, tarih ve kapsam birlikte bakılır. Kapsam listeleri BOŞSA "hepsi"
 * demektir — kampanya tanımlarken her ürünü tek tek işaretlemek zorunda
 * kalmak, en sık kullanılan hâli en zahmetli hâle getirirdi.
 */
export function kampanyaGecerliMi(
  k: {
    durum: string;
    baslangic: Date;
    bitis: Date;
    kota: number;
    kullanilan: number;
    urunIdler: string[];
    paketIdler: string[];
    firmaIdler: string[];
  },
  baglam: {
    an: Date;
    firmaId?: string | null;
    urunId?: string | null;
    /** Satır bir paketten açıldıysa paketin id'si (v1.25.0 damgası). */
    paketId?: string | null;
  }
): boolean {
  if (k.durum !== "aktif") return false;
  if (baglam.an < k.baslangic || baglam.an > k.bitis) return false;
  if (k.kota > 0 && k.kullanilan >= k.kota) return false;

  if (k.firmaIdler.length > 0) {
    if (!baglam.firmaId || !k.firmaIdler.includes(baglam.firmaId)) return false;
  }

  /*
    KATALOG KAPSAMI: ürün VE paket listesi TEK bir kapsamdır (v1.26.1).

    ORTAĞIN BULGUSU: "kampanya modülünden test ettiğimde sipariş ve sevk
    ettiğimde kampanya tanımından düşmüyor." Sebep buradaydı: `paketIdler`
    toplanıyor, forma taşınıyor ve veritabanında saklanıyordu ama BU KARARDA
    HİÇ OKUNMUYORDU. Sonuçları:

      • Yalnızca PAKETE tanımlı bir kampanya "tüm ürünler" gibi davranıyordu
        — kapsam dışı satışlara indirim veriyordu.
      • Ürün + paket birlikte seçildiğinde paketten açılan satırlar kapsam
        dışı kalıyor, kampanya uygulanmıyor ve bu yüzden ONAYDA KOTA DA
        DÜŞMÜYORDU (kota yalnızca uygulanan kampanya için düşer).

    Paket kapsamı ancak v1.25.0'dan sonra sorulabilir hâle geldi: satır artık
    hangi paketten açıldığını `paketId` damgasıyla taşıyor.

    Kural: iki liste de boşsa kampanya HER kaleme açıktır ("Boş = hepsi").
    Biri doluysa satır ya o ürünlerden biri olmalı YA DA o paketlerden
    birinden açılmış olmalıdır.
  */
  const kapsamVar = k.urunIdler.length > 0 || k.paketIdler.length > 0;
  if (kapsamVar) {
    const urunUyar = Boolean(baglam.urunId && k.urunIdler.includes(baglam.urunId));
    const paketUyar = Boolean(
      baglam.paketId && k.paketIdler.includes(baglam.paketId)
    );
    if (!urunUyar && !paketUyar) return false;
  }

  return true;
}

/**
 * Bir satır için uygun kampanyaları süzer — İSTEMCİDE kullanılır.
 *
 * Katalog kapsamıyla birlikte gelir; hangi kampanyanın hangi firmaya/ürüne
 * açık olduğu kararı `kampanyaGecerliMi` ile verilir. Böylece formdaki
 * süzgeç ile sunucudaki doğrulama AYNI kuralı çalıştırır: ikisi ayrı
 * yazılsaydı, formda görünüp kaydederken düşen (ya da tersi) kampanyalar
 * çıkardı.
 */
export type KapsamliKampanya = FiyatKampanyasi & {
  baslangic: string | Date;
  bitis: string | Date;
  /** Kotası dolmuş kampanya listede görünmez. */
  tukendi: boolean;
  urunIdler: string[];
  paketIdler: string[];
  firmaIdler: string[];
};

export function satirinKampanyalari(
  katalog: KapsamliKampanya[],
  baglam: {
    firmaId?: string | null;
    urunId?: string | null;
    /** Satırın paket damgası — paket kapsamlı kampanyalar için (v1.26.1). */
    paketId?: string | null;
    an?: Date;
  }
): KapsamliKampanya[] {
  const an = baglam.an ?? new Date();
  return katalog.filter((k) =>
    !k.tukendi &&
    kampanyaGecerliMi(
      {
        durum: "aktif",
        baslangic: new Date(k.baslangic),
        bitis: new Date(k.bitis),
        // Kota kararı katalogda `tukendi` ile verildi (yukarıdaki koşul);
        // burada yeniden sorulmaz.
        kota: 0,
        kullanilan: 0,
        urunIdler: k.urunIdler,
        paketIdler: k.paketIdler,
        firmaIdler: k.firmaIdler,
      },
      {
        an,
        firmaId: baglam.firmaId,
        urunId: baglam.urunId,
        paketId: baglam.paketId,
      }
    )
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAKET SEÇİMİ (v1.25.0)

   Paket Faz 14'te tanımlanabiliyordu ama hiçbir satışa BAĞLI DEĞİLDİ:
   `paketBirimFiyati` yalnızca `/paketler` ekranındaki önizlemede
   çağrılıyordu, `SiparisKalemi.paketId` hiç yazılmıyordu ve teklifte
   sütun bile yoktu. Ortağın bulgusu: "sipariş oluştururken ürün
   seçebiliyorum ama paket seçemiyorum."

   PAKET TEK SATIR DEĞİL, KALEMLERİNE AÇILIR. Tek opak satır olsaydı
   satırın `urunId`'si boş kalırdı ve onay anındaki stok düşümü
   (`stokYeterliMi` / `siparisiOnayla` satırın ürününe bakar) SESSİZCE
   hiç çalışmazdı — paket satılır, depodan hiçbir şey düşmezdi. Kalemlere
   açmak ayrıca kısmi sevkiyatı, iadeyi ve ürün bazlı raporu da olduğu
   gibi bırakır.

   Satıra basılan `paketId` damgası "bu fiyat neden böyle?" sorusunun
   yanıtıdır: liste fiyatından farklı bir birim fiyat gördüğünde kullanıcı
   hangi paket anlaşmasından geldiğini görebilmelidir.
   ═══════════════════════════════════════════════════════════════════════ */

/** Forma verilen paket kataloğu — kapsamıyla birlikte. */
export type KapsamliPaket = Omit<FiyatPaketi, "kalemler"> & {
  kod: string;
  ad: string;
  /** null = herkese açık genel paket; dolu = yalnızca o firmaya. */
  firmaId: string | null;
  kalemler: {
    urunId: string;
    miktar: number;
    listeFiyat: number;
    /** Satır açıklaması ve birimi katalogdan gelir. */
    ad: string;
    birim: string;
    kdvOrani: number;
  }[];
};

/**
 * Firmaya sunulabilecek paketleri süzer — kampanyadaki desenin aynısı.
 *
 * Genel paketler (firmaId = null) her firmaya açıktır; firmaya özel paket
 * yalnızca o firmada görünür. Firma HENÜZ SEÇİLMEMİŞSE yalnızca genel
 * paketler listelenir: başka bir müşterinin anlaşmalı fiyatını, firma
 * seçilmediği için, herkese göstermek olurdu.
 */
export function firmaninPaketleri(
  katalog: KapsamliPaket[],
  firmaId?: string | null
): KapsamliPaket[] {
  return katalog.filter((p) => p.firmaId === null || p.firmaId === firmaId);
}

/** Paketten açılan bir sipariş/teklif satırı. */
export type PaketSatiri = {
  urunId: string;
  paketId: string;
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  kdvOrani: number;
};

/**
 * Paketi satırlara açar: her kalem KENDİ satırı olur.
 *
 * Birim fiyat `paketBirimFiyati`ndan gelir — yani sabit paket fiyatı
 * kalemlere LİSTE DEĞERİNE ORANTILI dağıtılır (Faz 14 kararı). Miktar
 * paketteki miktardır; kullanıcı sonradan değiştirebilir, satır o andan
 * sonra sıradan bir satır gibi davranır ama `paketId` damgası kalır.
 */
export function paketiKalemlereAc(paket: KapsamliPaket): PaketSatiri[] {
  return paket.kalemler.map((k) => ({
    urunId: k.urunId,
    paketId: paket.paketId,
    aciklama: `${paket.ad} — ${k.ad}`,
    miktar: k.miktar,
    birim: k.birim,
    birimFiyat: paketBirimFiyati(paket, k.urunId, k.listeFiyat) ?? k.listeFiyat,
    kdvOrani: k.kdvOrani,
  }));
}

/**
 * Satıra basılacak `paketId` damgasını doğrular — SUNUCUDA çağrılır.
 *
 * Kampanyadaki kuralın aynısı (v1.23.0): istemciden gelen bir id'ye
 * güvenilmez. Paket katalogda olmalı (yani aktif ve kiracıya ait), belgenin
 * firmasına açık olmalı (genel ya da o firmaya özel) ve satırın ÜRÜNÜ
 * paketin içinde bulunmalıdır. Aksi hâlde bir müşterinin belgesinde başka
 * bir müşterinin anlaşma adı görünebilirdi.
 */
export function paketDamgasiGecerliMi(
  katalog: KapsamliPaket[],
  paketId: string,
  baglam: { firmaId?: string | null; urunId?: string | null }
): boolean {
  const paket = katalog.find((p) => p.paketId === paketId);
  if (!paket) return false;
  if (paket.firmaId !== null && paket.firmaId !== baglam.firmaId) return false;
  if (!baglam.urunId) return false;
  return paket.kalemler.some((k) => k.urunId === baglam.urunId);
}

/* ═══════════════════════════════════════════════════════════════════════
   PAKET BİR BÜTÜNDÜR (v1.27.0)

   ORTAĞIN BULGUSU: "Kampanyada paket fiyatı 1000 TL atandı; paketteki
   ürünlerden biri 4000, biri 5000 TL. Kampanya ÜRÜN BAZINDA uygulandığı
   için ikisi de 1000'er TL'den hesaplanıyor ve paket 1000 yerine 2000 TL
   oluyor. Paket seçince ayrı davranmalı."

   v1.25.0 paketi satırlara açtı — bu STOK İÇİN doğruydu (satırın `urunId`si
   olmadan onayda stok düşmez). Ama fiyat da satır satır hesaplanınca paket,
   ürünlerin toplamına indi: "paket fiyatı" kampanyası her satıra ayrı ayrı
   uygulandı.

   ÇÖZÜM: satırlar KALIR (stok, kısmi sevkiyat, ürün raporu bozulmaz) ama
   fiyat PAKET DÜZEYİNDE hesaplanır ve satırlara PAY EDİLİR:

     1. Bir paketin brüt birim fiyatı = Σ (satır birim fiyatı × paketteki
        adedi). Kullanıcı satır fiyatını değiştirirse bu da değişir.
     2. Kampanya, bu "paket birim fiyatı" ve PAKET ADEDİ ile hesaplanır —
        yani `kampanyaIndirimi` aynen kullanılır, yalnızca ürün yerine paketi
        birim kabul eder. Böylece bütün kampanya tipleri kendiliğinden doğru
        anlama gelir:
          • paketfiyat → `deger` BİR PAKETİN fiyatıdır (ortağın beklediği)
          • yuzde      → paketin tamamına yüzde
          • tutar      → paketin tamamından sabit tutar
          • alnodem    → "3 paket al 2 öde"
     3. İndirim, satırlara brüt paylarıyla ORANTILI dağıtılır; toplamı grubun
        indirimine eşittir (kuruş farkı son satırda kapatılır).

   KOTA DA PAKET SAYAR: 1 paket 1 hak düşer, içindeki ürün sayısı kadar
   değil. `kullanilanAdet` bu yüzden paket cinsindendir.
   ═══════════════════════════════════════════════════════════════════════ */

/** Paket grubundaki bir satır — miktar PAKET BAŞINA adettir. */
export type PaketGrubuSatiri = {
  urunId: string;
  /** Bir pakette kaç adet bulunduğu (paket tanımından gelir). */
  birimMiktar: number;
  birimFiyat: number;
  kdvOrani: number;
};

export type PaketGrubuSonucu = {
  /** Bir paketin indirimsiz bedeli. */
  paketBirimFiyati: number;
  brut: number;
  indirimTutari: number;
  netTutar: number;
  kdvTutari: number;
  toplam: number;
  kampanya: FiyatKampanyasi | null;
  /** Kampanyadan kaç PAKET yararlandı — kota bu kadar düşer. */
  kullanilanPaket: number;
  satirlar: {
    urunId: string;
    /** Gerçek sipariş miktarı: paket adedi × paketteki adet. */
    miktar: number;
    birimFiyat: number;
    /** Satıra düşen indirim payı. */
    indirimTutari: number;
    /** KDV hariç net. */
    tutar: number;
    kdvTutari: number;
  }[];
};

export function paketGrubuHesapla(
  satirlar: PaketGrubuSatiri[],
  paketAdedi: number,
  kampanya?: FiyatKampanyasi | null
): PaketGrubuSonucu {
  const adet = Math.max(paketAdedi, 0);

  // 1) Bir paketin bedeli — satır fiyatları elle değiştirilmiş olabilir.
  const paketBirim = satirlar.reduce(
    (s, k) => s + k.birimFiyat * k.birimMiktar,
    0
  );
  const brut = YUVARLA(paketBirim * adet);

  // 2) Kampanya PAKET biriminden hesaplanır — `kampanyaIndirimi` aynen.
  let indirim = 0;
  let uygulanan: FiyatKampanyasi | null = null;
  let kullanilanPaket = 0;
  if (kampanya && adet > 0 && paketBirim > 0) {
    const sonuc = kampanyaIndirimi(kampanya, paketBirim, adet);
    if (sonuc.indirim > 0) {
      indirim = Math.min(sonuc.indirim, brut);
      uygulanan = kampanya;
      kullanilanPaket = sonuc.kullanilanAdet;
    }
  }

  /*
    3) İndirimi satırlara brüt paylarıyla dağıt. Eşit bölmek yanlış olurdu:
    4000 TL'lik ürünle 5000 TL'lik ürün aynı indirimi almamalı — iade ve
    kısmi sevkiyatta rakam saçmalardı (paketBirimFiyati'ndaki gerekçe).

    Kuruş artığı SON satırda kapatılır; aksi hâlde satır toplamları grubun
    toplamını tutmaz ve belge kendi içinde çelişirdi.
  */
  const cikti: PaketGrubuSonucu["satirlar"] = [];
  let dagitilan = 0;

  satirlar.forEach((k, i) => {
    const miktar = k.birimMiktar * adet;
    const satirBrut = YUVARLA(k.birimFiyat * miktar);
    const sonMu = i === satirlar.length - 1;

    const pay = sonMu
      ? YUVARLA(indirim - dagitilan)
      : brut > 0
        ? YUVARLA((indirim * satirBrut) / brut)
        : 0;
    dagitilan = YUVARLA(dagitilan + pay);

    const net = Math.max(YUVARLA(satirBrut - pay), 0);
    cikti.push({
      urunId: k.urunId,
      miktar,
      birimFiyat: k.birimFiyat,
      indirimTutari: pay,
      tutar: net,
      kdvTutari: YUVARLA(net * (k.kdvOrani / 100)),
    });
  });

  const netTutar = YUVARLA(cikti.reduce((s, k) => s + k.tutar, 0));
  const kdvTutari = YUVARLA(cikti.reduce((s, k) => s + k.kdvTutari, 0));

  return {
    paketBirimFiyati: YUVARLA(paketBirim),
    brut,
    indirimTutari: YUVARLA(indirim),
    netTutar,
    kdvTutari,
    toplam: YUVARLA(netTutar + kdvTutari),
    kampanya: uygulanan,
    kullanilanPaket,
    satirlar: cikti,
  };
}

/**
 * Kampanya kotasından kaç hak düşeceğini hesaplar — SAF (v1.27.0).
 *
 * PAKET BİR HAK DÜŞER, İÇİNDEKİ ÜRÜN SAYISI KADAR DEĞİL. İki ürünlü bir
 * paketten 1 adet satmak eskiden 2 hak düşürüyordu; oysa kotanın anlamı
 * "bu kampanyadan kaç paket verilebilir"dir.
 *
 * Kural:
 *   • Aynı (kampanya + paket) çiftinin satırları TEK kullanımdır; adet
 *     PAKET adedidir, indirim satır paylarının toplamıdır.
 *   • Pakete ait olmayan satırlar eskisi gibi kendi miktarıyla düşer.
 *
 * Onayda ve iptalde AYNI fonksiyon kullanılır: düşülen ile iade edilen
 * ayrışırsa kota sessizce kayar.
 */
export function kotaKullanimlari(
  kalemler: {
    kampanyaId: string | null;
    paketId?: string | null;
    paketAdedi?: number | null;
    miktar: number;
    indirimTutari?: number;
  }[]
): { kampanyaId: string; adet: number; indirimTutari: number }[] {
  const gruplar = new Map<
    string,
    { kampanyaId: string; adet: number; indirimTutari: number }
  >();
  const cikti: { kampanyaId: string; adet: number; indirimTutari: number }[] = [];

  for (const k of kalemler) {
    if (!k.kampanyaId) continue;
    const indirim = k.indirimTutari ?? 0;

    if (!k.paketId) {
      cikti.push({
        kampanyaId: k.kampanyaId,
        adet: k.miktar,
        indirimTutari: indirim,
      });
      continue;
    }

    const anahtar = `${k.kampanyaId}::${k.paketId}`;
    const varOlan = gruplar.get(anahtar);
    if (varOlan) {
      // Adet zaten paket cinsinden; grubun ilk satırından alınır.
      varOlan.indirimTutari = YUVARLA(varOlan.indirimTutari + indirim);
    } else {
      gruplar.set(anahtar, {
        kampanyaId: k.kampanyaId,
        adet: Math.max(k.paketAdedi ?? 1, 1),
        indirimTutari: indirim,
      });
    }
  }

  return [...cikti, ...gruplar.values()];
}
