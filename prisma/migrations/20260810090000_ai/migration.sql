-- Faz 21 — AI özellikleri (G1-G3)
--
-- İKİ ŞEY EKLENİR:
--
--   1. `Tenant.aiAcik` — kiracı bazlı açma/kapama. VARSAYILAN KAPALI.
--      Kiracı verisinin bir dil modeline gönderilmesi, yükseltmeyle birlikte
--      sessizce başlayacak bir şey değildir; yönetici bilerek açar.
--
--   2. `AiKullanim` — çağrı defteri. Yol haritasının sözü ("hangi verinin
--      modele gönderildiği kiracı yöneticisine açıkça bildirilir") bir ayar
--      ekranındaki cümleyle değil, geriye dönük okunabilir bir defterle
--      tutulur. İstemin ya da yanıtın METNİ saklanmaz — defter denetim
--      kaydıdır, ikinci bir müşteri veri kopyası değildir.
--
-- G1 (skorlama) BİLİNÇLİ OLARAK ŞEMAYA HİÇBİR ŞEY EKLEMEZ: skor kiracının
-- kendi kapanmış fırsatlarından her görüntülemede yeniden hesaplanır. Skoru
-- saklamak, veri değiştikçe bayatlayan ve "bu rakam neden böyle" sorusunu
-- yanıtlayamayan bir sütun üretirdi.

ALTER TABLE "Tenant" ADD COLUMN     "aiAcik" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiKullanim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "kullaniciEmail" TEXT,
    "tur" TEXT NOT NULL,
    "konu" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "girisToken" INTEGER NOT NULL DEFAULT 0,
    "cikisToken" INTEGER NOT NULL DEFAULT 0,
    "basarili" BOOLEAN NOT NULL DEFAULT true,
    "hata" TEXT,
    "sureMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKullanim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiKullanim_tenantId_createdAt_idx" ON "AiKullanim"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiKullanim_tenantId_tur_idx" ON "AiKullanim"("tenantId", "tur");

-- AddForeignKey
ALTER TABLE "AiKullanim" ADD CONSTRAINT "AiKullanim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security (Faz 2 deseni) ──────────────────────────────────────
--
-- Defter kiracıya AÇIKTIR (yönetici kendi kuruluşunun çağrılarını görmeli)
-- ama DENETİM GÜNLÜĞÜ gibi değiştirilemez değildir: kayıtlar saklama
-- politikasıyla temizlenebilmelidir, yoksa defter sınırsız büyür.

ALTER TABLE "AiKullanim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiKullanim" FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_kullanim_kiraci ON "AiKullanim"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY ai_kullanim_yonetim ON "AiKullanim"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri adımı: paketlere ai modülü ───────────────────────────────────────
--
-- Modül paketlere EKLENİR (yükseltme özellik kapatmaz — Faz 11 kuralı), ama
-- `Tenant.aiAcik` varsayılan false olduğu için hiçbir kiracıda kendiliğinden
-- çalışmaya başlamaz. İki kapı vardır ve ikincisi kapalıdır.
SELECT set_config('app.yonetim', 'evet', true);

UPDATE "Plan" SET "moduller" = array_append("moduller", 'ai')
WHERE NOT ('ai' = ANY ("moduller"));
