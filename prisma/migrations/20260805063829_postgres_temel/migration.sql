-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "vergiNo" TEXT,
    "sektor" TEXT,
    "il" TEXT,
    "ilce" TEXT,
    "yetkiliAd" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YatirimDestegi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'basvuruldu',
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YatirimDestegi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Egitim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "konu" TEXT,
    "egitmen" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sureSaat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "katilimci" INTEGER NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'planlandi',
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Egitim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hizmet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'devam',
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hizmet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_durum_idx" ON "Tenant"("durum");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Firma_tenantId_ad_idx" ON "Firma"("tenantId", "ad");

-- CreateIndex
CREATE INDEX "Firma_tenantId_il_idx" ON "Firma"("tenantId", "il");

-- CreateIndex
CREATE INDEX "Firma_tenantId_sektor_idx" ON "Firma"("tenantId", "sektor");

-- CreateIndex
CREATE INDEX "Firma_tenantId_durum_idx" ON "Firma"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Firma_tenantId_createdAt_idx" ON "Firma"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "YatirimDestegi_tenantId_firmaId_idx" ON "YatirimDestegi"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "YatirimDestegi_tenantId_durum_idx" ON "YatirimDestegi"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "YatirimDestegi_tenantId_tarih_idx" ON "YatirimDestegi"("tenantId", "tarih");

-- CreateIndex
CREATE INDEX "Egitim_tenantId_firmaId_idx" ON "Egitim"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Egitim_tenantId_durum_idx" ON "Egitim"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Egitim_tenantId_tarih_idx" ON "Egitim"("tenantId", "tarih");

-- CreateIndex
CREATE INDEX "Hizmet_tenantId_firmaId_idx" ON "Hizmet"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Hizmet_tenantId_durum_idx" ON "Hizmet"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Hizmet_tenantId_tarih_idx" ON "Hizmet"("tenantId", "tarih");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YatirimDestegi" ADD CONSTRAINT "YatirimDestegi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YatirimDestegi" ADD CONSTRAINT "YatirimDestegi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egitim" ADD CONSTRAINT "Egitim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egitim" ADD CONSTRAINT "Egitim_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hizmet" ADD CONSTRAINT "Hizmet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hizmet" ADD CONSTRAINT "Hizmet_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
