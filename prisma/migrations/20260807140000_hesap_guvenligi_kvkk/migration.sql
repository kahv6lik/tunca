-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ikiFaktorZorunlu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oturumOmruGun" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "veriSaklamaGun" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "basarisizGiris" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ikiFaktorAktif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ikiFaktorSir" TEXT,
ADD COLUMN     "kilitBitis" TIMESTAMP(3),
ADD COLUMN     "kvkkOnayTarihi" TIMESTAMP(3),
ADD COLUMN     "kvkkSurum" TEXT,
ADD COLUMN     "sifreGuncellendi" TIMESTAMP(3),
ADD COLUMN     "yedekKodlar" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Oturum" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "cihaz" TEXT,
    "ip" TEXT,
    "sonGorulme" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sonKullanma" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oturum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SifreSifirlama" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenOzeti" TEXT NOT NULL,
    "sonKullanma" TIMESTAMP(3) NOT NULL,
    "kullanildi" TIMESTAMP(3),
    "istekIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SifreSifirlama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GirisDenemesi" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "basarili" BOOLEAN NOT NULL DEFAULT false,
    "sebep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GirisDenemesi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Oturum_jti_key" ON "Oturum"("jti");

-- CreateIndex
CREATE INDEX "Oturum_tenantId_userId_idx" ON "Oturum"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Oturum_sonKullanma_idx" ON "Oturum"("sonKullanma");

-- CreateIndex
CREATE UNIQUE INDEX "SifreSifirlama_tokenOzeti_key" ON "SifreSifirlama"("tokenOzeti");

-- CreateIndex
CREATE INDEX "SifreSifirlama_tenantId_userId_idx" ON "SifreSifirlama"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "SifreSifirlama_sonKullanma_idx" ON "SifreSifirlama"("sonKullanma");

-- CreateIndex
CREATE INDEX "GirisDenemesi_email_createdAt_idx" ON "GirisDenemesi"("email", "createdAt");

-- CreateIndex
CREATE INDEX "GirisDenemesi_ip_createdAt_idx" ON "GirisDenemesi"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "GirisDenemesi_createdAt_idx" ON "GirisDenemesi"("createdAt");

-- AddForeignKey
ALTER TABLE "Oturum" ADD CONSTRAINT "Oturum_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oturum" ADD CONSTRAINT "Oturum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SifreSifirlama" ADD CONSTRAINT "SifreSifirlama_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Dördüncü bağlam: giriş güvenliği ─────────────────────────────────────
--
-- Hız sınırlama ve şifre sıfırlama, kimlik doğrulanmadan ÖNCE YAZMA yapmak
-- zorundadır (başarısız deneme sayacı, sıfırlama isteği). `app.kimlik_dogrulama`
-- bilinçli olarak salt okumadır ve öyle kalmalıdır; bu yüzden dar bir dördüncü
-- bağlam açılır.
--
-- Kapsamı DAR tutulmuştur: yalnızca giriş güvenliğiyle ilgili tablolarda ve
-- User'da geçerlidir; iş verisine (firma, teklif, kişi…) hiçbir erişim vermez.
-- Tek kullanıcısı src/lib/giris-guvenlik.ts'tir ve regresyon testi bunu
-- dosyanın dışında kullanılmadığını sürekli denetler.
CREATE OR REPLACE FUNCTION app_giris() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.giris', true) = 'evet' $$;

-- Giriş akışı hesabın kilit sayacını ve şifresini güncelleyebilmelidir.
CREATE POLICY user_giris ON "User"
  FOR ALL USING (app_giris()) WITH CHECK (app_giris());
-- Kiracının durumu (aktif/askıda) ve 2FA zorunluluğu giriş sırasında okunur.
CREATE POLICY tenant_giris ON "Tenant"
  FOR SELECT USING (app_giris());

-- ── Row-Level Security: yeni tablolar ────────────────────────────────────

ALTER TABLE "Oturum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Oturum" FORCE ROW LEVEL SECURITY;
CREATE POLICY oturum_kiraci ON "Oturum"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY oturum_yonetim ON "Oturum"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
-- Oturum kaydı giriş anında açılır (henüz kiracı bağlamı yoktur) ve her
-- istekte doğrulanır; middleware oturumu jti ile burada arar.
CREATE POLICY oturum_giris ON "Oturum"
  FOR ALL USING (app_giris()) WITH CHECK (app_giris());

ALTER TABLE "SifreSifirlama" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SifreSifirlama" FORCE ROW LEVEL SECURITY;
CREATE POLICY sifre_sifirlama_kiraci ON "SifreSifirlama"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY sifre_sifirlama_yonetim ON "SifreSifirlama"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());
CREATE POLICY sifre_sifirlama_giris ON "SifreSifirlama"
  FOR ALL USING (app_giris()) WITH CHECK (app_giris());

-- GirisDenemesi kiracıya BAĞLI DEĞİLDİR (giriş öncesi kaydedilir; e-postanın
-- hangi kiracıya ait olduğu o anda bilinmez ve bilinmemelidir). Bu yüzden
-- kiracı politikası YOKTUR: kiracı bağlamında sıfır satır görünür.
ALTER TABLE "GirisDenemesi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GirisDenemesi" FORCE ROW LEVEL SECURITY;
CREATE POLICY giris_denemesi_giris ON "GirisDenemesi"
  FOR ALL USING (app_giris()) WITH CHECK (app_giris());
CREATE POLICY giris_denemesi_yonetim ON "GirisDenemesi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── Veri adımı: mevcut kullanıcılara şifre tarihi ────────────────────────
SELECT set_config('app.yonetim', 'evet', true);

-- Şifre yaşı politikası (F1) için başlangıç noktası: mevcut kullanıcıların
-- şifresi "hesap açılışında belirlenmiş" sayılır. NULL bırakmak, politikayı
-- açan kuruluşta herkesi anında "şifreniz eskimiş" durumuna düşürürdü.
UPDATE "User" SET "sifreGuncellendi" = "createdAt" WHERE "sifreGuncellendi" IS NULL;

-- Şifre sıfırlama e-postası kuyruğa oturum AÇILMADAN yazılır (kullanıcı zaten
-- giriş yapamıyor). Yalnızca INSERT: giriş bağlamı başkasının postasını
-- okuyamaz ya da silemez.
CREATE POLICY eposta_kuyrugu_giris ON "EpostaKuyrugu"
  FOR INSERT WITH CHECK (app_giris());
