import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { TenantClient } from "./tenant-db";
import {
  AZAMI_GORSEL_GENISLIK,
  depoYolu,
  guvenliAd,
  turBul,
  turTespit,
  uzantiAl,
  yuklemeKontrol,
} from "./dosya-tanimlar";

export * from "./dosya-tanimlar";

/**
 * Dosya eki deposu — TEK KAPI (Faz 17 / A1).
 *
 * Dosyanın kendisi VERİTABANINDA DEĞİL diskte durur; veritabanı üstveriyi
 * taşır. Aksi halde her yedek yüzlerce megabayt base64 taşır ve geri yükleme
 * kullanılamaz hâle gelirdi (E7'nin sözü: yedek indirilebilir olmalı).
 *
 * Depo dizini `DOSYA_DIZIN` ile belirlenir; üretimde `gezegen-dosya` adlı
 * Docker volume'üne bağlanır ve `docs/DEPLOY.md` bunun yedeğini anlatır.
 * Konteyner yeniden kurulduğunda volume dışında kalan her şey kaybolur.
 */

export const DEPO_KOKU = resolve(process.env.DOSYA_DIZIN ?? "./veri/dosya");

/**
 * Göreli yolu depo kökü içinde çözer.
 *
 * `..` içeren bir yol köke çıkabilirdi; yol veritabanından geliyor olsa bile
 * sınır BURADA zorlanır — depo dışına yazan ya da okuyan bir çağrı olmamalı.
 */
function tamYol(goreliYol: string): string {
  const tam = resolve(join(DEPO_KOKU, goreliYol));
  if (tam !== DEPO_KOKU && !tam.startsWith(DEPO_KOKU + sep)) {
    throw new Error("Geçersiz dosya yolu.");
  }
  return tam;
}

export type EkBaglami = {
  firmaId?: string | null;
  aktiviteId?: string | null;
  destekId?: string | null;
  siparisId?: string | null;
  teklifId?: string | null;
};

/** Bağlamda TAM BİR kayıt bağı olmalıdır. */
export function baglamGecerliMi(baglam: EkBaglami): boolean {
  const dolu = [
    baglam.firmaId,
    baglam.aktiviteId,
    baglam.destekId,
    baglam.siparisId,
    baglam.teklifId,
  ].filter(Boolean);
  return dolu.length === 1;
}

/** Kiracının şu ana kadar kullandığı toplam bayt. */
export async function kullanilanBayt(db: TenantClient): Promise<number> {
  const toplam = await db.dosya.aggregate({ _sum: { boyut: true } });
  return toplam._sum.boyut ?? 0;
}

export type YuklemeSonucu =
  | { ok: true; id: string }
  | { ok: false; hata: string };

/**
 * Dosyayı doğrular, gerekiyorsa küçültür, diske yazar ve satırı açar.
 *
 * SIRA ÖNEMLİ: önce doğrulama ve kota, sonra disk, en son veritabanı. Disk
 * yazımı başarısız olursa veritabanında yetim satır kalmaz; veritabanı
 * yazımı başarısız olursa dosya silinir.
 */
export async function dosyaYukle(
  db: TenantClient,
  tenantId: string,
  baglam: EkBaglami,
  girdi: {
    ad: string;
    icerik: Uint8Array;
    yukleyenId?: string | null;
    yukleyenEmail?: string | null;
  },
  kotaMb: number
): Promise<YuklemeSonucu> {
  if (!baglamGecerliMi(baglam)) {
    return { ok: false, hata: "Ek tam olarak bir kayda bağlanmalıdır." };
  }

  const gosterimAdi = guvenliAd(girdi.ad);
  const ipucu = uzantiAl(gosterimAdi);
  const mime = turTespit(girdi.icerik, ipucu);

  const kullanilan = await kullanilanBayt(db);
  const kontrol = yuklemeKontrol(girdi.icerik.byteLength, mime, kullanilan, kotaMb);
  if (!kontrol.ok) return { ok: false, hata: kontrol.hata };

  const tur = turBul(mime!)!;
  let veri: Uint8Array = girdi.icerik;
  let genislik: number | null = null;
  let yukseklik: number | null = null;

  if (tur.gorsel) {
    const kucuk = await gorseliKucult(girdi.icerik);
    if (kucuk) {
      veri = kucuk.veri;
      genislik = kucuk.genislik;
      yukseklik = kucuk.yukseklik;
    }
  }

  const kayit = await db.dosya.create({
    data: {
      tenantId,
      firmaId: baglam.firmaId ?? null,
      aktiviteId: baglam.aktiviteId ?? null,
      destekId: baglam.destekId ?? null,
      siparisId: baglam.siparisId ?? null,
      teklifId: baglam.teklifId ?? null,
      ad: gosterimAdi,
      // Yol geçici; id üretildikten sonra kesinleşir.
      yol: "",
      mimeTuru: tur.mime,
      boyut: veri.byteLength,
      genislik,
      yukseklik,
      yukleyenId: girdi.yukleyenId ?? null,
      yukleyenEmail: girdi.yukleyenEmail ?? null,
    },
  });

  const yol = depoYolu(tenantId, kayit.id, tur.uzanti);
  try {
    const hedef = tamYol(yol);
    await mkdir(dirname(hedef), { recursive: true });
    await writeFile(hedef, veri);
    await db.dosya.updateMany({ where: { id: kayit.id }, data: { yol } });
  } catch {
    // Disk yazılamadıysa satır da kalmamalı — yoksa indirilemeyen bir ek
    // listede görünür ve kotayı boşuna doldurur.
    await db.dosya.deleteMany({ where: { id: kayit.id } });
    return { ok: false, hata: "Dosya diske yazılamadı." };
  }

  return { ok: true, id: kayit.id };
}

/**
 * Görseli en fazla `AZAMI_GORSEL_GENISLIK` piksele küçültür.
 *
 * Telefonla çekilen fotoğraf 4-8 MB olabiliyor; ekranda gösterilecek bir
 * ziyaret fotoğrafı için bu boşuna kotadır. Küçültme BAŞARISIZ olursa
 * özgün dosya saklanır — bozuk bir görsel yüzünden yükleme düşmemeli.
 */
async function gorseliKucult(
  icerik: Uint8Array
): Promise<{ veri: Uint8Array; genislik: number; yukseklik: number } | null> {
  try {
    const { default: sharp } = await import("sharp");
    const islem = sharp(Buffer.from(icerik), { failOn: "none" }).rotate();
    const bilgi = await islem.metadata();
    if (!bilgi.width || !bilgi.height) return null;

    const cikti = await islem
      .resize({ width: AZAMI_GORSEL_GENISLIK, withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });

    return {
      veri: new Uint8Array(cikti.data),
      genislik: cikti.info.width,
      yukseklik: cikti.info.height,
    };
  } catch {
    return null;
  }
}

/** Dosyanın içeriğini okur (indirme ucu kullanır). */
export async function dosyaOku(goreliYol: string): Promise<Buffer> {
  return readFile(tamYol(goreliYol));
}

/**
 * Diskteki dosyayı siler.
 *
 * Dosya bulunamazsa HATA VERMEZ: veritabanı satırının silinmesi asıl işlemdir
 * ve diskteki eksik bir dosya yüzünden kayıt silinemez hâle gelmemelidir.
 */
export async function dosyaDiskteSil(goreliYol: string): Promise<void> {
  if (!goreliYol) return;
  try {
    await unlink(tamYol(goreliYol));
  } catch {
    /* zaten yok */
  }
}
