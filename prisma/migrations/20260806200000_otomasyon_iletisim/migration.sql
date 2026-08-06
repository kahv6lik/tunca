-- CreateTable
CREATE TABLE "Bildirim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "mesaj" TEXT,
    "link" TEXT,
    "okundu" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bildirim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BildirimTercihi" (
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "uygulama" BOOLEAN NOT NULL DEFAULT true,
    "eposta" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BildirimTercihi_pkey" PRIMARY KEY ("kullaniciId","tur")
);

-- CreateTable
CREATE TABLE "EpostaAyari" (
    "tenantId" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpGuvenli" BOOLEAN NOT NULL DEFAULT false,
    "smtpKullanici" TEXT,
    "smtpParola" TEXT,
    "gonderenAd" TEXT,
    "gonderenAdres" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapKullanici" TEXT,
    "imapParola" TEXT,
    "imapKlasor" TEXT NOT NULL DEFAULT 'INBOX',
    "sonSenkron" TIMESTAMP(3),
    "sonHata" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpostaAyari_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "EpostaKuyrugu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alici" TEXT NOT NULL,
    "konu" TEXT NOT NULL,
    "govde" TEXT NOT NULL,
    "tur" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "denemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "hata" TEXT,
    "gonderimZamani" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpostaKuyrugu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpostaKaydi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mesajId" TEXT NOT NULL,
    "yon" TEXT NOT NULL DEFAULT 'gelen',
    "gonderen" TEXT NOT NULL,
    "alici" TEXT NOT NULL,
    "konu" TEXT NOT NULL,
    "ozet" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL,
    "firmaId" TEXT,
    "kisiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpostaKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsAkisi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "tetikleyici" TEXT NOT NULL,
    "kosullar" JSONB,
    "eylemler" JSONB NOT NULL,
    "sonCalisma" TIMESTAMP(3),
    "calismaSayisi" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IsAkisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsAkisiCalismasi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isAkisiId" TEXT NOT NULL,
    "hedefTur" TEXT,
    "hedefId" TEXT,
    "sonuc" TEXT NOT NULL,
    "ozet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IsAkisiCalismasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bildirim_tenantId_kullaniciId_okundu_idx" ON "Bildirim"("tenantId", "kullaniciId", "okundu");

-- CreateIndex
CREATE INDEX "Bildirim_tenantId_createdAt_idx" ON "Bildirim"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BildirimTercihi_tenantId_kullaniciId_idx" ON "BildirimTercihi"("tenantId", "kullaniciId");

-- CreateIndex
CREATE INDEX "EpostaAyari_tenantId_idx" ON "EpostaAyari"("tenantId");

-- CreateIndex
CREATE INDEX "EpostaKuyrugu_tenantId_durum_idx" ON "EpostaKuyrugu"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "EpostaKuyrugu_tenantId_createdAt_idx" ON "EpostaKuyrugu"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EpostaKaydi_tenantId_tarih_idx" ON "EpostaKaydi"("tenantId", "tarih");

-- CreateIndex
CREATE INDEX "EpostaKaydi_tenantId_firmaId_idx" ON "EpostaKaydi"("tenantId", "firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "EpostaKaydi_tenantId_mesajId_key" ON "EpostaKaydi"("tenantId", "mesajId");

-- CreateIndex
CREATE INDEX "IsAkisi_tenantId_aktif_idx" ON "IsAkisi"("tenantId", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "IsAkisi_tenantId_ad_key" ON "IsAkisi"("tenantId", "ad");

-- CreateIndex
CREATE INDEX "IsAkisiCalismasi_tenantId_isAkisiId_createdAt_idx" ON "IsAkisiCalismasi"("tenantId", "isAkisiId", "createdAt");

-- AddForeignKey
ALTER TABLE "Bildirim" ADD CONSTRAINT "Bildirim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BildirimTercihi" ADD CONSTRAINT "BildirimTercihi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpostaAyari" ADD CONSTRAINT "EpostaAyari_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpostaKuyrugu" ADD CONSTRAINT "EpostaKuyrugu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpostaKaydi" ADD CONSTRAINT "EpostaKaydi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsAkisi" ADD CONSTRAINT "IsAkisi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsAkisiCalismasi" ADD CONSTRAINT "IsAkisiCalismasi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IsAkisiCalismasi" ADD CONSTRAINT "IsAkisiCalismasi_isAkisiId_fkey" FOREIGN KEY ("isAkisiId") REFERENCES "IsAkisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ── Row-Level Security ────────────────────────────────────────────────────
-- Yeni yedi tablo da kiracı sınırındaki ikinci savunma hattına alınır.

ALTER TABLE "Bildirim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bildirim" FORCE ROW LEVEL SECURITY;
CREATE POLICY bildirim_kiraci ON "Bildirim"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY bildirim_yonetim ON "Bildirim"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "BildirimTercihi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BildirimTercihi" FORCE ROW LEVEL SECURITY;
CREATE POLICY bildirim_tercihi_kiraci ON "BildirimTercihi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY bildirim_tercihi_yonetim ON "BildirimTercihi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "EpostaAyari" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EpostaAyari" FORCE ROW LEVEL SECURITY;
CREATE POLICY eposta_ayari_kiraci ON "EpostaAyari"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY eposta_ayari_yonetim ON "EpostaAyari"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "EpostaKuyrugu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EpostaKuyrugu" FORCE ROW LEVEL SECURITY;
CREATE POLICY eposta_kuyrugu_kiraci ON "EpostaKuyrugu"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY eposta_kuyrugu_yonetim ON "EpostaKuyrugu"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "EpostaKaydi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EpostaKaydi" FORCE ROW LEVEL SECURITY;
CREATE POLICY eposta_kaydi_kiraci ON "EpostaKaydi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY eposta_kaydi_yonetim ON "EpostaKaydi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "IsAkisi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IsAkisi" FORCE ROW LEVEL SECURITY;
CREATE POLICY is_akisi_kiraci ON "IsAkisi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY is_akisi_yonetim ON "IsAkisi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "IsAkisiCalismasi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IsAkisiCalismasi" FORCE ROW LEVEL SECURITY;
CREATE POLICY is_akisi_calismasi_kiraci ON "IsAkisiCalismasi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY is_akisi_calismasi_yonetim ON "IsAkisiCalismasi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Mevcut paketlere yeni modüller ────────────────────────────────────────
-- Paket kısıtı "listede olmayan modül kapalıdır" biçimindedir; yeni modüller
-- mevcut paketlere yazılmazsa paketli kiracılar bunları yitirirdi.
-- RLS açık olduğu için yönetim bağlamı şart (aksi halde UPDATE sıfır satır
-- görür ve sessizce hiçbir şey yapmaz).
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'bildirim')
WHERE NOT ('bildirim' = ANY ("moduller"));

UPDATE "Plan" SET "moduller" = array_append("moduller", 'takvim')
WHERE NOT ('takvim' = ANY ("moduller"));

UPDATE "Plan" SET "moduller" = array_append("moduller", 'otomasyon')
WHERE NOT ('otomasyon' = ANY ("moduller"));
