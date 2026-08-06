/**
 * İş akışı TANIMLARI — Faz 8 / D2.
 *
 * `yetki-tanimlar.ts` ile aynı gerekçe: bu dosya `server-only` DEĞİLDİR ve
 * hiçbir şeye bağımlı değildir; hem motor (`is-akisi.ts`), hem kural
 * ekranındaki istemci bileşeni, hem de testler aynı listeyi kullanır.
 */

export const TETIKLEYICILER = [
  {
    deger: "gorev.yaklasti",
    etiket: "Görevin son tarihi yaklaştı",
    aciklama: "Belirtilen gün kadar kala görevin sahibine haber verilir.",
    ayar: "gun",
  },
  {
    deger: "gorev.gecikti",
    etiket: "Görev gecikti",
    aciklama: "Son tarihi geçmiş ve hâlâ açık görevler için haber verilir.",
    ayar: null,
  },
  {
    deger: "firsat.beklemede",
    etiket: "Fırsat hareketsiz kaldı",
    aciklama:
      "Belirtilen gün boyunca güncellenmemiş açık fırsatların sorumlusuna haber verilir.",
    ayar: "gun",
  },
  {
    deger: "teklif.suresiDoluyor",
    etiket: "Teklifin geçerliliği doluyor",
    aciklama: "Geçerlilik tarihine belirtilen gün kala haber verilir.",
    ayar: "gun",
  },
] as const;

export type TetikleyiciTuru = (typeof TETIKLEYICILER)[number]["deger"];

export const EYLEMLER = [
  { deger: "bildirim", etiket: "Bildirim gönder (uygulama içi + e-posta)" },
  { deger: "gorev", etiket: "Takip görevi oluştur" },
] as const;

export type Eylem = {
  tur: "bildirim" | "gorev";
  baslik?: string;
  mesaj?: string;
  /** Görev eylemi için: kaç gün sonrasına açılsın. */
  gun?: number;
};

