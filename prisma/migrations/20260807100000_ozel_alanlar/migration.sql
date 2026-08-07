-- CreateTable
CREATE TABLE "OzelAlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "varlik" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'metin',
    "secenekler" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zorunlu" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OzelAlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OzelAlanDeger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alanId" TEXT NOT NULL,
    "firmaId" TEXT,
    "kisiId" TEXT,
    "firsatId" TEXT,
    "deger" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OzelAlanDeger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OzelAlan_tenantId_varlik_sira_idx" ON "OzelAlan"("tenantId", "varlik", "sira");

-- CreateIndex
CREATE UNIQUE INDEX "OzelAlan_tenantId_varlik_ad_key" ON "OzelAlan"("tenantId", "varlik", "ad");

-- CreateIndex
CREATE INDEX "OzelAlanDeger_tenantId_alanId_deger_idx" ON "OzelAlanDeger"("tenantId", "alanId", "deger");

-- CreateIndex
CREATE INDEX "OzelAlanDeger_firmaId_idx" ON "OzelAlanDeger"("firmaId");

-- CreateIndex
CREATE INDEX "OzelAlanDeger_kisiId_idx" ON "OzelAlanDeger"("kisiId");

-- CreateIndex
CREATE INDEX "OzelAlanDeger_firsatId_idx" ON "OzelAlanDeger"("firsatId");

-- CreateIndex
CREATE UNIQUE INDEX "OzelAlanDeger_alanId_firmaId_key" ON "OzelAlanDeger"("alanId", "firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "OzelAlanDeger_alanId_kisiId_key" ON "OzelAlanDeger"("alanId", "kisiId");

-- CreateIndex
CREATE UNIQUE INDEX "OzelAlanDeger_alanId_firsatId_key" ON "OzelAlanDeger"("alanId", "firsatId");

-- AddForeignKey
ALTER TABLE "OzelAlan" ADD CONSTRAINT "OzelAlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OzelAlanDeger" ADD CONSTRAINT "OzelAlanDeger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OzelAlanDeger" ADD CONSTRAINT "OzelAlanDeger_alanId_fkey" FOREIGN KEY ("alanId") REFERENCES "OzelAlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OzelAlanDeger" ADD CONSTRAINT "OzelAlanDeger_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OzelAlanDeger" ADD CONSTRAINT "OzelAlanDeger_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "Kisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OzelAlanDeger" ADD CONSTRAINT "OzelAlanDeger_firsatId_fkey" FOREIGN KEY ("firsatId") REFERENCES "Firsat"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security ────────────────────────────────────────────────────
-- İki yeni tablo da kiracı sınırındaki ikinci savunma hattına alınır.
-- (Regresyon testi tablo listesini şemadan türetir; birini atlamak testi kırar.)

ALTER TABLE "OzelAlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OzelAlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY ozel_alan_kiraci ON "OzelAlan"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY ozel_alan_yonetim ON "OzelAlan"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "OzelAlanDeger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OzelAlanDeger" FORCE ROW LEVEL SECURITY;
CREATE POLICY ozel_alan_deger_kiraci ON "OzelAlanDeger"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY ozel_alan_deger_yonetim ON "OzelAlanDeger"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── Veri adımı: mevcut paketlere "ozelalan" modülü ────────────────────────
-- RLS altında veri adımı yönetim bağlamı gerektirir; yoksa UPDATE sessizce
-- sıfır satır etkiler (Faz 6'da yaşandı).
SELECT set_config('app.yonetim', 'evet', true);

-- Yeni modül, modül listesi tanımlı olan her pakete eklenir: yükseltme,
-- müşterilerin bugüne kadar kullandığı hiçbir şeyi kapatmamalıdır. Paketi
-- daraltmak platform sahibinin admin panelden vereceği bilinçli bir karardır.
UPDATE "Plan" SET "moduller" = array_append("moduller", 'ozelalan')
WHERE NOT ('ozelalan' = ANY ("moduller"));
