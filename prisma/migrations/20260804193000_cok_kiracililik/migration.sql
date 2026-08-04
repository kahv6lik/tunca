-- Faz 1 (A1) — Çok kiracılılık veri modeli
--
-- Bu migration mevcut veriyi KORUR: önce varsayılan bir kiracı oluşturulur,
-- ardından tüm mevcut kayıtlar bu kiracıya bağlanır. Tek kiracılı bir kurulum
-- migration sonrasında aynı şekilde çalışmaya devam eder.
--
-- Kiracının adını/kodunu sonradan değiştirmek için:
--   UPDATE "Tenant" SET "ad" = 'Şirket Adı', "slug" = 'sirket-kodu'
--   WHERE "id" = 'varsayilan_kiraci';

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);


-- Varsayılan kiracı (mevcut verinin taşınacağı kiracı)
INSERT INTO "Tenant" ("id", "ad", "slug", "durum", "createdAt", "updatedAt")
VALUES ('varsayilan_kiraci', 'Gezegen Danışmanlık', 'gezegen', 'aktif', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Egitim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "konu" TEXT,
    "egitmen" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sureSaat" REAL NOT NULL DEFAULT 0,
    "katilimci" INTEGER NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'planlandi',
    "notlar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Egitim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Egitim_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Egitim" ("tenantId", "baslik", "createdAt", "durum", "egitmen", "firmaId", "id", "katilimci", "konu", "notlar", "sureSaat", "tarih") SELECT 'varsayilan_kiraci', "baslik", "createdAt", "durum", "egitmen", "firmaId", "id", "katilimci", "konu", "notlar", "sureSaat", "tarih" FROM "Egitim";
DROP TABLE "Egitim";
ALTER TABLE "new_Egitim" RENAME TO "Egitim";
CREATE INDEX "Egitim_tenantId_firmaId_idx" ON "Egitim"("tenantId", "firmaId");
CREATE INDEX "Egitim_tenantId_durum_idx" ON "Egitim"("tenantId", "durum");
CREATE INDEX "Egitim_tenantId_tarih_idx" ON "Egitim"("tenantId", "tarih");
CREATE TABLE "new_Firma" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Firma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Firma" ("tenantId", "ad", "adres", "createdAt", "durum", "email", "id", "il", "ilce", "notlar", "sektor", "telefon", "updatedAt", "vergiNo", "yetkiliAd") SELECT 'varsayilan_kiraci', "ad", "adres", "createdAt", "durum", "email", "id", "il", "ilce", "notlar", "sektor", "telefon", "updatedAt", "vergiNo", "yetkiliAd" FROM "Firma";
DROP TABLE "Firma";
ALTER TABLE "new_Firma" RENAME TO "Firma";
CREATE INDEX "Firma_tenantId_ad_idx" ON "Firma"("tenantId", "ad");
CREATE INDEX "Firma_tenantId_il_idx" ON "Firma"("tenantId", "il");
CREATE INDEX "Firma_tenantId_sektor_idx" ON "Firma"("tenantId", "sektor");
CREATE INDEX "Firma_tenantId_durum_idx" ON "Firma"("tenantId", "durum");
CREATE INDEX "Firma_tenantId_createdAt_idx" ON "Firma"("tenantId", "createdAt");
CREATE TABLE "new_Hizmet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'devam',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Hizmet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hizmet_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Hizmet" ("tenantId", "aciklama", "baslik", "createdAt", "durum", "firmaId", "id", "tarih", "tur") SELECT 'varsayilan_kiraci', "aciklama", "baslik", "createdAt", "durum", "firmaId", "id", "tarih", "tur" FROM "Hizmet";
DROP TABLE "Hizmet";
ALTER TABLE "new_Hizmet" RENAME TO "Hizmet";
CREATE INDEX "Hizmet_tenantId_firmaId_idx" ON "Hizmet"("tenantId", "firmaId");
CREATE INDEX "Hizmet_tenantId_durum_idx" ON "Hizmet"("tenantId", "durum");
CREATE INDEX "Hizmet_tenantId_tarih_idx" ON "Hizmet"("tenantId", "tarih");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("tenantId", "createdAt", "email", "id", "name", "password", "role") SELECT 'varsayilan_kiraci', "createdAt", "email", "id", "name", "password", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE TABLE "new_YatirimDestegi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tutar" REAL NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'basvuruldu',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YatirimDestegi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "YatirimDestegi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_YatirimDestegi" ("tenantId", "aciklama", "baslik", "createdAt", "durum", "firmaId", "id", "paraBirimi", "tarih", "tur", "tutar") SELECT 'varsayilan_kiraci', "aciklama", "baslik", "createdAt", "durum", "firmaId", "id", "paraBirimi", "tarih", "tur", "tutar" FROM "YatirimDestegi";
DROP TABLE "YatirimDestegi";
ALTER TABLE "new_YatirimDestegi" RENAME TO "YatirimDestegi";
CREATE INDEX "YatirimDestegi_tenantId_firmaId_idx" ON "YatirimDestegi"("tenantId", "firmaId");
CREATE INDEX "YatirimDestegi_tenantId_durum_idx" ON "YatirimDestegi"("tenantId", "durum");
CREATE INDEX "YatirimDestegi_tenantId_tarih_idx" ON "YatirimDestegi"("tenantId", "tarih");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_durum_idx" ON "Tenant"("durum");

