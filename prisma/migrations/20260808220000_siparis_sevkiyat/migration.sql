-- CreateTable
CREATE TABLE "Siparis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kisiId" TEXT,
    "teklifId" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'onaybekliyor',
    "araToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indirimTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "toplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "notlar" TEXT,
    "olusturanId" TEXT,
    "onaylayanId" TEXT,
    "onayTarihi" TIMESTAMP(3),
    "redSebebi" TEXT,
    "stokDusuldu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Siparis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiparisKalemi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siparisId" TEXT NOT NULL,
    "urunId" TEXT,
    "paketId" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aciklama" TEXT NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'adet',
    "birimFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iskontoOrani" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvOrani" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "kampanyaId" TEXT,
    "indirimTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SiparisKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sevkiyat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siparisId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'hazirlaniyor',
    "tasiyici" TEXT,
    "takipNo" TEXT,
    "adres" TEXT,
    "sevkTarihi" TIMESTAMP(3),
    "teslimTarihi" TIMESTAMP(3),
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sevkiyat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BelgeSayac" (
    "tenantId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "sonSira" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BelgeSayac_pkey" PRIMARY KEY ("tenantId","tur","yil")
);

-- CreateIndex
CREATE INDEX "Siparis_tenantId_durum_createdAt_idx" ON "Siparis"("tenantId", "durum", "createdAt");

-- CreateIndex
CREATE INDEX "Siparis_tenantId_firmaId_idx" ON "Siparis"("tenantId", "firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Siparis_tenantId_no_key" ON "Siparis"("tenantId", "no");

-- CreateIndex
CREATE INDEX "SiparisKalemi_tenantId_siparisId_idx" ON "SiparisKalemi"("tenantId", "siparisId");

-- CreateIndex
CREATE INDEX "Sevkiyat_tenantId_durum_createdAt_idx" ON "Sevkiyat"("tenantId", "durum", "createdAt");

-- CreateIndex
CREATE INDEX "Sevkiyat_tenantId_siparisId_idx" ON "Sevkiyat"("tenantId", "siparisId");

-- CreateIndex
CREATE UNIQUE INDEX "Sevkiyat_tenantId_no_key" ON "Sevkiyat"("tenantId", "no");

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "Kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalemi" ADD CONSTRAINT "SiparisKalemi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalemi" ADD CONSTRAINT "SiparisKalemi_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "Siparis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalemi" ADD CONSTRAINT "SiparisKalemi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalemi" ADD CONSTRAINT "SiparisKalemi_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "Paket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiparisKalemi" ADD CONSTRAINT "SiparisKalemi_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sevkiyat" ADD CONSTRAINT "Sevkiyat_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sevkiyat" ADD CONSTRAINT "Sevkiyat_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "Siparis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BelgeSayac" ADD CONSTRAINT "BelgeSayac_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────

ALTER TABLE "Siparis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Siparis" FORCE ROW LEVEL SECURITY;
CREATE POLICY siparis_kiraci ON "Siparis"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY siparis_yonetim ON "Siparis"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "SiparisKalemi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiparisKalemi" FORCE ROW LEVEL SECURITY;
CREATE POLICY siparis_kalemi_kiraci ON "SiparisKalemi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY siparis_kalemi_yonetim ON "SiparisKalemi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Sevkiyat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sevkiyat" FORCE ROW LEVEL SECURITY;
CREATE POLICY sevkiyat_kiraci ON "Sevkiyat"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY sevkiyat_yonetim ON "Sevkiyat"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "BelgeSayac" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BelgeSayac" FORCE ROW LEVEL SECURITY;
CREATE POLICY belge_sayac_kiraci ON "BelgeSayac"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY belge_sayac_yonetim ON "BelgeSayac"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri adımı: paketlere sipariş ve sevkiyat modülleri ────────────────────
-- DİKKAT: burası MEVCUT paketleri günceller. Temiz kurulumda paketleri seed
-- sıfırdan yaratır; `prisma/seed.ts` içindeki modül listesi de güncellenmeli
-- (Faz 14'te unutuldu, sekiz kontrol birden kırmızıya döndü — regresyon
-- testi artık bunu yakalıyor).
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'siparis')
WHERE NOT ('siparis' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'sevkiyat')
WHERE NOT ('sevkiyat' = ANY ("moduller"));
