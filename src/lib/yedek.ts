import "server-only";

/**
 * Yedekleme — sunucu tarafı giriş noktası (Faz 10 / E7).
 *
 * Mantığın tamamı `yedek-saf.ts` içindedir (testler onu doğrudan sınar);
 * burası yalnızca `server-only` işaretiyle yeniden dışa aktarır ki uygulama
 * kodu yanlışlıkla istemci paketine yedekleme kodu sızdıramasın.
 */
export * from "./yedek-saf";
