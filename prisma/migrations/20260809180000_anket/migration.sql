-- CreateTable
CREATE TABLE "Anket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'taslak',
    "anonim" BOOLEAN NOT NULL DEFAULT false,
    "bitisTarihi" TIMESTAMP(3),
    "olusturanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnketSorusu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anketId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "tip" TEXT NOT NULL DEFAULT 'metin',
    "metin" TEXT NOT NULL,
    "secenekler" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zorunlu" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AnketSorusu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnketGonderim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anketId" TEXT NOT NULL,
    "firmaId" TEXT,
    "kisiId" TEXT,
    "ad" TEXT,
    "email" TEXT NOT NULL,
    "tokenOzeti" TEXT NOT NULL,
    "gonderimTarihi" TIMESTAMP(3),
    "yanitTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnketGonderim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnketYanit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anketId" TEXT NOT NULL,
    "soruId" TEXT NOT NULL,
    "gonderimId" TEXT,
    "firmaId" TEXT,
    "yanitGrubu" TEXT NOT NULL,
    "deger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnketYanit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anket_tenantId_durum_idx" ON "Anket"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "AnketSorusu_tenantId_anketId_idx" ON "AnketSorusu"("tenantId", "anketId");

-- CreateIndex
CREATE UNIQUE INDEX "AnketGonderim_tokenOzeti_key" ON "AnketGonderim"("tokenOzeti");

-- CreateIndex
CREATE INDEX "AnketGonderim_tenantId_anketId_idx" ON "AnketGonderim"("tenantId", "anketId");

-- CreateIndex
CREATE INDEX "AnketYanit_tenantId_anketId_idx" ON "AnketYanit"("tenantId", "anketId");

-- CreateIndex
CREATE INDEX "AnketYanit_tenantId_soruId_idx" ON "AnketYanit"("tenantId", "soruId");

-- CreateIndex
CREATE INDEX "AnketYanit_tenantId_yanitGrubu_idx" ON "AnketYanit"("tenantId", "yanitGrubu");

-- AddForeignKey
ALTER TABLE "Anket" ADD CONSTRAINT "Anket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketSorusu" ADD CONSTRAINT "AnketSorusu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketSorusu" ADD CONSTRAINT "AnketSorusu_anketId_fkey" FOREIGN KEY ("anketId") REFERENCES "Anket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketGonderim" ADD CONSTRAINT "AnketGonderim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketGonderim" ADD CONSTRAINT "AnketGonderim_anketId_fkey" FOREIGN KEY ("anketId") REFERENCES "Anket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketGonderim" ADD CONSTRAINT "AnketGonderim_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketYanit" ADD CONSTRAINT "AnketYanit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketYanit" ADD CONSTRAINT "AnketYanit_anketId_fkey" FOREIGN KEY ("anketId") REFERENCES "Anket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketYanit" ADD CONSTRAINT "AnketYanit_soruId_fkey" FOREIGN KEY ("soruId") REFERENCES "AnketSorusu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnketYanit" ADD CONSTRAINT "AnketYanit_gonderimId_fkey" FOREIGN KEY ("gonderimId") REFERENCES "AnketGonderim"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────

ALTER TABLE "Anket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Anket" FORCE ROW LEVEL SECURITY;
CREATE POLICY anket_kiraci ON "Anket"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY anket_yonetim ON "Anket"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "AnketSorusu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnketSorusu" FORCE ROW LEVEL SECURITY;
CREATE POLICY anket_sorusu_kiraci ON "AnketSorusu"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY anket_sorusu_yonetim ON "AnketSorusu"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "AnketGonderim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnketGonderim" FORCE ROW LEVEL SECURITY;
CREATE POLICY anket_gonderim_kiraci ON "AnketGonderim"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY anket_gonderim_yonetim ON "AnketGonderim"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "AnketYanit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnketYanit" FORCE ROW LEVEL SECURITY;
CREATE POLICY anket_yanit_kiraci ON "AnketYanit"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY anket_yanit_yonetim ON "AnketYanit"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── BEŞİNCİ BAĞLAM: anket yanıtlama (Faz 19 / N3) ────────────────────────
--
-- Anketi dolduran kişi uygulamanın KULLANICISI DEĞİLDİR: müşterinin bir
-- çalışanıdır, hesabı yoktur ve olmayacaktır. Bu yüzden oturum ve kiracı
-- bağlamı kurulamaz — davet akışındaki (Faz 5) aynı durum.
--
-- Kapsam BİLİNÇLİ OLARAK DAR: yalnızca dört anket tablosu. İş verisine
-- (firma, teklif, kişi, sipariş…) hiçbir erişim yoktur; anket sayfası
-- firmanın adını bile gönderim kaydından okur.
--
-- Yazma yalnızca yanıt satırlarına ve gönderimin "yanıtlandı" damgasına
-- açıktır: Anket ve AnketSorusu bu bağlamda SALT OKUNURDUR, yani anketi
-- dolduran kişi soruyu değiştiremez.
--
-- Tek kullanıcısı `src/lib/anket-db.ts`'tir; regresyon testi bu bağlamın
-- o dosyanın dışında kullanılmadığını sürekli denetler.
CREATE OR REPLACE FUNCTION app_anket() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.anket', true) = 'evet' $$;

-- Anketin başlığı, anonimlik bayrağı ve bitiş tarihi okunur.
CREATE POLICY anket_yanitlama ON "Anket"
  FOR SELECT USING (app_anket());
-- Sorular okunur, DEĞİŞTİRİLEMEZ.
CREATE POLICY anket_sorusu_yanitlama ON "AnketSorusu"
  FOR SELECT USING (app_anket());
-- Gönderim token özetiyle bulunur ve yanıtlandığında damgalanır.
CREATE POLICY anket_gonderim_yanitlama ON "AnketGonderim"
  FOR SELECT USING (app_anket());
CREATE POLICY anket_gonderim_yanitlama_yaz ON "AnketGonderim"
  FOR UPDATE USING (app_anket()) WITH CHECK (app_anket());
-- Yanıt YAZILIR; okuma bilinçli olarak VERİLMEZ — anketi dolduran kişi
-- başkalarının yanıtlarını göremez.
CREATE POLICY anket_yanit_yanitlama ON "AnketYanit"
  FOR INSERT WITH CHECK (app_anket());


-- ── Veri adımı: paketlere anket modülü ────────────────────────────────────
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'anket')
WHERE NOT ('anket' = ANY ("moduller"));
