-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Firma" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "YatirimDestegi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tutar" REAL NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'basvuruldu',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YatirimDestegi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Egitim" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Egitim_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hizmet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tur" TEXT,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'devam',
    "aciklama" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Hizmet_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Firma_ad_idx" ON "Firma"("ad");

-- CreateIndex
CREATE INDEX "Firma_il_idx" ON "Firma"("il");

-- CreateIndex
CREATE INDEX "Firma_sektor_idx" ON "Firma"("sektor");

-- CreateIndex
CREATE INDEX "YatirimDestegi_firmaId_idx" ON "YatirimDestegi"("firmaId");

-- CreateIndex
CREATE INDEX "YatirimDestegi_durum_idx" ON "YatirimDestegi"("durum");

-- CreateIndex
CREATE INDEX "Egitim_firmaId_idx" ON "Egitim"("firmaId");

-- CreateIndex
CREATE INDEX "Egitim_durum_idx" ON "Egitim"("durum");

-- CreateIndex
CREATE INDEX "Hizmet_firmaId_idx" ON "Hizmet"("firmaId");

-- CreateIndex
CREATE INDEX "Hizmet_durum_idx" ON "Hizmet"("durum");
