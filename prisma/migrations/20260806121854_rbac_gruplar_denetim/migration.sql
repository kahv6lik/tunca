-- Faz 4 (A6, A7, A8) — RBAC, kullanıcı grupları ve denetim günlüğü
--
-- Üç şey ekler:
--   1. Grup + KullaniciGrup — izinleri toplu atama
--   2. DenetimKaydi         — kim ne zaman ne değiştirdi
--   3. User.durum + rol adlarının yeni şemaya taşınması
--
-- MEVCUT KULLANICILAR: eski "admin" ve "user" rolleri yeni adlarına taşınır.
-- Bu adım atlanırsa herkes yetkisiz kalırdı — izin matrisi eski adları
-- tanımıyor. (src/lib/yetki.ts ayrıca bir emniyet eşlemesi tutar.)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "durum" TEXT NOT NULL DEFAULT 'aktif',
ALTER COLUMN "role" SET DEFAULT 'uye';

-- CreateTable
CREATE TABLE "Grup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "izinler" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KullaniciGrup" (
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grupId" TEXT NOT NULL,

    CONSTRAINT "KullaniciGrup_pkey" PRIMARY KEY ("userId","grupId")
);

-- CreateTable
CREATE TABLE "DenetimKaydi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "kullaniciEmail" TEXT NOT NULL,
    "islem" TEXT NOT NULL,
    "varlik" TEXT NOT NULL,
    "varlikId" TEXT NOT NULL,
    "ozet" TEXT,
    "eski" JSONB,
    "yeni" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DenetimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grup_tenantId_ad_idx" ON "Grup"("tenantId", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "Grup_tenantId_ad_key" ON "Grup"("tenantId", "ad");

-- CreateIndex
CREATE INDEX "KullaniciGrup_tenantId_userId_idx" ON "KullaniciGrup"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "KullaniciGrup_tenantId_grupId_idx" ON "KullaniciGrup"("tenantId", "grupId");

-- CreateIndex
CREATE INDEX "DenetimKaydi_tenantId_createdAt_idx" ON "DenetimKaydi"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DenetimKaydi_tenantId_varlik_varlikId_idx" ON "DenetimKaydi"("tenantId", "varlik", "varlikId");

-- CreateIndex
CREATE INDEX "DenetimKaydi_tenantId_kullaniciId_idx" ON "DenetimKaydi"("tenantId", "kullaniciId");

-- AddForeignKey
ALTER TABLE "Grup" ADD CONSTRAINT "Grup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciGrup" ADD CONSTRAINT "KullaniciGrup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciGrup" ADD CONSTRAINT "KullaniciGrup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KullaniciGrup" ADD CONSTRAINT "KullaniciGrup_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "Grup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DenetimKaydi" ADD CONSTRAINT "DenetimKaydi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Mevcut rolleri yeni şemaya taşı ───────────────────────────────────────
UPDATE "User" SET "role" = 'tenant_admin' WHERE "role" = 'admin';
UPDATE "User" SET "role" = 'uye'          WHERE "role" = 'user';

-- ── Row-Level Security: yeni tablolar da kiracı sınırına tabi ─────────────
-- Faz 2'deki üç bağlam burada da geçerli:
--   app.tenant_id  → normal trafik
--   app.yonetim    → kurulum/bakım betikleri
-- (kimlik doğrulama bağlamı bu tablolara erişmez; giriş akışının ihtiyacı yok)

ALTER TABLE "Grup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grup" FORCE ROW LEVEL SECURITY;
CREATE POLICY grup_kiraci ON "Grup"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY grup_yonetim ON "Grup"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "KullaniciGrup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KullaniciGrup" FORCE ROW LEVEL SECURITY;
CREATE POLICY kullanicigrup_kiraci ON "KullaniciGrup"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kullanicigrup_yonetim ON "KullaniciGrup"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "DenetimKaydi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DenetimKaydi" FORCE ROW LEVEL SECURITY;

-- Denetim günlüğü SALT OKUMA + EKLEME. Politikalar bilinçli olarak UPDATE ve
-- DELETE içermez: sonradan değiştirilebilen bir günlük güvenilir değildir.
-- Bir kiracı kendi kaydını okuyabilir ve yeni kayıt ekleyebilir; var olanı
-- değiştiremez veya silemez.
CREATE POLICY denetim_okuma ON "DenetimKaydi"
  FOR SELECT USING ("tenantId" = app_kiraci());
CREATE POLICY denetim_ekleme ON "DenetimKaydi"
  FOR INSERT WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY denetim_yonetim ON "DenetimKaydi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
