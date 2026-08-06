-- CreateTable
CREATE TABLE "Aktivite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "firmaId" TEXT,
    "kisiId" TEXT,
    "firsatId" TEXT,
    "atananId" TEXT,
    "sonTarih" TIMESTAMP(3),
    "tamamlandi" TIMESTAMP(3),
    "olusturanId" TEXT,
    "olusturanEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aktivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "firmaAd" TEXT,
    "unvan" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "il" TEXT,
    "sektor" TEXT,
    "kaynak" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'yeni',
    "notlar" TEXT,
    "atananId" TEXT,
    "donusenFirmaId" TEXT,
    "donusenKisiId" TEXT,
    "donusenFirsatId" TEXT,
    "donusumTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teklif" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "firsatId" TEXT,
    "kisiId" TEXT,
    "no" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'taslak',
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "indirimOrani" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvOrani" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "araToplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indirimTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "toplam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gecerlilikTarihi" TIMESTAMP(3),
    "gonderimTarihi" TIMESTAMP(3),
    "notlar" TEXT,
    "sartlar" TEXT,
    "revizyonNo" INTEGER NOT NULL DEFAULT 1,
    "ustTeklifId" TEXT,
    "olusturanEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teklif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeklifKalemi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teklifId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aciklama" TEXT NOT NULL,
    "miktar" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "birim" TEXT NOT NULL DEFAULT 'adet',
    "birimFiyat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TeklifKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Aktivite_tenantId_firmaId_idx" ON "Aktivite"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Aktivite_tenantId_firsatId_idx" ON "Aktivite"("tenantId", "firsatId");

-- CreateIndex
CREATE INDEX "Aktivite_tenantId_atananId_sonTarih_idx" ON "Aktivite"("tenantId", "atananId", "sonTarih");

-- CreateIndex
CREATE INDEX "Aktivite_tenantId_createdAt_idx" ON "Aktivite"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_tenantId_durum_idx" ON "Lead"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Lead_tenantId_kaynak_idx" ON "Lead"("tenantId", "kaynak");

-- CreateIndex
CREATE INDEX "Lead_tenantId_atananId_idx" ON "Lead"("tenantId", "atananId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Teklif_tenantId_firmaId_idx" ON "Teklif"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Teklif_tenantId_firsatId_idx" ON "Teklif"("tenantId", "firsatId");

-- CreateIndex
CREATE INDEX "Teklif_tenantId_durum_idx" ON "Teklif"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Teklif_tenantId_createdAt_idx" ON "Teklif"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Teklif_tenantId_no_key" ON "Teklif"("tenantId", "no");

-- CreateIndex
CREATE INDEX "TeklifKalemi_tenantId_teklifId_idx" ON "TeklifKalemi"("tenantId", "teklifId");

-- AddForeignKey
ALTER TABLE "Aktivite" ADD CONSTRAINT "Aktivite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aktivite" ADD CONSTRAINT "Aktivite_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aktivite" ADD CONSTRAINT "Aktivite_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "Kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aktivite" ADD CONSTRAINT "Aktivite_firsatId_fkey" FOREIGN KEY ("firsatId") REFERENCES "Firsat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_donusenFirmaId_fkey" FOREIGN KEY ("donusenFirmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_firsatId_fkey" FOREIGN KEY ("firsatId") REFERENCES "Firsat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_ustTeklifId_fkey" FOREIGN KEY ("ustTeklifId") REFERENCES "Teklif"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security ────────────────────────────────────────────────────
-- Yeni her tablo, kiracı sınırındaki ikinci savunma hattına da alınır.
-- (Regresyon testi bu bölümü şemadan türettiği tablo listesiyle denetler;
--  bir tabloyu atlamak testi kırar.)

ALTER TABLE "Aktivite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Aktivite" FORCE ROW LEVEL SECURITY;
CREATE POLICY aktivite_kiraci ON "Aktivite"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY aktivite_yonetim ON "Aktivite"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
CREATE POLICY lead_kiraci ON "Lead"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY lead_yonetim ON "Lead"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Teklif" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teklif" FORCE ROW LEVEL SECURITY;
CREATE POLICY teklif_kiraci ON "Teklif"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY teklif_yonetim ON "Teklif"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "TeklifKalemi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeklifKalemi" FORCE ROW LEVEL SECURITY;
CREATE POLICY teklif_kalemi_kiraci ON "TeklifKalemi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY teklif_kalemi_yonetim ON "TeklifKalemi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Mevcut paketlere yeni modüller ────────────────────────────────────────
-- Paket kısıtı "listede olmayan modül kapalıdır" biçiminde çalışır; yeni
-- modüller mevcut paketlere yazılmazsa paketli kiracılar bunları yitirirdi.
-- (Faz 6'daki aynı adımın gerekçesi burada da geçerli.)
-- DİKKAT: RLS açık olduğu için yönetim bağlamı gerekir; aksi halde UPDATE
-- hiçbir satır görmez ve sessizce hiçbir şey yapmaz.
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'aktivite')
WHERE NOT ('aktivite' = ANY ("moduller"));

UPDATE "Plan" SET "moduller" = array_append("moduller", 'lead')
WHERE NOT ('lead' = ANY ("moduller"));

UPDATE "Plan" SET "moduller" = array_append("moduller", 'teklif')
WHERE NOT ('teklif' = ANY ("moduller"));
