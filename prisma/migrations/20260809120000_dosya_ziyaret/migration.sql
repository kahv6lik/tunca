-- AlterTable
ALTER TABLE "Firma" ADD COLUMN     "boylam" DOUBLE PRECISION,
ADD COLUMN     "enlem" DOUBLE PRECISION,
ADD COLUMN     "konumAdres" TEXT,
ADD COLUMN     "konumKaynak" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "dosyaKotaMb" INTEGER NOT NULL DEFAULT 2048,
ADD COLUMN     "ziyaretYaricapM" INTEGER NOT NULL DEFAULT 300;

-- CreateTable
CREATE TABLE "Dosya" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT,
    "aktiviteId" TEXT,
    "destekId" TEXT,
    "siparisId" TEXT,
    "teklifId" TEXT,
    "ad" TEXT NOT NULL,
    "yol" TEXT NOT NULL,
    "mimeTuru" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "genislik" INTEGER,
    "yukseklik" INTEGER,
    "yukleyenId" TEXT,
    "yukleyenEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dosya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ziyaret" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "aktiviteId" TEXT,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),
    "sureDakika" INTEGER,
    "enlem" DOUBLE PRECISION,
    "boylam" DOUBLE PRECISION,
    "mesafeM" INTEGER,
    "dogrulama" TEXT NOT NULL DEFAULT 'alinamadi',
    "yaricapM" INTEGER NOT NULL,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ziyaret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dosya_tenantId_firmaId_idx" ON "Dosya"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Dosya_tenantId_aktiviteId_idx" ON "Dosya"("tenantId", "aktiviteId");

-- CreateIndex
CREATE INDEX "Dosya_tenantId_destekId_idx" ON "Dosya"("tenantId", "destekId");

-- CreateIndex
CREATE INDEX "Dosya_tenantId_siparisId_idx" ON "Dosya"("tenantId", "siparisId");

-- CreateIndex
CREATE INDEX "Dosya_tenantId_teklifId_idx" ON "Dosya"("tenantId", "teklifId");

-- CreateIndex
CREATE INDEX "Dosya_tenantId_createdAt_idx" ON "Dosya"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Ziyaret_tenantId_firmaId_idx" ON "Ziyaret"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Ziyaret_tenantId_kullaniciId_baslangic_idx" ON "Ziyaret"("tenantId", "kullaniciId", "baslangic");

-- CreateIndex
CREATE INDEX "Ziyaret_tenantId_dogrulama_idx" ON "Ziyaret"("tenantId", "dogrulama");

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_aktiviteId_fkey" FOREIGN KEY ("aktiviteId") REFERENCES "Aktivite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_destekId_fkey" FOREIGN KEY ("destekId") REFERENCES "DestekKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "Siparis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dosya" ADD CONSTRAINT "Dosya_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ziyaret" ADD CONSTRAINT "Ziyaret_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ziyaret" ADD CONSTRAINT "Ziyaret_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────

ALTER TABLE "Dosya" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dosya" FORCE ROW LEVEL SECURITY;
CREATE POLICY dosya_kiraci ON "Dosya"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY dosya_yonetim ON "Dosya"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Ziyaret" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ziyaret" FORCE ROW LEVEL SECURITY;
CREATE POLICY ziyaret_kiraci ON "Ziyaret"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY ziyaret_yonetim ON "Ziyaret"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri adımı: paketlere yeni modüller ────────────────────────────────────
-- Mevcut paketlere "dosya" ve "ziyaret" modülleri eklenir; yükseltme hiçbir
-- kiracının elindeki özelliği KAPATMAMALIDIR. Temiz kurulumda paketleri seed
-- yarattığı için `prisma/seed.ts` listesi de güncellenir (regresyon testi
-- ikisinin tutarlı kalmasını denetler).
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'dosya')
WHERE NOT ('dosya' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'ziyaret')
WHERE NOT ('ziyaret' = ANY ("moduller"));
