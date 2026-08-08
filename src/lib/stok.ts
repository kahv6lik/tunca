import { Prisma } from "@prisma/client";
import { STOK_HAREKET_TUR, type StokHareketTuru } from "./constants";

/**
 * Stok defteri — Faz 14 / T7, T8.
 *
 * ═══ İKİ KURAL ═══
 *
 * 1. BAKİYE HAREKETLERİN TOPLAMIDIR. `Urun.stokMiktar` bir ÖZETTİR (her
 *    listede binlerce hareketi toplamamak için), gerçeğin kaynağı defterdir.
 *    Bu yüzden bakiye yalnızca burada, hareketle BİRLİKTE güncellenir; ürün
 *    formundan elle yazılamaz.
 *
 * 2. ÇIKIŞ ATOMİKTİR. Kampanya kotasıyla aynı gerekçe: iki temsilci son
 *    ürünü aynı anda satamamalı. Bakiye düşümü koşullu bir UPDATE ile
 *    yapılır; yeterli stok yoksa satır hiç güncellenmez ve hareket yazılmaz.
 *
 * `server-only` DEĞİLDİR: testler yarış koşulunu gerçek veritabanına karşı
 * sınar (yedek-saf.ts / kampanya.ts deseni).
 */

export type StokIstemcisi = {
  $queryRaw: <T>(sorgu: Prisma.Sql) => Promise<T>;
  urun: {
    findFirst: (args?: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  };
  stokHareketi: {
    create: (args: unknown) => Promise<{ id: string }>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  };
};

export function stokIstemcisi(db: unknown): StokIstemcisi {
  return db as StokIstemcisi;
}

/** Hareket türünün yönü: +1 giriş, −1 çıkış, 0 = iki yönlü (sayım/düzeltme). */
export function turYonu(tur: string): number {
  return STOK_HAREKET_TUR.find((t) => t.deger === tur)?.yon ?? 0;
}

/**
 * Kullanıcının girdiği miktarı İŞARETLİ değere çevirir.
 *
 * Kullanıcı her zaman POZİTİF sayı girer ("5 adet çıkış"); işaretin kararı
 * tek bir yerde, tür tanımına bakılarak verilir. İki yönlü türlerde (sayım,
 * düzeltme) işaret kullanıcının girdiğidir — eksiye de gidebilir.
 */
export function isaretliMiktar(tur: string, miktar: number): number {
  const yon = turYonu(tur);
  if (yon === 0) return miktar;
  return Math.abs(miktar) * yon;
}

export type HareketGirdisi = {
  urunId: string;
  tur: StokHareketTuru;
  miktar: number;
  aciklama?: string | null;
  referans?: string | null;
  kullaniciId?: string | null;
};

export type HareketSonucu =
  | { ok: true; yeniBakiye: number; hareketId: string }
  | { ok: false; hata: string };

/**
 * Stok hareketi işler ve bakiyeyi atomik olarak günceller.
 *
 * NEGATİF STOĞA İZİN VERİLMEZ: elde olmayan malı sevk etmek, sonradan
 * düzeltilmesi en zor hatalardan biridir. Gerçekten gerekirse "düzeltme"
 * hareketiyle bilinçli olarak yazılır.
 */
export async function stokHareketiIsle(
  db: StokIstemcisi,
  tenantId: string,
  girdi: HareketGirdisi
): Promise<HareketSonucu> {
  const urun = (await db.urun.findFirst({
    where: { id: girdi.urunId },
    select: { id: true, ad: true, stokTakibi: true, stokMiktar: true },
  })) as { id: string; ad: string; stokTakibi: boolean; stokMiktar: number } | null;

  if (!urun) return { ok: false, hata: "Ürün bulunamadı." };
  if (!urun.stokTakibi) {
    return {
      ok: false,
      hata: `"${urun.ad}" için stok takibi kapalı. Ürün kartından açabilirsiniz.`,
    };
  }

  const delta = isaretliMiktar(girdi.tur, girdi.miktar);
  if (delta === 0) return { ok: false, hata: "Miktar sıfır olamaz." };

  /**
   * Koşullu ve atomik güncelleme. `stokMiktar + delta >= 0` koşulu, eldeki
   * mal kadar çıkış yapılmasını garanti eder; iki eşzamanlı çıkış isteğinden
   * yalnızca biri geçer.
   */
  const satirlar = await db.$queryRaw<{ stokMiktar: number }[]>(
    Prisma.sql`
      UPDATE "Urun"
      SET "stokMiktar" = "stokMiktar" + ${delta}, "updatedAt" = NOW()
      WHERE "id" = ${girdi.urunId}
        AND "tenantId" = ${tenantId}
        AND "stokMiktar" + ${delta} >= 0
      RETURNING "stokMiktar"
    `
  );

  if (satirlar.length === 0) {
    return {
      ok: false,
      hata:
        `Yetersiz stok: "${urun.ad}" için elde ${urun.stokMiktar} var, ` +
        `${Math.abs(delta)} çıkış istendi.`,
    };
  }

  const yeniBakiye = satirlar[0].stokMiktar;

  // Defter kaydı bakiyeden SONRA yazılır: reddedilen bir çıkış deftere
  // düşmemeli. Hareket satırı, o andaki bakiyeyi de saklar (denetim izi).
  const hareket = await db.stokHareketi.create({
    data: {
      tenantId,
      urunId: girdi.urunId,
      tur: girdi.tur,
      miktar: delta,
      sonrakiBakiye: yeniBakiye,
      aciklama: girdi.aciklama ?? null,
      referans: girdi.referans ?? null,
      kullaniciId: girdi.kullaniciId ?? null,
    },
  });

  return { ok: true, yeniBakiye, hareketId: hareket.id };
}

/**
 * Sayım sonucunu işler: hedef bakiyeye götüren FARK kadar hareket yazar.
 *
 * Bakiyeyi doğrudan yazmak yerine fark hareketi üretmek bilinçlidir —
 * "sistemde 100 vardı, sayımda 97 çıktı, 3 fark" bilgisi kaybolmamalıdır.
 */
export async function sayimIsle(
  db: StokIstemcisi,
  tenantId: string,
  urunId: string,
  sayilanMiktar: number,
  kullaniciId?: string | null
): Promise<HareketSonucu> {
  const urun = (await db.urun.findFirst({
    where: { id: urunId },
    select: { stokMiktar: true },
  })) as { stokMiktar: number } | null;

  if (!urun) return { ok: false, hata: "Ürün bulunamadı." };

  const fark = sayilanMiktar - urun.stokMiktar;
  if (fark === 0) {
    return { ok: false, hata: "Sayım sonucu mevcut bakiyeyle aynı; hareket yazılmadı." };
  }

  return stokHareketiIsle(db, tenantId, {
    urunId,
    tur: "sayim",
    miktar: fark,
    aciklama: `Sayım: sistemde ${urun.stokMiktar}, sayılan ${sayilanMiktar}`,
    kullaniciId,
  });
}

/**
 * Kritik seviyenin altına düşen ürünler (T8).
 *
 * `kritikStok = 0` "uyarma" demektir; her ürüne eşik girmek zorunda kalmak,
 * katalogu ilk dolduran kullanıcıyı gereksiz yavaşlatırdı.
 */
export async function kritikStoktakiUrunler(
  db: StokIstemcisi
): Promise<{ id: string; kod: string; ad: string; stokMiktar: number; kritikStok: number; birim: string }[]> {
  const kayitlar = (await db.urun.findMany({
    where: { stokTakibi: true, durum: "aktif", kritikStok: { gt: 0 } },
    select: { id: true, kod: true, ad: true, stokMiktar: true, kritikStok: true, birim: true },
    orderBy: { ad: "asc" },
    take: 500,
  })) as unknown as {
    id: string;
    kod: string;
    ad: string;
    stokMiktar: number;
    kritikStok: number;
    birim: string;
  }[];

  // Karşılaştırma bellekte yapılır: Prisma `where` içinde iki SÜTUNU
  // birbiriyle karşılaştıramaz. Liste 500 satırla sınırlı olduğu için
  // maliyeti ihmal edilebilir.
  return kayitlar.filter((u) => u.stokMiktar <= u.kritikStok);
}
