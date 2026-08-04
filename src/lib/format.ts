export function formatPara(tutar: number, paraBirimi = "TRY"): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: paraBirimi,
      maximumFractionDigits: 0,
    }).format(tutar);
  } catch {
    return `${tutar.toLocaleString("tr-TR")} ${paraBirimi}`;
  }
}

export function formatTarih(tarih: Date | string): string {
  const d = typeof tarih === "string" ? new Date(tarih) : tarih;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// <input type="date"> için YYYY-MM-DD
export function toDateInput(tarih: Date | string): string {
  const d = typeof tarih === "string" ? new Date(tarih) : tarih;
  return d.toISOString().slice(0, 10);
}
