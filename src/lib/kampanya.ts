import { Prisma } from "@prisma/client";
import { kampanyaGecerliMi, type FiyatKampanyasi } from "./fiyat-saf";
import type { KampanyaTipi } from "./constants";

/**
 * Kampanya kotası ve kullanım defteri — Faz 14 / T4.
 *
 * ═══ NEDEN ATOMİK ═══
 *
 * Ortağın bulgusu: "kampanyaya adet girilsin, her satışta düşsün". Buradaki
 * tek gerçek risk, iki satış temsilcisinin son adedi AYNI ANDA satmasıdır.
 * Uygulama katmanında "kalanı oku → kontrol et → yaz" yapılırsa ikisi de
 * aynı kalanı okur ve ikisi de satar; kota aşılır ve fark ancak muhasebede
 * fark edilir.
 *
 * Çözüm sayacı veritabanına bırakmaktır:
 *
 *   UPDATE "Kampanya" SET kullanilan = kullanilan + n
 *   WHERE id = … AND (kota = 0 OR kullanilan + n <= kota)
 *
 * PostgreSQL satırı kilitler; koşul sağlanmazsa GÜNCELLEME OLMAZ ve etkilenen
 * satır sayısı 0 döner. İkinci temsilci "kota tükendi" yanıtı alır.
 *
 * Bu dosya `server-only` DEĞİLDİR: testler kota yarışını gerçek veritabanına
 * karşı sınar (yedek-saf.ts deseni; istemci tipi yapısaldır).
 */

export type KampanyaIstemcisi = {
  $queryRaw: <T>(sorgu: Prisma.Sql) => Promise<T>;
  $executeRaw: (sorgu: Prisma.Sql) => Promise<number>;
  kampanya: {
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args?: unknown) => Promise<Record<string, unknown> | null>;
  };
  kampanyaKullanim: {
    create: (args: unknown) => Promise<{ id: string }>;
    findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  };
};

export function kampanyaIstemcisi(db: unknown): KampanyaIstemcisi {
  return db as KampanyaIstemcisi;
}

export type KotaSonucu =
  | { ok: true; kalanKota: number }
  | { ok: false; hata: string };

/**
 * Kotadan `adet` düşer. Yeterli hak yoksa HİÇBİR ŞEY değişmez.
 *
 * `tenantId` sorguya elle yazılır: ham SQL, kiracı katmanının otomatik
 * filtresinden geçmez. RLS ikinci katman olarak zaten koruyor ama tek
 * katmana güvenmek bu projenin kuralı değil.
 */
export async function kotaDus(
  db: KampanyaIstemcisi,
  tenantId: string,
  kampanyaId: string,
  adet: number
): Promise<KotaSonucu> {
  if (adet <= 0) return { ok: false, hata: "Adet sıfırdan büyük olmalı." };

  const satirlar = await db.$queryRaw<{ kota: number; kullanilan: number }[]>(
    Prisma.sql`
      UPDATE "Kampanya"
      SET "kullanilan" = "kullanilan" + ${adet}, "updatedAt" = NOW()
      WHERE "id" = ${kampanyaId}
        AND "tenantId" = ${tenantId}
        AND "durum" = 'aktif'
        AND ("kota" = 0 OR "kullanilan" + ${adet} <= "kota")
      RETURNING "kota", "kullanilan"
    `
  );

  if (satirlar.length === 0) {
    // Ayrım önemli: kampanya yok mu, pasif mi, yoksa kota mı bitti?
    // Kullanıcıya "bir şeyler ters gitti" demek yerine sebebini söylüyoruz.
    const kayit = (await db.kampanya.findFirst({
      where: { id: kampanyaId },
      select: { durum: true, kota: true, kullanilan: true },
    })) as { durum: string; kota: number; kullanilan: number } | null;

    if (!kayit) return { ok: false, hata: "Kampanya bulunamadı." };
    if (kayit.durum !== "aktif") return { ok: false, hata: "Kampanya aktif değil." };

    const kalan = Math.max(kayit.kota - kayit.kullanilan, 0);
    return {
      ok: false,
      hata: `Kampanya kotası yetersiz: ${kalan} adet kaldı, ${adet} adet istendi.`,
    };
  }

  const { kota, kullanilan } = satirlar[0];
  return { ok: true, kalanKota: kota === 0 ? 0 : kota - kullanilan };
}

/**
 * Kotayı geri verir (iptal/iade).
 *
 * Sıfırın altına DÜŞMEZ: art arda iki kez çağrılan bir iptal, kotayı
 * olduğundan büyük gösterirdi.
 */
export async function kotaIade(
  db: KampanyaIstemcisi,
  tenantId: string,
  kampanyaId: string,
  adet: number
): Promise<void> {
  if (adet <= 0) return;

  await db.$executeRaw(Prisma.sql`
    UPDATE "Kampanya"
    SET "kullanilan" = GREATEST("kullanilan" - ${adet}, 0), "updatedAt" = NOW()
    WHERE "id" = ${kampanyaId} AND "tenantId" = ${tenantId}
  `);
}

export type KullanimGirdisi = {
  kampanyaId: string;
  firmaId: string;
  adet: number;
  indirimTutari: number;
  paraBirimi?: string;
  referans?: string | null;
  kullananId?: string | null;
};

/**
 * Kotayı düşer VE kullanım kaydını yazar.
 *
 * Sıra bilinçlidir: önce kota (yarışın çözüldüğü yer), sonra defter. Ters
 * sırada, kota tükendiği için reddedilen bir satış deftere yazılmış olurdu.
 */
export async function kampanyaKullan(
  db: KampanyaIstemcisi,
  tenantId: string,
  girdi: KullanimGirdisi
): Promise<KotaSonucu> {
  const sonuc = await kotaDus(db, tenantId, girdi.kampanyaId, girdi.adet);
  if (!sonuc.ok) return sonuc;

  await db.kampanyaKullanim.create({
    data: {
      tenantId,
      kampanyaId: girdi.kampanyaId,
      firmaId: girdi.firmaId,
      adet: girdi.adet,
      indirimTutari: girdi.indirimTutari,
      paraBirimi: girdi.paraBirimi ?? "TRY",
      referans: girdi.referans ?? null,
      kullananId: girdi.kullananId ?? null,
    },
  });

  return sonuc;
}

/**
 * Bir firma + ürün için o an geçerli kampanyaları getirir.
 *
 * Geçerlilik kararı saf katmandadır (`kampanyaGecerliMi`); burası yalnızca
 * veriyi toplar. Böylece kural tek yerde yaşar ve testler onu veritabanı
 * olmadan sınayabilir.
 */
export async function gecerliKampanyalar(
  db: KampanyaIstemcisi,
  secenekler: { firmaId?: string | null; urunId?: string | null; an?: Date }
): Promise<FiyatKampanyasi[]> {
  const an = secenekler.an ?? new Date();

  const kayitlar = (await db.kampanya.findMany({
    where: { durum: "aktif", baslangic: { lte: an }, bitis: { gte: an } },
    include: {
      urunler: { select: { urunId: true } },
      paketler: { select: { paketId: true } },
      firmalar: { select: { firmaId: true } },
    },
    take: 200,
  })) as unknown as {
    id: string;
    kod: string;
    ad: string;
    tip: string;
    deger: number;
    alN: number;
    odeM: number;
    kota: number;
    kullanilan: number;
    durum: string;
    baslangic: Date;
    bitis: Date;
    urunler: { urunId: string }[];
    paketler: { paketId: string }[];
    firmalar: { firmaId: string }[];
  }[];

  return kayitlar
    .filter((k) =>
      kampanyaGecerliMi(
        {
          durum: k.durum,
          baslangic: k.baslangic,
          bitis: k.bitis,
          kota: k.kota,
          kullanilan: k.kullanilan,
          urunIdler: k.urunler.map((u) => u.urunId),
          paketIdler: k.paketler.map((p) => p.paketId),
          firmaIdler: k.firmalar.map((f) => f.firmaId),
        },
        { an, firmaId: secenekler.firmaId, urunId: secenekler.urunId }
      )
    )
    .map((k) => ({
      kampanyaId: k.id,
      kod: k.kod,
      ad: k.ad,
      tip: k.tip as KampanyaTipi,
      deger: k.deger,
      alN: k.alN,
      odeM: k.odeM,
      kalanKota: k.kota === 0 ? 0 : Math.max(k.kota - k.kullanilan, 0),
    }));
}

/**
 * Süresi dolmuş kampanyaları "sona erdi" durumuna çeker.
 *
 * Zamanlanmış çalıştırıcıdan çağrılır (Faz 8 deseni). Durumu tarihe bakarak
 * her sorguda hesaplamak yerine kaydetmek bilinçlidir: kullanıcı listede
 * "sona erdi" görmek ve süzmek ister.
 */
export async function sureniDolduranlariKapat(
  db: KampanyaIstemcisi,
  tenantId: string,
  an = new Date()
): Promise<number> {
  return db.$executeRaw(Prisma.sql`
    UPDATE "Kampanya"
    SET "durum" = 'sonaerdi', "updatedAt" = NOW()
    WHERE "tenantId" = ${tenantId}
      AND "durum" IN ('aktif', 'duraklatildi')
      AND "bitis" < ${an}
  `);
}
