-- CreateTable
CREATE TABLE "Urun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "kategori" TEXT,
    "birim" TEXT NOT NULL DEFAULT 'adet',
    "listeFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "kdvOrani" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "stokTakibi" BOOLEAN NOT NULL DEFAULT false,
    "stokMiktar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kritikStok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Urun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "sabitFiyat" BOOLEAN NOT NULL DEFAULT false,
    "fiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iskontoOrani" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaketKalemi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paketId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaketKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kampanya" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "tip" TEXT NOT NULL DEFAULT 'yuzde',
    "durum" TEXT NOT NULL DEFAULT 'taslak',
    "baslangic" TIMESTAMP(3) NOT NULL,
    "bitis" TIMESTAMP(3) NOT NULL,
    "deger" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alN" INTEGER NOT NULL DEFAULT 0,
    "odeM" INTEGER NOT NULL DEFAULT 0,
    "kota" INTEGER NOT NULL DEFAULT 0,
    "kullanilan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kampanya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KampanyaUrun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kampanyaId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,

    CONSTRAINT "KampanyaUrun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KampanyaPaket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kampanyaId" TEXT NOT NULL,
    "paketId" TEXT NOT NULL,

    CONSTRAINT "KampanyaPaket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KampanyaFirma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kampanyaId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,

    CONSTRAINT "KampanyaFirma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KampanyaKullanim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kampanyaId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "indirimTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "referans" TEXT,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "kullananId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KampanyaKullanim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StokHareketi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL,
    "sonrakiBakiye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "referans" TEXT,
    "kullaniciId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokHareketi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Urun_tenantId_durum_ad_idx" ON "Urun"("tenantId", "durum", "ad");

-- CreateIndex
CREATE INDEX "Urun_tenantId_kategori_idx" ON "Urun"("tenantId", "kategori");

-- CreateIndex
CREATE UNIQUE INDEX "Urun_tenantId_kod_key" ON "Urun"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "Paket_tenantId_durum_idx" ON "Paket"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Paket_tenantId_firmaId_idx" ON "Paket"("tenantId", "firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Paket_tenantId_kod_key" ON "Paket"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "PaketKalemi_tenantId_paketId_idx" ON "PaketKalemi"("tenantId", "paketId");

-- CreateIndex
CREATE UNIQUE INDEX "PaketKalemi_paketId_urunId_key" ON "PaketKalemi"("paketId", "urunId");

-- CreateIndex
CREATE INDEX "Kampanya_tenantId_durum_baslangic_idx" ON "Kampanya"("tenantId", "durum", "baslangic");

-- CreateIndex
CREATE UNIQUE INDEX "Kampanya_tenantId_kod_key" ON "Kampanya"("tenantId", "kod");

-- CreateIndex
CREATE INDEX "KampanyaUrun_tenantId_kampanyaId_idx" ON "KampanyaUrun"("tenantId", "kampanyaId");

-- CreateIndex
CREATE UNIQUE INDEX "KampanyaUrun_kampanyaId_urunId_key" ON "KampanyaUrun"("kampanyaId", "urunId");

-- CreateIndex
CREATE INDEX "KampanyaPaket_tenantId_kampanyaId_idx" ON "KampanyaPaket"("tenantId", "kampanyaId");

-- CreateIndex
CREATE UNIQUE INDEX "KampanyaPaket_kampanyaId_paketId_key" ON "KampanyaPaket"("kampanyaId", "paketId");

-- CreateIndex
CREATE INDEX "KampanyaFirma_tenantId_kampanyaId_idx" ON "KampanyaFirma"("tenantId", "kampanyaId");

-- CreateIndex
CREATE UNIQUE INDEX "KampanyaFirma_kampanyaId_firmaId_key" ON "KampanyaFirma"("kampanyaId", "firmaId");

-- CreateIndex
CREATE INDEX "KampanyaKullanim_tenantId_kampanyaId_createdAt_idx" ON "KampanyaKullanim"("tenantId", "kampanyaId", "createdAt");

-- CreateIndex
CREATE INDEX "KampanyaKullanim_tenantId_firmaId_idx" ON "KampanyaKullanim"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "StokHareketi_tenantId_urunId_createdAt_idx" ON "StokHareketi"("tenantId", "urunId", "createdAt");

-- CreateIndex
CREATE INDEX "StokHareketi_tenantId_createdAt_idx" ON "StokHareketi"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paket" ADD CONSTRAINT "Paket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paket" ADD CONSTRAINT "Paket_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaketKalemi" ADD CONSTRAINT "PaketKalemi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaketKalemi" ADD CONSTRAINT "PaketKalemi_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "Paket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaketKalemi" ADD CONSTRAINT "PaketKalemi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kampanya" ADD CONSTRAINT "Kampanya_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaUrun" ADD CONSTRAINT "KampanyaUrun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaUrun" ADD CONSTRAINT "KampanyaUrun_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaUrun" ADD CONSTRAINT "KampanyaUrun_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaPaket" ADD CONSTRAINT "KampanyaPaket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaPaket" ADD CONSTRAINT "KampanyaPaket_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaPaket" ADD CONSTRAINT "KampanyaPaket_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "Paket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaFirma" ADD CONSTRAINT "KampanyaFirma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaFirma" ADD CONSTRAINT "KampanyaFirma_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaFirma" ADD CONSTRAINT "KampanyaFirma_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaKullanim" ADD CONSTRAINT "KampanyaKullanim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaKullanim" ADD CONSTRAINT "KampanyaKullanim_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KampanyaKullanim" ADD CONSTRAINT "KampanyaKullanim_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────
-- Her yeni tablo iki politika alır: kiracı bağlamı ve yönetim bağlamı.
-- Bağlam ayarlanmazsa tablo SIFIR satır döndürür — uygulama katmanı filtreyi
-- unutsa bile veri sızmaz.

ALTER TABLE "Urun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Urun" FORCE ROW LEVEL SECURITY;
CREATE POLICY urun_kiraci ON "Urun"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY urun_yonetim ON "Urun"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Paket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Paket" FORCE ROW LEVEL SECURITY;
CREATE POLICY paket_kiraci ON "Paket"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY paket_yonetim ON "Paket"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "PaketKalemi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaketKalemi" FORCE ROW LEVEL SECURITY;
CREATE POLICY paket_kalemi_kiraci ON "PaketKalemi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY paket_kalemi_yonetim ON "PaketKalemi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Kampanya" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Kampanya" FORCE ROW LEVEL SECURITY;
CREATE POLICY kampanya_kiraci ON "Kampanya"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kampanya_yonetim ON "Kampanya"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KampanyaUrun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KampanyaUrun" FORCE ROW LEVEL SECURITY;
CREATE POLICY kampanya_urun_kiraci ON "KampanyaUrun"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kampanya_urun_yonetim ON "KampanyaUrun"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KampanyaPaket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KampanyaPaket" FORCE ROW LEVEL SECURITY;
CREATE POLICY kampanya_paket_kiraci ON "KampanyaPaket"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kampanya_paket_yonetim ON "KampanyaPaket"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KampanyaFirma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KampanyaFirma" FORCE ROW LEVEL SECURITY;
CREATE POLICY kampanya_firma_kiraci ON "KampanyaFirma"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kampanya_firma_yonetim ON "KampanyaFirma"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KampanyaKullanim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KampanyaKullanim" FORCE ROW LEVEL SECURITY;
CREATE POLICY kampanya_kullanim_kiraci ON "KampanyaKullanim"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kampanya_kullanim_yonetim ON "KampanyaKullanim"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "StokHareketi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StokHareketi" FORCE ROW LEVEL SECURITY;
CREATE POLICY stok_hareketi_kiraci ON "StokHareketi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY stok_hareketi_yonetim ON "StokHareketi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri adımı: paketlere yeni modüller ────────────────────────────────────
-- RLS altında veri adımı yönetim bağlamı gerektirir; yoksa UPDATE sessizce
-- sıfır satır etkiler (Faz 6'da yaşandı).
SELECT set_config('app.yonetim', 'evet', true);

-- Yeni modüller, modül listesi tanımlı olan her pakete eklenir: yükseltme
-- kimsenin kullandığı bir özelliği kapatmamalıdır. Paketi daraltmak platform
-- sahibinin admin panelden vereceği bilinçli bir karardır.
UPDATE "Plan" SET "moduller" = array_append("moduller", 'urun')
WHERE NOT ('urun' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'kampanya')
WHERE NOT ('kampanya' = ANY ("moduller"));
UPDATE "Plan" SET "moduller" = array_append("moduller", 'stok')
WHERE NOT ('stok' = ANY ("moduller"));
