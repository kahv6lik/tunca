/**
 * İlişkili kayıt zinciri — Faz 20 / U4 (saf).
 *
 * Ortağın bulgusu: "bu sipariş hangi tekliften çıktı, o teklif hangi fırsata
 * aitti, malı gönderdik mi?" — dört ekranda dört ayrı arama demekti.
 *
 * Zincir TEK YÖNLÜ ve SABİT sıralıdır:
 *
 *     fırsat → teklif → sipariş → sevkiyat
 *
 * Bu sıra iş akışının kendisidir (Faz 6 → 7 → 15): fırsat niyet, teklif
 * öneri, sipariş taahhüt, sevkiyat teslimdir. Zincirin bir halkası boş
 * olabilir (teklifsiz açılan sipariş gibi) — boş halka GİZLENMEZ, "yok"
 * olarak gösterilir; kullanıcı eksik olanı da görmelidir.
 *
 * `server-only` DEĞİLDİR: sunucu bileşeni, zincir kurucusu ve testler aynı
 * listeyi okur.
 */

export type ZincirTuru = "firsat" | "teklif" | "siparis" | "sevkiyat";

export type ZincirAdimi = {
  tur: ZincirTuru;
  etiket: string;
  izin: string;
  /** Kayda gidecek adresin öneki; `null` ise halka tıklanabilir değildir. */
  rota: string | null;
};

export const ZINCIR: ZincirAdimi[] = [
  // Fırsatın kendi detay sayfası yoktur (kanban ekranıdır); bu yüzden
  // halkası bilgi verir ama bir kayda değil listeye götürür.
  { tur: "firsat", etiket: "Fırsat", izin: "firsat.goruntule", rota: null },
  { tur: "teklif", etiket: "Teklif", izin: "teklif.goruntule", rota: "/teklifler" },
  { tur: "siparis", etiket: "Sipariş", izin: "siparis.goruntule", rota: "/siparisler" },
  // Sevkiyatın detay sayfası yok; kuyruk ekranı siparişe göre süzülür.
  { tur: "sevkiyat", etiket: "Sevkiyat", izin: "sevkiyat.goruntule", rota: null },
];

export type ZincirHalkasi = {
  tur: ZincirTuru;
  etiket: string;
  /** Kaydın kısa adı (no / başlık) — halka boşsa `null`. */
  baslik: string | null;
  /** Durum rozeti için anahtar. */
  durum: string | null;
  adres: string | null;
  /** Şu an bakılan kayıt bu halka mı? */
  aktif: boolean;
  /** İzin yoksa halka "gizli" işaretlenir: içeriği hiç sorgulanmaz. */
  izinsiz: boolean;
};

/** Zincirdeki bir türün sırası — kıyaslama ve testler için. */
export function zincirSirasi(tur: string): number {
  return ZINCIR.findIndex((z) => z.tur === tur);
}

export function zincirAdimi(tur: string): ZincirAdimi | undefined {
  return ZINCIR.find((z) => z.tur === tur);
}

/**
 * Zincirin gösterilmeye değer olup olmadığı.
 *
 * Bakılan kaydın kendisinden başka hiçbir halka doluysa değmez: tek başına
 * bir kutu çizmek ekranda yer kaplar, bilgi vermez.
 */
export function zincirAnlamliMi(halkalar: ZincirHalkasi[]): boolean {
  return halkalar.filter((h) => h.baslik !== null).length > 1;
}
