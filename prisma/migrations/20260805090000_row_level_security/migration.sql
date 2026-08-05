-- Faz 2 (A4) — Row-Level Security
--
-- İzolasyonu uygulama katmanından VERİTABANI katmanına da taşır. Uygulama
-- kodunda bir sorgu tenant filtresini unutsa bile PostgreSQL yanlış satırı
-- döndürmez. Savunma derinliği: birinci hat src/lib/tenant-db.ts, ikinci hat
-- burası.
--
-- ÜÇ ERİŞİM BAĞLAMI
--
--   1) Kiracı        app.tenant_id = '<kiracı id>'
--      Normal uygulama trafiği. Yalnızca o kiracının satırları görünür.
--
--   2) Kimlik doğrulama   app.kimlik_dogrulama = 'evet'
--      YALNIZCA giriş akışı. User ve Tenant tablolarında SALT OKUMA izni verir;
--      oturum açılmadan önce kullanıcının hangi kiracıda olduğu bilinmediği
--      için gereklidir. Yazma yetkisi vermez.
--
--   3) Yönetim       app.yonetim = 'evet'
--      Kurulum ve bakım betikleri (seed, bootstrap, demo hesap, kiracı
--      oluşturma). Faz 5'te admin panel de bu bağlamı kullanacak.
--
-- Hiçbir bağlam ayarlanmazsa `current_setting(..., true)` NULL döner,
-- karşılaştırma NULL olur ve sorgu SIFIR satır getirir. Yani "bağlam yoksa
-- veri yok" varsayılan davranıştır.
--
-- FORCE ROW LEVEL SECURITY neden: tablo sahibi normalde RLS'ten muaftır.
-- Uygulama rolü tabloların sahibi olduğu için FORCE olmadan politikalar
-- hiçbir işe yaramazdı.

-- ── Yardımcı fonksiyonlar ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_kiraci() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant_id', true) $$;

CREATE OR REPLACE FUNCTION app_yonetim() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.yonetim', true) = 'evet' $$;

CREATE OR REPLACE FUNCTION app_kimlik() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.kimlik_dogrulama', true) = 'evet' $$;

-- ── Tenant ───────────────────────────────────────────────────────────────
-- Kiracı yalnızca kendi kaydını görür; kiracıların birbirinin varlığından
-- haberdar olmaması buradan başlar.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_kendisi ON "Tenant"
  FOR ALL USING (id = app_kiraci()) WITH CHECK (id = app_kiraci());
CREATE POLICY tenant_yonetim ON "Tenant"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
CREATE POLICY tenant_kimlik ON "Tenant"
  FOR SELECT USING (app_kimlik());

-- ── User ─────────────────────────────────────────────────────────────────
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_kiraci ON "User"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY user_yonetim ON "User"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
-- Giriş akışı: yalnızca okuma.
CREATE POLICY user_kimlik ON "User"
  FOR SELECT USING (app_kimlik());

-- ── Firma ────────────────────────────────────────────────────────────────
ALTER TABLE "Firma" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Firma" FORCE ROW LEVEL SECURITY;

CREATE POLICY firma_kiraci ON "Firma"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY firma_yonetim ON "Firma"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── YatirimDestegi ───────────────────────────────────────────────────────
ALTER TABLE "YatirimDestegi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "YatirimDestegi" FORCE ROW LEVEL SECURITY;

CREATE POLICY yatirim_kiraci ON "YatirimDestegi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY yatirim_yonetim ON "YatirimDestegi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── Egitim ───────────────────────────────────────────────────────────────
ALTER TABLE "Egitim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Egitim" FORCE ROW LEVEL SECURITY;

CREATE POLICY egitim_kiraci ON "Egitim"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY egitim_yonetim ON "Egitim"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── Hizmet ───────────────────────────────────────────────────────────────
ALTER TABLE "Hizmet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Hizmet" FORCE ROW LEVEL SECURITY;

CREATE POLICY hizmet_kiraci ON "Hizmet"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY hizmet_yonetim ON "Hizmet"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
