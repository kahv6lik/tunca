-- AlterTable
ALTER TABLE "Aktivite" ADD COLUMN     "destekId" TEXT;

-- AlterTable
ALTER TABLE "Siparis" ADD COLUMN     "projeId" TEXT;

-- AlterTable
ALTER TABLE "Teklif" ADD COLUMN     "projeId" TEXT;

-- CreateTable
CREATE TABLE "Proje" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "sorumluId" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'planlandi',
    "baslangic" TIMESTAMP(3),
    "bitis" TIMESTAMP(3),
    "butce" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestekKaydi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kisiId" TEXT,
    "projeId" TEXT,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "kanal" TEXT NOT NULL DEFAULT 'telefon',
    "oncelik" TEXT NOT NULL DEFAULT 'orta',
    "durum" TEXT NOT NULL DEFAULT 'acik',
    "atananId" TEXT,
    "acanId" TEXT,
    "cozumTarihi" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestekKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sss" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "soru" TEXT NOT NULL,
    "yanit" TEXT NOT NULL,
    "kategori" TEXT,
    "etiketler" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "sira" INTEGER NOT NULL DEFAULT 0,
    "goruntulenme" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proje_tenantId_durum_baslangic_idx" ON "Proje"("tenantId", "durum", "baslangic");

-- CreateIndex
CREATE INDEX "Proje_tenantId_firmaId_idx" ON "Proje"("tenantId", "firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Proje_tenantId_kod_key" ON "Proje"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "DestekKaydi_tenantId_durum_oncelik_idx" ON "DestekKaydi"("tenantId", "durum", "oncelik");

-- CreateIndex
CREATE INDEX "DestekKaydi_tenantId_firmaId_idx" ON "DestekKaydi"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "DestekKaydi_tenantId_atananId_durum_idx" ON "DestekKaydi"("tenantId", "atananId", "durum");

-- CreateIndex
CREATE UNIQUE INDEX "DestekKaydi_tenantId_no_key" ON "DestekKaydi"("tenantId", "no");

-- CreateIndex
CREATE INDEX "Sss_tenantId_durum_sira_idx" ON "Sss"("tenantId", "durum", "sira");

-- CreateIndex
CREATE INDEX "Sss_tenantId_kategori_idx" ON "Sss"("tenantId", "kategori");

-- CreateIndex
CREATE INDEX "Aktivite_tenantId_destekId_idx" ON "Aktivite"("tenantId", "destekId");

-- AddForeignKey
ALTER TABLE "Aktivite" ADD CONSTRAINT "Aktivite_destekId_fkey" FOREIGN KEY ("destekId") REFERENCES "DestekKaydi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_projeId_fkey" FOREIGN KEY ("projeId") REFERENCES "Proje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_projeId_fkey" FOREIGN KEY ("projeId") REFERENCES "Proje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proje" ADD CONSTRAINT "Proje_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proje" ADD CONSTRAINT "Proje_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestekKaydi" ADD CONSTRAINT "DestekKaydi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestekKaydi" ADD CONSTRAINT "DestekKaydi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestekKaydi" ADD CONSTRAINT "DestekKaydi_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "Kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestekKaydi" ADD CONSTRAINT "DestekKaydi_projeId_fkey" FOREIGN KEY ("projeId") REFERENCES "Proje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sss" ADD CONSTRAINT "Sss_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────

ALTER TABLE "Proje" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proje" FORCE ROW LEVEL SECURITY;
CREATE POLICY proje_kiraci ON "Proje"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY proje_yonetim ON "Proje"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "DestekKaydi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DestekKaydi" FORCE ROW LEVEL SECURITY;
CREATE POLICY destek_kaydi_kiraci ON "DestekKaydi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY destek_kaydi_yonetim ON "DestekKaydi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Sss" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sss" FORCE ROW LEVEL SECURITY;
CREATE POLICY sss_kiraci ON "Sss"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY sss_yonetim ON "Sss"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri adımı: paketlere yeni modüller ────────────────────────────────────
-- DİKKAT: burası MEVCUT paketleri günceller; temiz kurulumda paketleri seed
-- sıfırdan yaratır, `prisma/seed.ts` içindeki liste de güncellenmelidir
-- (regresyon testi bunu denetliyor).
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'proje')
WHERE NOT ('proje' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'destek')
WHERE NOT ('destek' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'sss')
WHERE NOT ('sss' = ANY ("moduller"));
