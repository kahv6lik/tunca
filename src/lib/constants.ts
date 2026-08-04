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

export const YATIRIM_TUR = ["hibe", "kredi", "teşvik", "diğer"] as const;

export const EGITIM_DURUM = ["planlandi", "tamamlandi", "iptal"] as const;

export const HIZMET_DURUM = ["devam", "tamamlandi", "iptal"] as const;

export const HIZMET_TUR = [
  "danışmanlık",
  "denetim",
  "raporlama",
  "eğitim",
  "diğer",
] as const;

export const PARA_BIRIMI = ["TRY", "USD", "EUR"] as const;

// Durum → Türkçe etiket + renk (Tailwind sınıfları)
export const DURUM_ETIKET: Record<string, { label: string; className: string }> = {
  // firma
  aktif: { label: "Aktif", className: "bg-green-100 text-green-800" },
  pasif: { label: "Pasif", className: "bg-gray-100 text-gray-700" },
  // yatırım
  basvuruldu: { label: "Başvuruldu", className: "bg-blue-100 text-blue-800" },
  onaylandi: { label: "Onaylandı", className: "bg-green-100 text-green-800" },
  reddedildi: { label: "Reddedildi", className: "bg-red-100 text-red-800" },
  // ortak
  tamamlandi: { label: "Tamamlandı", className: "bg-emerald-100 text-emerald-800" },
  // eğitim
  planlandi: { label: "Planlandı", className: "bg-amber-100 text-amber-800" },
  iptal: { label: "İptal", className: "bg-red-100 text-red-800" },
  // hizmet
  devam: { label: "Devam Ediyor", className: "bg-indigo-100 text-indigo-800" },
};

export function durumBadge(durum: string) {
  return (
    DURUM_ETIKET[durum] ?? {
      label: durum,
      className: "bg-gray-100 text-gray-700",
    }
  );
}
