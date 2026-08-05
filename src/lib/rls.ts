import { PrismaClient } from "@prisma/client";
import { prisma } from "./db";

/**
 * PostgreSQL Row-Level Security bağlam katmanı (Faz 2 / A4).
 *
 * RLS politikaları oturum değişkenlerine bakar (`app.tenant_id`,
 * `app.yonetim`, `app.kimlik_dogrulama`). Bu değişkenler `SET LOCAL`
 * semantiğiyle, yani YALNIZCA bir işlem (transaction) boyunca geçerli olacak
 * şekilde ayarlanır — havuzdan gelen bir bağlantının bir sonraki isteğe
 * bağlam sızdırmaması için bu şarttır.
 *
 * Bu yüzden her sorgu, ayarı yapan ifadeyle birlikte tek bir işlem içinde
 * çalıştırılır:
 *
 *     [ SELECT set_config('app.tenant_id', $1, true) ,  <asıl sorgu> ]
 *
 * Maliyeti bir ek gidiş-dönüştür; karşılığında uygulama katmanı hata yapsa
 * bile veritabanı yanlış kiracının satırını döndürmez.
 *
 * NOT: Bu dosya bilinçli olarak `server-only` içermez — kurulum ve doğrulama
 * betikleri de (seed, bootstrap, demo hesap, kontroller) buradan yönetim
 * bağlamını kullanır.
 */

type Baglam =
  | { tur: "kiraci"; tenantId: string }
  | { tur: "yonetim" }
  | { tur: "kimlik" };

function ayarIfadesi(istemci: PrismaClient, baglam: Baglam) {
  switch (baglam.tur) {
    case "kiraci":
      return istemci.$executeRaw`SELECT set_config('app.tenant_id', ${baglam.tenantId}, true)`;
    case "yonetim":
      return istemci.$executeRaw`SELECT set_config('app.yonetim', 'evet', true)`;
    case "kimlik":
      return istemci.$executeRaw`SELECT set_config('app.kimlik_dogrulama', 'evet', true)`;
  }
}

/**
 * Verilen RLS bağlamını her sorguya uygulayan bir Prisma istemcisi döndürür.
 * Döndürülen istemci normal Prisma istemcisi gibi kullanılır.
 */
export function rlsIstemcisi(baglam: Baglam, temel: PrismaClient = prisma) {
  return temel.$extends({
    query: {
      async $allOperations({ args, query }) {
        // Dizi biçimli $transaction: iki ifade de AYNI bağlantıda, aynı
        // işlem içinde sırayla çalışır. set_config'in üçüncü argümanı `true`
        // olduğu için ayar işlem bitince kendiliğinden düşer.
        const [, sonuc] = await temel.$transaction([
          ayarIfadesi(temel, baglam),
          query(args),
        ]);
        return sonuc;
      },
    },
  });
}

/** Normal uygulama trafiği — yalnızca bu kiracının satırları görünür. */
export function kiraciIstemcisi(tenantId: string, temel?: PrismaClient) {
  if (!tenantId) throw new Error("kiraciIstemcisi: tenantId zorunludur.");
  return rlsIstemcisi({ tur: "kiraci", tenantId }, temel);
}

/**
 * Kurulum ve bakım betikleri için tam erişim (seed, bootstrap, demo hesap,
 * kiracı oluşturma). Faz 5'te admin panel de bunu kullanacak.
 *
 * Uygulamanın normal istek yollarında KULLANILMAZ.
 */
export function yonetimIstemcisi(temel?: PrismaClient) {
  return rlsIstemcisi({ tur: "yonetim" }, temel);
}

/**
 * Giriş akışı — User ve Tenant tablolarında yalnızca OKUMA. Oturum açılmadan
 * önce kullanıcının kiracısı bilinmediği için gereklidir; RLS politikaları bu
 * bağlamda yazma izni vermez.
 */
export function kimlikIstemcisi(temel?: PrismaClient) {
  return rlsIstemcisi({ tur: "kimlik" }, temel);
}
