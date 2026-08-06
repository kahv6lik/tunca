import { defineConfig } from "vitest/config";

/**
 * Test yapılandırması (Faz 3 / A5).
 *
 * Testler geliştirme veritabanınıza DOKUNMAZ: aynı PostgreSQL sunucusunda
 * ayrı bir şema (`test`) kullanılır, her çalıştırmada sıfırdan kurulur.
 *
 * `fileParallelism: false` — test dosyaları aynı veritabanını paylaşır;
 * paralel çalışmaları birbirlerinin verisini görmelerine yol açardı. Testler
 * hızlı olduğu için sıralı çalıştırmanın maliyeti ihmal edilebilir.
 */
const temelUrl = (process.env.DATABASE_URL ?? "").split("?")[0];
const testUrl = `${temelUrl}?schema=test`;

export default defineConfig({
  test: {
    globalSetup: ["./tests/kurulum.ts"],
    env: { DATABASE_URL: testUrl },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
