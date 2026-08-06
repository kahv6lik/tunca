-- Faz 5 (B1-B7) — Admin panel: paket, davet, markalama
--
-- Yeni tablolar:
--   Plan  — abonelik paketi; kiracıya AİT DEĞİL, platform genelinde tanımlı
--   Davet — kullanıcı daveti; token'ın kendisi değil, yalnızca özeti saklanır
--
-- Tenant'a eklenenler: iletişim bilgileri, plan bağlantısı, markalama alanları.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "altAlan" TEXT,
ADD COLUMN     "anaRenk" TEXT,
ADD COLUMN     "iletisimAd" TEXT,
ADD COLUMN     "iletisimEmail" TEXT,
ADD COLUMN     "iletisimTel" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "notlar" TEXT,
ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "kullaniciLimiti" INTEGER NOT NULL DEFAULT 0,
    "firmaLimiti" INTEGER NOT NULL DEFAULT 0,
    "moduller" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Davet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'uye',
    "tokenOzeti" TEXT NOT NULL,
    "sonKullanma" TIMESTAMP(3) NOT NULL,
    "kullanildi" TIMESTAMP(3),
    "olusturanEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Davet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_ad_key" ON "Plan"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Davet_tokenOzeti_key" ON "Davet"("tokenOzeti");

-- CreateIndex
CREATE INDEX "Davet_tenantId_email_idx" ON "Davet"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Davet_tenantId_createdAt_idx" ON "Davet"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_altAlan_key" ON "Tenant"("altAlan");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Davet" ADD CONSTRAINT "Davet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security ────────────────────────────────────────────────────

-- Plan: kiracıya ait değil. Herkes okuyabilir (kiracı kendi limitini görmeli),
-- yalnızca yönetim bağlamı yazabilir.
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plan" FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_okuma ON "Plan" FOR SELECT USING (true);
CREATE POLICY plan_yonetim ON "Plan"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- Davet: kiracı sınırına tabi. Ek olarak kimlik doğrulama bağlamı SALT OKUMA
-- yapabilir — davet bağlantısına tıklayan kişinin henüz oturumu yoktur, daveti
-- doğrulamak için okuma gerekir.
ALTER TABLE "Davet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Davet" FORCE ROW LEVEL SECURITY;
CREATE POLICY davet_kiraci ON "Davet"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY davet_yonetim ON "Davet"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
CREATE POLICY davet_kimlik ON "Davet"
  FOR SELECT USING (app_kimlik());
