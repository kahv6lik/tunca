# Gezegen CRM — üretim imajı
FROM node:22-slim

# Prisma için gerekli sistem kütüphaneleri
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Bağımlılıklar (postinstall prisma generate için schema gerekli)
# NODE_ENV=production olduğundan devDependencies'i (tailwindcss, typescript,
# prisma, tsx…) açıkça kuruyoruz; bunlar build ve giriş betiği için gerekli.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# Uygulama kaynak kodu
COPY . .

# Derleme sırasında Prisma'nın geçerli bir DATABASE_URL görmesi yeterli
ENV DATABASE_URL="file:/app/data/prod.db"
RUN npm run build

# Giriş betiği: migrasyonları uygula, yönetici oluştur, sunucuyu başlat
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
