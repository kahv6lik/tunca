import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "#6366f1" → "239 84% 67%" (Tailwind tema değişkenlerinin beklediği biçim).
 *
 * Kiracıya özel ana renk (Faz 5 / B7) `--primary` değişkenine bu biçimde
 * yazılır; böylece tüm bileşenler tek bir satırla markalanır. Geçersiz değer
 * gelirse `null` döner ve varsayılan tema korunur — hatalı bir renk yüzünden
 * arayüz bozulmaz.
 */
export function hexToHslDegerleri(hex: string): string | null {
  const t = hex.trim().replace(/^#/, "");
  const tam =
    t.length === 3
      ? t
          .split("")
          .map((c) => c + c)
          .join("")
      : t;
  if (!/^[0-9a-fA-F]{6}$/.test(tam)) return null;

  const r = parseInt(tam.slice(0, 2), 16) / 255;
  const g = parseInt(tam.slice(2, 4), 16) / 255;
  const b = parseInt(tam.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
