import { Prisma } from "@prisma/client";

/**
 * Firma numarası (Faz 13 / H1).
 *
 * Biçim: `A0001` … `Z9999`. Rakam 9999'a ulaşınca harf ilerler
 * (`A9999` → `B0001`); toplam kapasite **26 × 9999 = 259.974** numara.
 *
 * `server-only` DEĞİLDİR (yedek-saf.ts deseni): dönüşüm saf aritmetiktir,
 * sayaç işlemi ise yapısal bir istemci tipiyle çalışır. Testler ikisini de
 * doğrudan sınar.
 *
 * NEDEN sayaç, neden "en büyüğü bul + 1" değil: ikinci yaklaşım yarış
 * koşuludur — aynı anda firma açan iki kullanıcı aynı numarayı okur ve
 * ikisi de aynı numarayı yazmaya çalışır. Sayaç satırı veritabanında
 * atomik olarak artırılır.
 */

const HARFLER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RAKAM_BASINA = 9999;

/** Toplam kapasite — tükendiğinde yeni firma açılamaz. */
export const AZAMI_FIRMA_NO = HARFLER.length * RAKAM_BASINA;

/**
 * 1 tabanlı sırayı numaraya çevirir: 1 → "A0001", 9999 → "A9999",
 * 10000 → "B0001", 259974 → "Z9999".
 *
 * Sıfır ya da kapasitenin üstü için `null` döner; çağıran bunu açık bir
 * hataya çevirir. Sessizce numarasız kayıt açmak, alanın "değiştirilemez
 * kimlik" sözünü bozardı.
 */
export function firmaNoUret(sira: number): string | null {
  if (!Number.isInteger(sira) || sira < 1 || sira > AZAMI_FIRMA_NO) return null;

  const harfIndeksi = Math.floor((sira - 1) / RAKAM_BASINA);
  const rakam = sira - harfIndeksi * RAKAM_BASINA;

  return `${HARFLER[harfIndeksi]}${String(rakam).padStart(4, "0")}`;
}

/** Numarayı sıraya geri çevirir (test ve doğrulama için). */
export function firmaNoSira(no: string): number | null {
  const eslesme = /^([A-Z])(\d{4})$/.exec(no.trim().toUpperCase());
  if (!eslesme) return null;

  const harfIndeksi = HARFLER.indexOf(eslesme[1]);
  const rakam = Number(eslesme[2]);
  if (harfIndeksi === -1 || rakam < 1 || rakam > RAKAM_BASINA) return null;

  return harfIndeksi * RAKAM_BASINA + rakam;
}

/** Biçim doğrulaması — arama kutusunda "numara mı yazıldı?" ayrımı için. */
export function firmaNoMu(metin: string): boolean {
  return /^[A-Za-z]\d{4}$/.test(metin.trim());
}

/**
 * İstemci tipi YAPISALDIR (yedek-saf.ts deseni): hem kiracı katmanının
 * istemcisi hem testlerdeki RLS istemcisi uyar. `tenantId` parametre olarak
 * açıkça alınır; RLS politikası yanlış kiracıya yazmayı zaten reddeder.
 */
export type SayacIstemcisi = {
  firmaNoSayac: { upsert: (args: unknown) => Promise<unknown> };
  $queryRaw: <T>(sorgu: Prisma.Sql) => Promise<T>;
};

/**
 * Prisma istemcisini yapısal tipe indirger. Prisma'nın üretilmiş imzaları
 * `unknown` parametre kabul etmediği için doğrudan atama TypeScript'te
 * uyuşmaz; çalışma zamanında birebir aynı nesnedir. Dönüşüm TEK buradadır —
 * çağrı yerlerine `as never` serpiştirilmez.
 */
export function sayacIstemcisi(db: unknown): SayacIstemcisi {
  return db as SayacIstemcisi;
}

/**
 * Firma numarası üretimi (Faz 13 / H1).
 *
 * Sıradaki sıra numarası `FirmaNoSayac` satırından **atomik** alınır:
 * PostgreSQL `UPDATE … SET sonSira = sonSira + 1 RETURNING` ifadesi satırı
 * kilitler, yani aynı anda firma açan iki kullanıcı FARKLI numara alır.
 *
 * "En büyük numarayı bul, bir ekle" yaklaşımı bilinçli olarak kullanılmadı:
 * o yaklaşımda iki eşzamanlı istek aynı numarayı okur ve ikisi de yazmaya
 * çalışır — biri tekil kısıt hatası alır, kullanıcı sebepsiz hata görür.
 *
 * `$queryRaw` kullanılır ama kiracı sınırı korunur: sorgu `tenantId` ile
 * filtrelenir ve RLS bağlamı zaten kiracıya kilitlidir.
 */
export async function siradakiFirmaNo(
  db: SayacIstemcisi,
  tenantId: string
): Promise<string> {
  // Sayaç satırı yoksa açılır (yeni kiracı ya da Faz 13 öncesi kiracı).
  await db.firmaNoSayac.upsert({
    where: { tenantId },
    create: { tenantId, sonSira: 0 },
    update: {},
  });

  const satirlar = await db.$queryRaw<{ sonSira: number }[]>(
    Prisma.sql`
      UPDATE "FirmaNoSayac"
      SET "sonSira" = "sonSira" + 1, "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
      RETURNING "sonSira"
    `
  );

  const sira = satirlar[0]?.sonSira ?? 0;
  const no = firmaNoUret(sira);

  if (!no) {
    // Sessizce numarasız kayıt açmak, alanın "değiştirilemez kimlik" sözünü
    // bozardı; açık hata verilir.
    throw new Error(
      `Firma numarası kapasitesi doldu (en fazla ${AZAMI_FIRMA_NO.toLocaleString("tr-TR")} firma).`
    );
  }
  return no;
}
