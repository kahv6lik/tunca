# SQLite dönemi migration'ları (arşiv)

Bu klasör `v1.0.x` – `v1.1.x` sürümlerinde kullanılan **SQLite** migration'larını
saklar. Faz 2 ile veritabanı PostgreSQL'e taşındı; Prisma migration'ları
veritabanına özgü olduğu için bu dosyalar artık uygulanmaz.

Burada tutulmalarının tek sebebi geçmişe dönük referans: eski bir SQLite
yedeğini açmanız veya `v1.1.x` sürümüne geri dönmeniz gerekirse şema geçmişi
buradadır.

Mevcut SQLite verisini PostgreSQL'e taşımak için: `npm run gecis:postgres`
(bkz. `docs/DEPLOY.md` → "v1.2.0 — PostgreSQL'e geçiş").
