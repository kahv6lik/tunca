/**
 * Doğal dilde sorgu — Faz 21 / G3 (saf).
 *
 * KURAL: MODELE VERİ GİTMEZ, MODELDEN VERİ GELMEZ.
 *
 * Model (açıksa) yalnızca kullanıcının cümlesini ve buradaki alan
 * sözlüğünü görür; ürettiği tek şey bir SÜZGEÇTİR. Sorguyu her zaman
 * uygulama çalıştırır, yani kiracı katmanı, RLS ve izinler olduğu gibi
 * yerinde kalır. Modelin "İzmir'deki firmaları listele" demesi ile
 * kullanıcının süzgeci elle doldurması arasında sistem açısından hiçbir
 * fark yoktur.
 *
 * MODEL OLMADAN DA ÇALIŞIR: aşağıdaki kural tabanlı ayrıştırıcı,
 * "İzmir'deki onaylanmış hibeler" gibi tipik cümleleri anahtarsız çözer.
 * Model açıkken aynı sözlükle daha esnek cümleler de çözülebilir; iki yol
 * da AYNI doğrulamadan geçer (`sorguDogrula`) — modelden gelen bir süzgeç
 * asla ayrıcalıklı değildir.
 *
 * `server-only` DEĞİLDİR: testler veritabanı olmadan doğrudan sınar.
 */

import { SEKTORLER } from "./constants";
import { IL_ILCE } from "./tr-iller";

/** Sorgunun gidebileceği listeler ve kabul ettikleri süzgeç anahtarları. */
export type SorguHedefi = {
  anahtar: string;
  etiket: string;
  rota: string;
  izin: string;
  /** Bu listede geçerli olan querystring anahtarları — BEYAZ LİSTE. */
  alanlar: string[];
};

export const SORGU_HEDEFLERI: SorguHedefi[] = [
  {
    anahtar: "firmalar",
    etiket: "Firmalar",
    rota: "/firmalar",
    izin: "firma.goruntule",
    alanlar: ["ara", "il", "durum", "sektor"],
  },
  {
    anahtar: "yatirim",
    etiket: "Yatırım destekleri",
    rota: "/yatirim-destekleri",
    izin: "yatirim.goruntule",
    alanlar: ["ara", "durum", "tur"],
  },
  {
    anahtar: "firsatlar",
    etiket: "Fırsatlar",
    rota: "/firsatlar",
    izin: "firsat.goruntule",
    alanlar: ["ara", "durum", "gorunum"],
  },
  {
    anahtar: "teklifler",
    etiket: "Teklifler",
    rota: "/teklifler",
    izin: "teklif.goruntule",
    alanlar: ["ara", "durum"],
  },
  {
    anahtar: "siparisler",
    etiket: "Siparişler",
    rota: "/siparisler",
    izin: "siparis.goruntule",
    alanlar: ["ara", "durum", "bas", "bit"],
  },
  {
    anahtar: "destek",
    etiket: "Destek kayıtları",
    rota: "/destek",
    izin: "destek.goruntule",
    alanlar: ["ara", "durum", "oncelik", "kanal"],
  },
];

export function sorguHedefi(anahtar: string): SorguHedefi | undefined {
  return SORGU_HEDEFLERI.find((h) => h.anahtar === anahtar);
}

export type SorguSonucu = {
  hedef: string;
  suzgec: Record<string, string>;
  /** Kullanıcıya "ne anladım" diye gösterilecek cümle. */
  aciklama: string;
};

/** Türkçe duyarsız karşılaştırma için normalize. */
function nrm(s: string): string {
  return s.toLocaleLowerCase("tr").trim();
}

/**
 * Hedef listeyi cümledeki anahtar kelimelerden seçer.
 *
 * Sıra ÖNEMLİDİR: "teklif" kelimesi hem tekliflerde hem fırsatlarda geçer;
 * daha özgül olan önce denenir.
 */
const HEDEF_IPUCLARI: { hedef: string; kelimeler: string[] }[] = [
  { hedef: "destek", kelimeler: ["destek", "ticket", "arıza", "şikayet", "şikâyet"] },
  { hedef: "siparisler", kelimeler: ["sipariş", "siparis"] },
  { hedef: "teklifler", kelimeler: ["teklif"] },
  { hedef: "yatirim", kelimeler: ["hibe", "teşvik", "tesvik", "kredi", "yatırım", "yatirim", "destek programı"] },
  { hedef: "firsatlar", kelimeler: ["fırsat", "firsat", "anlaşma", "deal", "satış hattı"] },
  { hedef: "firmalar", kelimeler: ["firma", "müşteri", "musteri", "şirket", "sirket"] },
];

/** Durum kelimeleri — hedefe göre farklı anahtarlara çevrilir. */
const DURUM_IPUCLARI: Record<string, { kelimeler: string[]; deger: string }[]> = {
  firmalar: [
    { kelimeler: ["aktif"], deger: "aktif" },
    { kelimeler: ["pasif"], deger: "pasif" },
  ],
  yatirim: [
    { kelimeler: ["onaylanmış", "onaylanmis", "onaylı", "onayli"], deger: "onaylandi" },
    { kelimeler: ["reddedilmiş", "reddedilen", "red"], deger: "reddedildi" },
    { kelimeler: ["tamamlanmış", "tamamlanan", "biten"], deger: "tamamlandi" },
    { kelimeler: ["başvurulmuş", "başvurulan", "basvuru"], deger: "basvuruldu" },
  ],
  firsatlar: [
    { kelimeler: ["kazanılmış", "kazanılan", "kazanilan"], deger: "kazanildi" },
    { kelimeler: ["kaybedilmiş", "kaybedilen", "kaybettiğimiz"], deger: "kaybedildi" },
    { kelimeler: ["açık", "acik", "devam eden"], deger: "acik" },
  ],
  teklifler: [
    { kelimeler: ["kabul edilmiş", "kabul edilen", "kabul"], deger: "kabul" },
    { kelimeler: ["gönderilmiş", "gönderilen", "gonderilen"], deger: "gonderildi" },
    { kelimeler: ["taslak"], deger: "taslak" },
    { kelimeler: ["reddedilmiş", "reddedilen"], deger: "red" },
  ],
  siparisler: [
    { kelimeler: ["onay bekleyen", "onay bekliyor", "bekleyen"], deger: "onaybekliyor" },
    { kelimeler: ["onaylanmış", "onaylanan", "onaylı"], deger: "onaylandi" },
    { kelimeler: ["sevk edilmiş", "sevk edilen", "sevkedilen"], deger: "sevkedildi" },
    { kelimeler: ["teslim edilmiş", "teslim edilen", "teslim"], deger: "teslim" },
    { kelimeler: ["iptal"], deger: "iptal" },
  ],
  destek: [
    { kelimeler: ["açık", "acik"], deger: "acik" },
    { kelimeler: ["çözülmüş", "çözülen", "cozulen"], deger: "cozuldu" },
    { kelimeler: ["kapanmış", "kapanan", "kapali", "kapalı"], deger: "kapandi" },
    { kelimeler: ["beklemede"], deger: "beklemede" },
    { kelimeler: ["işlemde", "islemde"], deger: "islemde" },
  ],
};

const YATIRIM_TUR_IPUCLARI: { kelimeler: string[]; deger: string }[] = [
  { kelimeler: ["hibe"], deger: "Hibe" },
  { kelimeler: ["teşvik", "tesvik"], deger: "Teşvik" },
  { kelimeler: ["kredi"], deger: "Kredi" },
];

const ONCELIK_IPUCLARI: { kelimeler: string[]; deger: string }[] = [
  { kelimeler: ["acil"], deger: "acil" },
  { kelimeler: ["yüksek öncelikli", "yuksek oncelikli", "yüksek öncelik"], deger: "yuksek" },
  { kelimeler: ["düşük öncelikli", "dusuk oncelikli"], deger: "dusuk" },
];

/**
 * Cümleden il adını çıkarır.
 *
 * "İzmir'deki", "İzmirdeki", "İzmir'de" hepsi eşleşir: ek ayıklamak yerine
 * il adının cümlede GEÇMESİ aranır — Türkçe ek çeşitliliğini kural yazarak
 * kovalamak, her yeni ek için yeni bir hata demektir.
 */
function ilBul(metin: string): string | null {
  const m = nrm(metin);
  // Uzun il adları önce denenir ("Afyonkarahisar" içinde "Afyon" geçmesin).
  const iller = Object.keys(IL_ILCE).sort((a, b) => b.length - a.length);
  for (const il of iller) {
    if (m.includes(nrm(il))) return il;
  }
  return null;
}

function sektorBul(metin: string): string | null {
  const m = nrm(metin);
  const liste = [...SEKTORLER].sort((a, b) => b.length - a.length);
  for (const s of liste) {
    if (m.includes(nrm(s))) return s;
  }
  return null;
}

function ipucuEslestir(
  metin: string,
  ipuclari: { kelimeler: string[]; deger: string }[]
): string | null {
  const m = nrm(metin);
  for (const i of ipuclari) {
    if (i.kelimeler.some((k) => m.includes(nrm(k)))) return i.deger;
  }
  return null;
}

/**
 * Kural tabanlı ayrıştırıcı — model olmadan çalışır.
 *
 * Hedef bulunamazsa `null` döner: yanlış bir listeye götürmektense hiçbir
 * şey yapmamak doğrudur. Kullanıcı "ne demek istediğini anlayamadım" der ve
 * elle süzer; ona yanlış bir liste gösterip doğru sanmasına izin vermek çok
 * daha kötüdür.
 */
export function sorguCoz(cumle: string): SorguSonucu | null {
  const metin = cumle.trim();
  if (metin.length < 3) return null;
  const m = nrm(metin);

  const hedefIpucu = HEDEF_IPUCLARI.find((h) =>
    h.kelimeler.some((k) => m.includes(nrm(k)))
  );
  if (!hedefIpucu) return null;

  const hedef = sorguHedefi(hedefIpucu.hedef);
  if (!hedef) return null;

  const suzgec: Record<string, string> = {};
  const anlatim: string[] = [];

  if (hedef.alanlar.includes("il")) {
    const il = ilBul(metin);
    if (il) {
      suzgec.il = il;
      anlatim.push(`il: ${il}`);
    }
  }

  if (hedef.alanlar.includes("sektor")) {
    const sektor = sektorBul(metin);
    if (sektor) {
      suzgec.sektor = sektor;
      anlatim.push(`sektör: ${sektor}`);
    }
  }

  if (hedef.alanlar.includes("durum")) {
    const durum = ipucuEslestir(metin, DURUM_IPUCLARI[hedef.anahtar] ?? []);
    if (durum) {
      suzgec.durum = durum;
      anlatim.push(`durum: ${durum}`);
    }
  }

  if (hedef.alanlar.includes("tur")) {
    const tur = ipucuEslestir(metin, YATIRIM_TUR_IPUCLARI);
    if (tur) {
      suzgec.tur = tur;
      anlatim.push(`tür: ${tur}`);
    }
  }

  if (hedef.alanlar.includes("oncelik")) {
    const oncelik = ipucuEslestir(metin, ONCELIK_IPUCLARI);
    if (oncelik) {
      suzgec.oncelik = oncelik;
      anlatim.push(`öncelik: ${oncelik}`);
    }
  }

  // Fırsatlarda durum süzgeci yalnızca LİSTE görünümünde geçerlidir
  // (kanban zaten yalnızca açıkları gösterir — Faz 6 kararı).
  if (hedef.anahtar === "firsatlar" && suzgec.durum) {
    suzgec.gorunum = "liste";
  }

  return {
    hedef: hedef.anahtar,
    suzgec,
    aciklama:
      anlatim.length > 0
        ? `${hedef.etiket} · ${anlatim.join(", ")}`
        : `${hedef.etiket} (süzgeç yok)`,
  };
}

/**
 * Süzgeci DOĞRULAR ve querystring'e çevirir.
 *
 * Modelden gelen süzgeç de, kural ayrıştırıcısından gelen de buradan geçer:
 * tanımlı olmayan hedef reddedilir, beyaz listede olmayan alan SESSİZCE
 * ATILIR (Faz 11'deki `oa_*` ve Faz 18'deki querystring kuralının aynısı).
 * Böylece modelin uydurduğu bir alan adı sorguya asla giremez.
 */
export function sorguDogrula(
  ham: { hedef?: unknown; suzgec?: unknown },
  izinler: Set<string>
): { hedef: SorguHedefi; qs: string } | null {
  if (typeof ham.hedef !== "string") return null;
  const hedef = sorguHedefi(ham.hedef);
  if (!hedef) return null;
  if (!izinler.has(hedef.izin)) return null;

  const qs = new URLSearchParams();
  const suzgec = ham.suzgec;
  if (suzgec && typeof suzgec === "object") {
    for (const [k, v] of Object.entries(suzgec as Record<string, unknown>)) {
      if (!hedef.alanlar.includes(k)) continue;
      if (typeof v !== "string" || !v.trim()) continue;
      qs.set(k, v.trim().slice(0, 100));
    }
  }

  return { hedef, qs: qs.toString() };
}

/** Doğrulanmış sorgunun gideceği adres. */
export function sorguAdresi(hedef: SorguHedefi, qs: string): string {
  return qs ? `${hedef.rota}?${qs}` : hedef.rota;
}

/**
 * Modele verilen sistem istemi.
 *
 * Sözlük istemin İÇİNE yazılır ki model uydurma alan adı üretmesin; yine de
 * üretirse `sorguDogrula` atar. İki katman da vardır çünkü ilki iyi niyete,
 * ikincisi koda dayanır.
 */
export function sorguSistemIstemi(): string {
  const sozluk = SORGU_HEDEFLERI.map(
    (h) => `- ${h.anahtar}: ${h.etiket} (alanlar: ${h.alanlar.join(", ")})`
  ).join("\n");

  return (
    "Sen bir CRM arama yardımcısısın. Kullanıcının Türkçe cümlesini bir " +
    "listeye ve süzgeçlere çevir.\n\n" +
    "Hedef listeler ve kabul ettikleri alanlar:\n" +
    sozluk +
    "\n\nYALNIZCA şu biçimde geçerli JSON döndür, başka hiçbir şey yazma:\n" +
    '{"hedef":"<liste anahtarı>","suzgec":{"<alan>":"<değer>"}}\n\n' +
    "Kurallar: Listede olmayan alan adı UYDURMA. Emin olmadığın süzgeci " +
    'BOŞ BIRAK. Cümleyi hiçbir listeye bağlayamıyorsan {"hedef":""} döndür. ' +
    "Serbest metin araması için 'ara' alanını kullan."
  );
}

/** Modelin döndürdüğü metinden JSON'u ayıklar. */
export function jsonAyikla(metin: string): { hedef?: unknown; suzgec?: unknown } | null {
  const bas = metin.indexOf("{");
  const son = metin.lastIndexOf("}");
  if (bas < 0 || son <= bas) return null;
  try {
    return JSON.parse(metin.slice(bas, son + 1)) as {
      hedef?: unknown;
      suzgec?: unknown;
    };
  } catch {
    return null;
  }
}
