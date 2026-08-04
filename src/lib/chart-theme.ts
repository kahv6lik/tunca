// Grafiklerde kullanılan tutarlı renk paleti (dark/light uyumlu canlı tonlar)
export const CHART_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#14b8a6", // teal
  "#ec4899", // pink
];

// Durum → renk eşlemesi
export const DURUM_RENK: Record<string, string> = {
  onaylandi: "#10b981",
  tamamlandi: "#14b8a6",
  basvuruldu: "#0ea5e9",
  reddedildi: "#f43f5e",
  planlandi: "#f59e0b",
  iptal: "#f43f5e",
  devam: "#6366f1",
  aktif: "#10b981",
  pasif: "#64748b",
};
