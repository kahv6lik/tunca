import { execSync } from "node:child_process";

/**
 * Test veritabanı kurulumu — tüm test dosyalarından ÖNCE bir kez çalışır.
 *
 * `test` şemasını sıfırdan kurar: varsa siler, migration'ları uygular
 * (RLS politikaları dahil). Böylece her test çalıştırması temiz ve
 * tekrarlanabilir bir veritabanıyla başlar.
 *
 * DİKKAT — test URL'i BURADA türetilir, `vitest.config.ts` içindeki
 * `test.env` ayarına GÜVENİLMEZ. O ayar yalnızca test dosyalarının çalıştığı
 * ortama uygulanır; globalSetup ana süreçte, ayar uygulanmadan önce çalışır.
 * Bu ayrımı atlamak, migration'ların test şeması yerine GELİŞTİRME şemasına
 * uygulanmasına yol açar (bir kez yaşandı).
 */

const SEMA = "test";

function testUrlTuret(): string {
  const ham = process.env.DATABASE_URL;
  if (!ham?.startsWith("postgres")) {
    throw new Error(
      "Testler PostgreSQL gerektirir. .env içindeki DATABASE_URL'i kontrol edin.\n" +
        "Sunucu çalışmıyorsa: service postgresql start (veya docker compose up -d db)"
    );
  }
  return `${ham.split("?")[0]}?schema=${SEMA}`;
}

export async function setup() {
  const testUrl = testUrlTuret();
  const psqlUrl = testUrl.split("?")[0];

  // Emniyet kemeri: yanlışlıkla geliştirme şemasına dokunmayı imkânsız kılar.
  if (!testUrl.includes(`schema=${SEMA}`)) {
    throw new Error(`Test URL'i "${SEMA}" şemasını hedeflemiyor: ${testUrl}`);
  }

  try {
    execSync(`psql "${psqlUrl}" -q -c 'DROP SCHEMA IF EXISTS ${SEMA} CASCADE;'`, {
      stdio: "pipe",
    });
  } catch (e) {
    throw new Error(
      `PostgreSQL'e bağlanılamadı (${psqlUrl.replace(/:[^:@]*@/, ":****@")}).\n` +
        "Sunucu çalışıyor mu? service postgresql start / docker compose up -d db"
    );
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe",
  });

  // Migration gerçekten test şemasına uygulandı mı?
  const kontrol = execSync(
    `psql "${psqlUrl}" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='${SEMA}';"`,
    { encoding: "utf8" }
  ).trim();
  if (Number(kontrol) < 6) {
    throw new Error(
      `"${SEMA}" şemasında beklenen tablolar oluşmadı (bulunan: ${kontrol}). ` +
        "Migration yanlış şemaya uygulanmış olabilir."
    );
  }

  console.log(`\n▶ Test şeması kuruldu: ${SEMA} (${kontrol} tablo, RLS dahil)\n`);
}

export async function teardown() {
  try {
    const psqlUrl = testUrlTuret().split("?")[0];
    execSync(`psql "${psqlUrl}" -q -c 'DROP SCHEMA IF EXISTS ${SEMA} CASCADE;'`, {
      stdio: "pipe",
    });
  } catch {
    // Temizlik başarısız olursa testleri kırmaya gerek yok.
  }
}
