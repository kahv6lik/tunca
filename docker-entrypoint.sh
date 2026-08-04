#!/bin/sh
set -e

# Kalıcı veri dizini (SQLite dosyası burada tutulur — Docker volume)
mkdir -p /app/data

echo "▶ Veritabanı migrasyonları uygulanıyor…"
npx prisma migrate deploy

echo "▶ Yönetici kullanıcısı kontrol ediliyor…"
npx tsx prisma/bootstrap.ts

echo "▶ Gezegen CRM başlatılıyor (port 3000)…"
exec npx next start -p 3000 -H 0.0.0.0
