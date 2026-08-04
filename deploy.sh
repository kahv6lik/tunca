#!/usr/bin/env bash
#
# Gezegen CRM — otomatik dağıtım script'i (Docker + Nginx + Let's Encrypt)
#
# Kullanım (sunucuda, proje kök dizininde):
#   cp deploy/deploy.env.example deploy.env   # bir kez: değerleri doldurun
#   ./deploy.sh
#
# Tekrar çalıştırıldığında: yeni imajı derler ve servisleri günceller
# (sertifika zaten varsa yeniden alınmaz).

set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"

# ---- Renkli çıktı ----
info()  { printf "\033[1;34m▶ %s\033[0m\n" "$*"; }
ok()    { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
warn()  { printf "\033[1;33m! %s\033[0m\n" "$*"; }
err()   { printf "\033[1;31m✖ %s\033[0m\n" "$*" >&2; }

# ---- Docker compose komutunu belirle ----
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  err "Docker Compose bulunamadı. Lütfen Docker'ı kurun: https://docs.docker.com/engine/install/"
  exit 1
fi

# ---- deploy.env yükle ----
if [ ! -f deploy.env ]; then
  warn "deploy.env bulunamadı. Örnekten oluşturuluyor…"
  cp deploy/deploy.env.example deploy.env
  err "Lütfen 'deploy.env' dosyasını düzenleyip (DOMAIN, LETSENCRYPT_EMAIL) tekrar çalıştırın."
  exit 1
fi

# deploy.env'i güvenli şekilde yükle (tırnaksız/boşluklu değerlere dayanıklı)
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;   # boş satır / yorum
    *=*) : ;;             # KEY=VALUE
    *) continue ;;
  esac
  key="${line%%=*}"
  val="${line#*=}"
  # baştaki/sondaki tırnakları kaldır
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  export "$key=$val"
done < deploy.env

: "${DOMAIN:?deploy.env içinde DOMAIN tanımlı olmalı}"
: "${LETSENCRYPT_EMAIL:?deploy.env içinde LETSENCRYPT_EMAIL tanımlı olmalı}"
STAGING="${STAGING:-0}"

# ---- AUTH_SECRET yoksa üret ve kalıcı yaz ----
if [ -z "${AUTH_SECRET:-}" ]; then
  info "AUTH_SECRET üretiliyor…"
  AUTH_SECRET="$(openssl rand -base64 32)"
  export AUTH_SECRET
  # deploy.env içine yaz (satırı değiştir)
  if grep -q '^AUTH_SECRET=' deploy.env; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SECRET}|" deploy.env
  else
    echo "AUTH_SECRET=${AUTH_SECRET}" >> deploy.env
  fi
  ok "AUTH_SECRET oluşturuldu ve deploy.env'e kaydedildi."
fi

# ---- Nginx yapılandırmasını şablondan üret ----
info "Nginx yapılandırması hazırlanıyor ($DOMAIN)…"
mkdir -p deploy/nginx deploy/certbot/conf deploy/certbot/www
sed "s|\${DOMAIN}|${DOMAIN}|g" deploy/nginx/app.conf.template > deploy/nginx/app.conf
ok "deploy/nginx/app.conf oluşturuldu."

CERT_PATH="deploy/certbot/conf/live/${DOMAIN}"
# Gerçek Let's Encrypt sertifikası ancak certbot başarıyla çalışınca bir
# yenileme (renewal) yapılandırması oluşturur. Geçici (dummy) sertifikada bu
# dosya olmaz — bu yüzden "gerçek sertifika var mı" kontrolünü buna dayandırırız.
RENEWAL_CONF="deploy/certbot/conf/renewal/${DOMAIN}.conf"

# ---- İlk kurulum: gerçek sertifika henüz yoksa ----
if [ ! -f "${RENEWAL_CONF}" ]; then
  info "Gerçek sertifika bulunamadı — ilk kurulum başlıyor."

  # Önceki denemelerden kalan geçici sertifikayı temizle
  rm -rf "${CERT_PATH}"

  # 1) Nginx'in ayağa kalkabilmesi için geçici (dummy) sertifika
  info "Geçici sertifika oluşturuluyor…"
  mkdir -p "${CERT_PATH}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_PATH}/privkey.pem" \
    -out "${CERT_PATH}/fullchain.pem" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1

  # 2) Uygulama + nginx'i başlat
  info "İmaj derleniyor ve servisler başlatılıyor…"
  $DC up -d --build

  info "Nginx'in hazır olması bekleniyor…"
  sleep 5

  # 3) Geçici sertifikayı sil, gerçeğini iste
  info "Let's Encrypt'ten gerçek sertifika alınıyor…"
  rm -rf "${CERT_PATH}"

  STAGING_ARG=""
  if [ "$STAGING" = "1" ]; then
    STAGING_ARG="--staging"
    warn "STAGING modu aktif — test sertifikası alınacak (tarayıcı güvenmez)."
  fi

  $DC run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    ${STAGING_ARG} \
    -d "${DOMAIN}" \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos --no-eff-email \
    --non-interactive

  # 4) Nginx'i gerçek sertifikayla yeniden yükle
  info "Nginx yeniden yükleniyor…"
  $DC exec nginx nginx -s reload || $DC restart nginx
  ok "HTTPS sertifikası kuruldu."
else
  info "Mevcut sertifika bulundu — güncelleme dağıtımı yapılıyor."
  $DC up -d --build
  $DC exec nginx nginx -s reload || $DC restart nginx
fi

echo
ok "Dağıtım tamamlandı!"
echo "   🌐 https://${DOMAIN}"
echo "   👤 Giriş: ${ADMIN_EMAIL:-admin@gezegen.com} / ${ADMIN_PASSWORD:-admin123}"
echo
warn "Güvenlik: İlk girişten sonra yönetici şifresini değiştirin ve"
warn "deploy.env içindeki ADMIN_PASSWORD değerini güncelleyin."
