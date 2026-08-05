#!/usr/bin/env bash
#
# Gezegen CRM — sürüm doğrulama raporu
#
#   npm run dogrula
#
# Tek komutla: tip kontrolü, derleme, migration, demo veri, veri katmanı
# izolasyonu, uçtan uca izolasyon ve gerçek tarayıcıyla kimlik doğrulama.
# Sonucu hem ekrana yazar hem de docs/dogrulama/v<sürüm>.md dosyasına kaydeder.
#
# ÖNEMLİ: Geliştirme veritabanınıza DOKUNMAZ. Aynı PostgreSQL sunucusunda
# ayrı bir şema (`dogrulama`) ve ayrı bir port (3100) kullanır; şema her
# çalıştırmada sıfırdan kurulur ve sonunda silinir.

set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

PORT="${DOGRULA_PORT:-3100}"
DOGRULA_SEMA="dogrulama"
BASE="http://localhost:${PORT}"
SURUM="$(node -p "require('./package.json').version")"
RAPOR_DIZIN="docs/dogrulama"
RAPOR="${RAPOR_DIZIN}/v${SURUM}.md"
GECICI="$(mktemp -d)"
SUNUCU_PID=""

# Portu dinleyen her şeyi öldürür ve gerçekten boşaldığını doğrular.
#
# NEDEN BU KADAR TİTİZ: `npx next start` bir alt süreç (next-server) doğurur.
# Yalnızca sarmalayıcıyı öldürmek alt süreci hayatta bırakır; o da SİLİNMİŞ
# veritabanı dosyasını tutmaya devam eder. Bir sonraki çalıştırma yeni sunucuyu
# ayağa kaldıramaz ama eski sunucu isteklere cevap verdiği için testler sessizce
# ESKİ VERİYLE koşar ve anlamsız şekilde patlar. Bu tuzağa bir kez düşüldü.
port_bosalt() {
  local pidler
  pidler="$(lsof -ti:"$PORT" 2>/dev/null || true)"
  if [[ -n "$pidler" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pidler 2>/dev/null || true
  fi
  for _ in $(seq 1 15); do
    lsof -ti:"$PORT" >/dev/null 2>&1 || return 0
    sleep 1
  done
  return 1
}

sema_sil() {
  [[ -n "${PSQL_URL:-}" ]] || return 0
  psql "$PSQL_URL" -q -c "DROP SCHEMA IF EXISTS ${DOGRULA_SEMA} CASCADE;" >/dev/null 2>&1 || true
}

temizle() {
  if [[ -n "$SUNUCU_PID" ]]; then
    # setsid ile başlatıldığı için PID = süreç grubu kimliği; başındaki eksi
    # işareti tüm grubu (next-server dahil) öldürür.
    kill -9 -- -"$SUNUCU_PID" 2>/dev/null || true
    kill -9 "$SUNUCU_PID" 2>/dev/null || true
  fi
  port_bosalt >/dev/null 2>&1 || true
  sema_sil
  rm -rf "$GECICI"
}
trap temizle EXIT

# ── Rapor durumu ──────────────────────────────────────────────────────────
TOPLAM_GECTI=0
TOPLAM_KALDI=0
SATIRLAR=()

adim() {
  local ad="$1" durum="$2" detay="${3:-}"
  local isaret="✅"
  [[ "$durum" == "KALDI" ]] && isaret="❌"
  SATIRLAR+=("| ${isaret} ${ad} | ${detay} |")
  printf "  %s %s %s\n" "$isaret" "$ad" "${detay:+— $detay}"
}

# Bir kontrol betiğini çalıştırır, "SONUC gecti=N kaldi=M" satırını okur.
kontrol_calistir() {
  local ad="$1"
  local komut="$2"
  local cikti="${GECICI}/$(echo "$ad" | tr ' /' '__').log"
  echo ""
  echo "▶ ${ad}"
  if eval "$komut" > "$cikti" 2>&1; then :; fi
  local sonuc gecti kaldi
  sonuc="$(grep -o 'SONUC gecti=[0-9]* kaldi=[0-9]*' "$cikti" | tail -1)"
  if [[ -z "$sonuc" ]]; then
    adim "$ad" "KALDI" "betik çalışmadı — ayrıntı: $cikti"
    TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
    tail -15 "$cikti" | sed 's/^/      /'
    return 1
  fi
  gecti="$(sed -n 's/.*gecti=\([0-9]*\).*/\1/p' <<< "$sonuc")"
  kaldi="$(sed -n 's/.*kaldi=\([0-9]*\).*/\1/p' <<< "$sonuc")"
  TOPLAM_GECTI=$((TOPLAM_GECTI + gecti))
  TOPLAM_KALDI=$((TOPLAM_KALDI + kaldi))
  # Ayrıntı satırlarını rapora ekle
  DETAY_BLOKLARI+=("### ${ad}"$'\n\n```\n'"$(grep -E '^  (✅|❌)|^[0-9]+\.' "$cikti")"$'\n```\n')
  if [[ "$kaldi" -gt 0 ]]; then
    adim "$ad" "KALDI" "${gecti} geçti, ${kaldi} kaldı"
    grep -E '^  ❌' "$cikti" | sed 's/^/      /'
    return 1
  fi
  adim "$ad" "GECTI" "${gecti}/${gecti} kontrol"
  return 0
}

DETAY_BLOKLARI=()

echo "═══════════════════════════════════════════════════════════"
echo " Gezegen CRM — Doğrulama · v${SURUM}"
echo "═══════════════════════════════════════════════════════════"

# ── 0. Ortam ──────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "HATA: .env yok. 'cp .env.example .env' çalıştırın." >&2
  exit 1
fi
set -a; . ./.env; set +a

if [[ "${DATABASE_URL:-}" != postgres* ]]; then
  echo "HATA: DATABASE_URL bir PostgreSQL adresi olmalı (Faz 2). Şu an: ${DATABASE_URL:-tanımsız}" >&2
  exit 1
fi

# Doğrulama kendi şemasında çalışır; geliştirme şemasına dokunmaz.
TEMEL_URL="${DATABASE_URL%%\?*}"          # sorgu parametreleri olmadan
PSQL_URL="$TEMEL_URL"                     # psql `?schema=` parametresini kabul etmez
DB_URL="${TEMEL_URL}?schema=${DOGRULA_SEMA}"

if ! psql "$PSQL_URL" -q -c 'SELECT 1' >/dev/null 2>&1; then
  echo "HATA: PostgreSQL'e bağlanılamadı: ${PSQL_URL%%:*}://…" >&2
  echo "      Sunucu çalışıyor mu? (ör. 'service postgresql start' veya docker compose up db)" >&2
  exit 1
fi

COMMIT="$(git rev-parse --short HEAD)"
DAL="$(git rev-parse --abbrev-ref HEAD)"
TARIH="$(date '+%Y-%m-%d %H:%M')"

# ── 1. Tip kontrolü ───────────────────────────────────────────────────────
echo ""
echo "▶ Statik kontroller"
if npx tsc --noEmit > "${GECICI}/tsc.log" 2>&1; then
  adim "TypeScript tip kontrolü" "GECTI" "hata yok"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "TypeScript tip kontrolü" "KALDI" "$(wc -l < "${GECICI}/tsc.log") satır hata"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  head -10 "${GECICI}/tsc.log" | sed 's/^/      /'
fi

# ── 2. Derleme ────────────────────────────────────────────────────────────
if npm run build > "${GECICI}/build.log" 2>&1; then
  adim "Üretim derlemesi" "GECTI" "başarılı"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "Üretim derlemesi" "KALDI" "ayrıntı: ${GECICI}/build.log"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  tail -20 "${GECICI}/build.log" | sed 's/^/      /'
  exit 1
fi

# ── 3. Migration ──────────────────────────────────────────────────────────
echo ""
echo "▶ Veritabanı"
psql "$PSQL_URL" -q -c "DROP SCHEMA IF EXISTS ${DOGRULA_SEMA} CASCADE;" >/dev/null 2>&1
if DATABASE_URL="$DB_URL" npx prisma migrate deploy > "${GECICI}/migrate.log" 2>&1; then
  MIG_SAYI="$(ls -1 prisma/migrations | grep -c '^[0-9]')"
  adim "Migration'lar temiz veritabanına uygulandı" "GECTI" "${MIG_SAYI} migration"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "Migration" "KALDI" "ayrıntı: ${GECICI}/migrate.log"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  exit 1
fi

# ── 4. Demo veri ──────────────────────────────────────────────────────────
if DATABASE_URL="$DB_URL" npm run db:seed > "${GECICI}/seed.log" 2>&1; then
  adim "İki kiracılı demo veri üretildi" "GECTI" "$(grep -c '^✅' "${GECICI}/seed.log") adım"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "Demo veri" "KALDI" "ayrıntı: ${GECICI}/seed.log"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  exit 1
fi

# ── 5. Veri katmanı izolasyonu ────────────────────────────────────────────
kontrol_calistir "Kiracı izolasyonu — veri katmanı" \
  "DATABASE_URL='$DB_URL' npx tsx scripts/izolasyon-kontrol.ts"

# ── 6. Sunucuyu başlat ────────────────────────────────────────────────────
echo ""
echo "▶ Sunucu başlatılıyor (port ${PORT})"

# Önce portu boşalt: eski bir sunucu ayakta kalırsa testler onun ESKİ
# veritabanıyla koşar ve sonuç yanıltıcı olur.
if ! port_bosalt; then
  adim "Port ${PORT} boşaltıldı" "KALDI" "port hâlâ dolu; süreci elle kapatın"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  exit 1
fi
adim "Port ${PORT} boş" "GECTI" "eski sunucu kalıntısı yok"
TOPLAM_GECTI=$((TOPLAM_GECTI + 1))

DATABASE_URL="$DB_URL" setsid npx next start -p "$PORT" > "${GECICI}/server.log" 2>&1 < /dev/null &
SUNUCU_PID=$!
disown "$SUNUCU_PID" 2>/dev/null || true   # kapanışta "Killed" mesajı basılmasın
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "${BASE}/login"; then break; fi
  sleep 1
done
if curl -s -o /dev/null -w '%{http_code}' "${BASE}/login" | grep -q 200; then
  adim "Sunucu ayağa kalktı" "GECTI" "$BASE"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "Sunucu ayağa kalktı" "KALDI" "ayrıntı: ${GECICI}/server.log"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
  tail -20 "${GECICI}/server.log" | sed 's/^/      /'
  exit 1
fi

# Cevap veren sunucunun BU çalıştırmaya ait olduğunu doğrula: kendi
# başlattığımız süreç hâlâ yaşıyor ve kendi log'una "Ready" yazmış olmalı.
# (Bayat sunucuya karşı ikinci emniyet; birincisi HTTP izolasyon kontrolündeki
#  "kendi firma sayısını görüyor" testidir — sayfadaki sayı veritabanındakiyle
#  karşılaştırılır, bayat veritabanında bu tutmaz.)
if kill -0 "$SUNUCU_PID" 2>/dev/null && grep -q "Ready" "${GECICI}/server.log"; then
  adim "Cevap veren sunucu bu çalıştırmaya ait" "GECTI" "pid=${SUNUCU_PID}"
  TOPLAM_GECTI=$((TOPLAM_GECTI + 1))
else
  adim "Cevap veren sunucu bu çalıştırmaya ait" "KALDI" \
    "kendi sunucumuz ayakta değil — bayat sunucu cevap veriyor olabilir"
  TOPLAM_KALDI=$((TOPLAM_KALDI + 1))
fi

# ── 7. HTTP izolasyonu ────────────────────────────────────────────────────
kontrol_calistir "Kiracı izolasyonu — HTTP" \
  "DATABASE_URL='$DB_URL' E2E_BASE='$BASE' npx tsx scripts/izolasyon-e2e.mts"

# ── 8. Kimlik doğrulama (gerçek tarayıcı) ─────────────────────────────────
kontrol_calistir "Kimlik doğrulama — gerçek tarayıcı" \
  "DATABASE_URL='$DB_URL' E2E_BASE='$BASE' npx tsx scripts/kimlik-kontrol.mts"

# ── Rapor ─────────────────────────────────────────────────────────────────
mkdir -p "$RAPOR_DIZIN"
SONUC_METNI="✅ GEÇTİ"
[[ "$TOPLAM_KALDI" -gt 0 ]] && SONUC_METNI="❌ KALDI"

{
  echo "# Doğrulama Raporu — v${SURUM}"
  echo ""
  echo "| | |"
  echo "|---|---|"
  echo "| **Sonuç** | **${SONUC_METNI}** |"
  echo "| Geçen kontrol | ${TOPLAM_GECTI} |"
  echo "| Kalan kontrol | ${TOPLAM_KALDI} |"
  echo "| Sürüm | \`v${SURUM}\` |"
  echo "| Commit | \`${COMMIT}\` |"
  echo "| Dal | \`${DAL}\` |"
  echo "| Tarih | ${TARIH} |"
  echo ""
  echo "> Bu rapor \`npm run dogrula\` ile otomatik üretildi. Doğrulama, temiz bir"
  echo "> veritabanı üzerinde sıfırdan kurulum yaparak çalışır; geliştirme"
  echo "> veritabanına dokunmaz."
  echo ""
  echo "## Özet"
  echo ""
  echo "| Kontrol | Sonuç |"
  echo "|---------|-------|"
  printf '%s\n' "${SATIRLAR[@]}"
  echo ""
  echo "## Ayrıntılar"
  echo ""
  printf '%s\n' "${DETAY_BLOKLARI[@]}"
} > "$RAPOR"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " SONUÇ: ${SONUC_METNI}   (geçen: ${TOPLAM_GECTI}, kalan: ${TOPLAM_KALDI})"
echo " Rapor: ${RAPOR}"
echo "═══════════════════════════════════════════════════════════"

[[ "$TOPLAM_KALDI" -gt 0 ]] && exit 1
exit 0
