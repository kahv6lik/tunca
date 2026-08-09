/**
 * Firma özeti — Faz 21 / G2 (saf).
 *
 * ÖZET ÖNCE VERİDEN YAZILIR, SONRA (isteğe bağlı) MODELE AKICILAŞTIRILIR.
 *
 * Gerekçe: özet bir dil modeli olmadan da işe yaramalıdır. Anahtarı olmayan
 * ya da AI'ı kapatmış bir kuruluş, "bu müşteriyle son altı ayda ne oldu"
 * sorusunun yanıtsız kalmasını hak etmiyor. Bu yüzden burada üretilen
 * cümleler ÜRÜNÜN KENDİSİDİR; model açıksa aynı cümleler ona bir paragraf
 * hâline getirilmek üzere verilir.
 *
 * Bunun ikinci bir faydası var: modele gönderilen metin BURADA üretildiği
 * için ne gönderildiği tam olarak bilinir ve kullanıcıya gösterilebilir
 * (`ai-tanimlar.ts` → OZET_ALANLARI). "Firmanın verisi gönderiliyor" gibi
 * belirsiz bir cümle vermek zorunda kalmıyoruz.
 *
 * `server-only` DEĞİLDİR: testler veritabanı olmadan doğrudan sınar.
 */

export type OzetGirdisi = {
  ad: string;
  sektor: string | null;
  il: string | null;
  firsatlar: { baslik: string; durum: string; tutar: number }[];
  teklifler: { no: string; durum: string; toplam: number }[];
  siparisler: { no: string; durum: string; toplam: number }[];
  destekler: { baslik: string; durum: string; oncelik: string }[];
  sonAktiviteler: { tur: string; baslik: string; gunOnce: number }[];
  /** Para birimi tek tutulur; karışık kur özet cümlesini anlamsızlaştırır. */
  paraBirimi: string;
};

export type OzetSatiri = { baslik: string; metin: string };

function paraMetni(tutar: number, birim: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: birim,
    maximumFractionDigits: 0,
  }).format(tutar);
}

function sayiMetni(n: number, tekil: string, cogul = tekil): string {
  return `${n} ${n === 1 ? tekil : cogul}`;
}

/**
 * Veriden Türkçe özet satırları üretir.
 *
 * Boş bölüm CÜMLE ÜRETMEZ: "0 teklif var" demek, okuyanın gözünü yoran ve
 * hiçbir şey söylemeyen bir satırdır. Hiç veri yoksa tek bir dürüst cümle
 * döner.
 */
export function ozetSatirlari(g: OzetGirdisi): OzetSatiri[] {
  const satirlar: OzetSatiri[] = [];

  const kunye = [g.sektor, g.il].filter(Boolean).join(" · ");
  if (kunye) satirlar.push({ baslik: "Künye", metin: kunye });

  // ── Satış hattı ──
  const acik = g.firsatlar.filter((f) => f.durum === "acik");
  const kazanilan = g.firsatlar.filter((f) => f.durum === "kazanildi");
  const kaybedilen = g.firsatlar.filter((f) => f.durum === "kaybedildi");
  if (g.firsatlar.length > 0) {
    const parcalar: string[] = [];
    if (acik.length > 0) {
      const tutar = acik.reduce((s, f) => s + f.tutar, 0);
      parcalar.push(
        `${sayiMetni(acik.length, "açık fırsat")} (${paraMetni(tutar, g.paraBirimi)})`
      );
    }
    if (kazanilan.length > 0) parcalar.push(`${kazanilan.length} kazanılmış`);
    if (kaybedilen.length > 0) parcalar.push(`${kaybedilen.length} kaybedilmiş`);
    satirlar.push({ baslik: "Satış hattı", metin: parcalar.join(", ") });
  }

  // ── Teklifler ──
  if (g.teklifler.length > 0) {
    const bekleyen = g.teklifler.filter((t) =>
      ["taslak", "gonderildi", "revizyon"].includes(t.durum)
    );
    const kabul = g.teklifler.filter((t) => t.durum === "kabul");
    const parcalar = [`${sayiMetni(g.teklifler.length, "teklif")}`];
    if (bekleyen.length > 0) parcalar.push(`${bekleyen.length}'i yanıt bekliyor`);
    if (kabul.length > 0) parcalar.push(`${kabul.length}'i kabul edilmiş`);
    satirlar.push({ baslik: "Teklifler", metin: parcalar.join(", ") });
  }

  // ── Siparişler ── ciro yalnızca ONAYLANMIŞ siparişten sayılır (Faz 18).
  if (g.siparisler.length > 0) {
    const onayli = g.siparisler.filter((s) =>
      ["onaylandi", "hazirlaniyor", "sevkedildi", "teslim"].includes(s.durum)
    );
    const bekleyen = g.siparisler.filter((s) => s.durum === "onaybekliyor");
    const ciro = onayli.reduce((s, x) => s + x.toplam, 0);
    const parcalar = [`${sayiMetni(g.siparisler.length, "sipariş")}`];
    if (ciro > 0) parcalar.push(`onaylanmış tutar ${paraMetni(ciro, g.paraBirimi)}`);
    if (bekleyen.length > 0) parcalar.push(`${bekleyen.length}'i onay bekliyor`);
    satirlar.push({ baslik: "Siparişler", metin: parcalar.join(", ") });
  }

  // ── Destek ── açık kayıt bir İŞ YÜKÜDÜR, kapanmışlar sayılmaz.
  if (g.destekler.length > 0) {
    const acikDestek = g.destekler.filter(
      (d) => !["cozuldu", "kapandi"].includes(d.durum)
    );
    const acil = acikDestek.filter((d) => ["acil", "yuksek"].includes(d.oncelik));
    const parcalar = [`${sayiMetni(g.destekler.length, "destek kaydı")}`];
    if (acikDestek.length > 0) parcalar.push(`${acikDestek.length}'i açık`);
    if (acil.length > 0) parcalar.push(`${acil.length}'i yüksek öncelikli`);
    satirlar.push({ baslik: "Destek", metin: parcalar.join(", ") });
  }

  // ── Son temas ── satışın en somut sinyali.
  if (g.sonAktiviteler.length > 0) {
    const son = g.sonAktiviteler[0];
    const ne =
      son.gunOnce === 0
        ? "bugün"
        : son.gunOnce === 1
          ? "dün"
          : `${son.gunOnce} gün önce`;
    satirlar.push({
      baslik: "Son temas",
      metin: `${ne} · ${son.baslik}`,
    });
  } else {
    satirlar.push({
      baslik: "Son temas",
      metin: "Kayıtlı aktivite yok",
    });
  }

  if (satirlar.length === 0) {
    satirlar.push({
      baslik: "Durum",
      metin: "Bu firmada henüz özetlenecek bir hareket yok.",
    });
  }

  return satirlar;
}

/**
 * Modele gönderilecek istem.
 *
 * İstem SADECE yukarıda üretilen satırlardan kurulur — ham kayıtlar
 * gönderilmez. Model burada bir ANLATICI'dır, bir analistin yerine geçmez:
 * kendi rakamını üretmesi ya da veri hakkında tahmin yürütmesi açıkça
 * yasaklanır, çünkü uydurulmuş bir rakam CRM'de yanlış karar demektir.
 */
export const OZET_SISTEM_ISTEMI =
  "Sen bir CRM asistanısın. Sana verilen maddeleri Türkçe, akıcı ve kısa " +
  "bir paragrafa dönüştür. KURALLAR: (1) Yalnızca verilen bilgileri kullan, " +
  "hiçbir rakam ekleme, çıkarma veya tahmin etme. (2) Yorum veya tavsiye " +
  "verme, yalnızca durumu anlat. (3) En fazla dört cümle yaz. " +
  "(4) Madde işareti kullanma, düz paragraf yaz.";

export function ozetIstemi(firmaAd: string, satirlar: OzetSatiri[]): string {
  const govde = satirlar.map((s) => `- ${s.baslik}: ${s.metin}`).join("\n");
  return `Firma: ${firmaAd}\n\n${govde}`;
}
