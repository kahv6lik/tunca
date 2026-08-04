import { formatPara } from "./format";

export type ChartFormat = "number" | "currency" | "firma" | "saat";

// Grafiklerde kullanılan format anahtarını fonksiyona çevirir.
// (Server → Client sınırında fonksiyon geçilemediği için string anahtar kullanılır.)
export function makeFormatter(format: ChartFormat = "number") {
  switch (format) {
    case "currency":
      return (n: number) => formatPara(n);
    case "firma":
      return (n: number) => `${n.toLocaleString("tr-TR")} firma`;
    case "saat":
      return (n: number) => `${n.toLocaleString("tr-TR")} s`;
    default:
      return (n: number) => n.toLocaleString("tr-TR");
  }
}
