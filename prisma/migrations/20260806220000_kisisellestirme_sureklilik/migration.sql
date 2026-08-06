-- CreateTable
CREATE TABLE "PanoTercihi" (
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "kartlar" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanoTercihi_pkey" PRIMARY KEY ("kullaniciId")
);

-- CreateTable
CREATE TABLE "KayitliGorunum" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "liste" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sorgu" TEXT NOT NULL,
    "paylasilan" BOOLEAN NOT NULL DEFAULT false,
    "varsayilan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KayitliGorunum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yedek" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tur" TEXT NOT NULL DEFAULT 'elle',
    "kayitSayisi" INTEGER NOT NULL DEFAULT 0,
    "boyut" INTEGER NOT NULL DEFAULT 0,
    "surum" TEXT,
    "icerik" BYTEA NOT NULL,
    "olusturanEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Yedek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanoTercihi_tenantId_idx" ON "PanoTercihi"("tenantId");

-- CreateIndex
CREATE INDEX "KayitliGorunum_tenantId_liste_idx" ON "KayitliGorunum"("tenantId", "liste");

-- CreateIndex
CREATE UNIQUE INDEX "KayitliGorunum_tenantId_kullaniciId_liste_ad_key" ON "KayitliGorunum"("tenantId", "kullaniciId", "liste", "ad");

-- CreateIndex
CREATE INDEX "Yedek_tenantId_createdAt_idx" ON "Yedek"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "PanoTercihi" ADD CONSTRAINT "PanoTercihi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KayitliGorunum" ADD CONSTRAINT "KayitliGorunum_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Yedek" ADD CONSTRAINT "Yedek_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security ────────────────────────────────────────────────────
-- Üç yeni tablo da kiracı sınırındaki ikinci savunma hattına alınır.
-- (Regresyon testi tablo listesini şemadan türetir; birini atlamak testi kırar.)

ALTER TABLE "PanoTercihi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PanoTercihi" FORCE ROW LEVEL SECURITY;
CREATE POLICY pano_tercihi_kiraci ON "PanoTercihi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY pano_tercihi_yonetim ON "PanoTercihi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KayitliGorunum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KayitliGorunum" FORCE ROW LEVEL SECURITY;
CREATE POLICY kayitli_gorunum_kiraci ON "KayitliGorunum"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kayitli_gorunum_yonetim ON "KayitliGorunum"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Yedek" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Yedek" FORCE ROW LEVEL SECURITY;
CREATE POLICY yedek_kiraci ON "Yedek"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY yedek_yonetim ON "Yedek"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
