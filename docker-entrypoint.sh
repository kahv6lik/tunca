#!/bin/sh
set -e

# PostgreSQL hazır olana kadar bekle. Compose'daki healthcheck çoğu durumda
# yeterlidir; bu döngü, veritabanının ayrı bir sunucuda olduğu kurulumlar için
# ek emniyettir.
echo "▶ Veritabanı bekleniyor…"
i=0
until npx prisma db execute --stdin >/dev/null 2>&1 <<'SQL'
SELECT 1;
SQL
do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "✗ Veritabanına 60 denemede bağlanılamadı. DATABASE_URL doğru mu?" >&2
    exit 1
  fi
  sleep 2
done
echo "✓ Veritabanı hazır."

echo "▶ Veritabanı migrasyonları uygulanıyor…"
npx prisma migrate deploy

echo "▶ Kiracı ve yönetici kullanıcısı kontrol ediliyor…"
npx tsx prisma/bootstrap.ts

echo "▶ Gezegen CRM başlatılıyor (port 3000)…"
exec npx next start -p 3000 -H 0.0.0.0
