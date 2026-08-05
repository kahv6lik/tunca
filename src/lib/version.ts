/**
 * Uygulama sürümü.
 *
 * Değer `package.json` içindeki `version` alanından gelir ve derleme sırasında
 * `next.config.js` üzerinden gömülür. `scripts/release.sh` tag atmadan önce
 * package.json sürümünü yükselttiği için arayüzde görünen sürüm her zaman
 * git tag'i ile birebir aynıdır.
 *
 *   package.json: "version": "1.1.1"   →   arayüz: v1.1.1   →   git tag: v1.1.1
 */
export const APP_VERSION = process.env.APP_VERSION ?? "0.0.0";

/** Arayüzde gösterilen biçim: "v1.1.1" */
export const APP_VERSION_ETIKET = `v${APP_VERSION}`;
