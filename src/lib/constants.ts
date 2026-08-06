// Uygulama genelinde kullanılan durum ve tür sabitleri

export const FIRMA_DURUM = ["aktif", "pasif"] as const;

// Firma formunda hazır gelen sektörler ("Diğer" seçilirse elle yazılır)
export const SEKTORLER = [
  "Tekstil",
  "Gıda",
  "Otomotiv",
  "Otomotiv Yan Sanayi",
  "Makine",
  "İnşaat",
  "Kimya",
  "Elektronik",
  "Mobilya",
  "Lojistik ve Taşımacılık",
  "Turizm",
  "Tarım ve Hayvancılık",
  "Enerji",
  "Sağlık",
  "Yazılım ve Bilişim",
  "Metal ve Metalurji",
  "Plastik ve Kauçuk",
  "Ambalaj",
  "Kozmetik",
  "Savunma Sanayi",
  "Eğitim",
  "Perakende",
  "Madencilik",
  "Tekstil ve Konfeksiyon",
] as const;

export const DIGER_SEKTOR = "Diğer";

export const YATIRIM_DURUM = [
  "basvuruldu",
  "onaylandi",
  "reddedildi",
  "tamamlandi",
] as const;

export const YATIRIM_TUR = ["Hibe", "Teşvik", "Kredi", "Diğer"] as const;

export const EGITIM_DURUM = ["planlandi", "tamamlandi", "iptal"] as const;

export const HIZMET_DURUM = ["devam", "tamamlandi", "iptal"] as const;

export const HIZMET_TUR = [
  "Danışmanlık",
  "Denetim",
  "Raporlama",
  "Eğitim",
  "Diğer",
] as const;

export const PARA_BIRIMI = ["TRY", "USD", "EUR"] as const;

// Fırsat sonucu (Faz 6). Aşamadan AYRIDIR: aşama hattaki yeri, durum sonucu
// anlatır. Kapanan fırsat son aşamasında kalır ama kanban'ın açık
// sütunlarından düşer.
export const FIRSAT_DURUM = ["acik", "kazanildi", "kaybedildi"] as const;

// Kanban sütunları için hazır renkler (aşama düzenleme ekranında seçilir).
export const ASAMA_RENKLERI = [
  "#6366f1", "#0ea5e9", "#f59e0b", "#a855f7", "#10b981", "#ef4444", "#64748b",
] as const;

// Durum → Türkçe etiket + renk (dark uyumlu translucent ring rozetleri)
export const DURUM_ETIKET: Record<string, { label: string; className: string }> = {
  // firma
  aktif: { label: "Aktif", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  pasif: { label: "Pasif", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  // yatırım
  basvuruldu: { label: "Başvuruldu", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  onaylandi: { label: "Onaylandı", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  reddedildi: { label: "Reddedildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  // ortak
  tamamlandi: { label: "Tamamlandı", className: "bg-teal-500/15 text-teal-400 ring-teal-500/25" },
  // eğitim
  planlandi: { label: "Planlandı", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  iptal: { label: "İptal", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  // hizmet
  devam: { label: "Devam Ediyor", className: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25" },
  // kiracı (Faz 5 / admin panel)
  askida: { label: "Askıda", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  // fırsat (Faz 6)
  acik: { label: "Açık", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  kazanildi: { label: "Kazanıldı", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  kaybedildi: { label: "Kaybedildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
};

// Kiracı (kuruluş) durumları — admin panelde kullanılır
export const KIRACI_DURUM = ["aktif", "askida", "pasif"] as const;

/**
 * Paket modülleri (Faz 5 / B4).
 *
 * Bir pakette listelenmeyen modül, o kiracının arayüzünde görünmez ve sayfası
 * açılmaz. Paketi olmayan kiracıda kısıtlama uygulanmaz (tüm modüller açıktır)
 * — böylece paket tanımlanmadan da sistem çalışır.
 */
export const PAKET_MODULLERI = [
  { deger: "firma", etiket: "Firmalar", izin: "firma.goruntule" },
  { deger: "yatirim", etiket: "Yatırım Destekleri", izin: "yatirim.goruntule" },
  { deger: "egitim", etiket: "Eğitimler", izin: "egitim.goruntule" },
  { deger: "hizmet", etiket: "Hizmetler", izin: "hizmet.goruntule" },
  { deger: "kisi", etiket: "Kişiler", izin: "kisi.goruntule" },
  { deger: "firsat", etiket: "Fırsatlar", izin: "firsat.goruntule" },
  { deger: "rapor", etiket: "Raporlar", izin: "rapor.goruntule" },
] as const;

export type PaketModulu = (typeof PAKET_MODULLERI)[number]["deger"];

/**
 * Bir izin anahtarı ("firma.olustur"), paketi kapalı bir modüle mi ait?
 *
 * İzin anahtarları "<modül>.<işlem>" biçiminde olduğu için modül adı ön ekten
 * okunur. Paket modülüyle eşleşmeyen ön ekler (ör. "kullanici", "kiraci")
 * hiçbir zaman kapatılmaz — paket iş verisi modüllerini kısıtlar, yönetim
 * yetkilerini değil.
 */
export function modulKapaliMi(izin: string, kapaliModuller: Set<string>): boolean {
  return kapaliModuller.has(izin.split(".")[0]);
}

export function durumBadge(durum: string) {
  return (
    DURUM_ETIKET[durum] ?? {
      label: durum,
      className: "bg-gray-100 text-gray-700",
    }
  );
}
