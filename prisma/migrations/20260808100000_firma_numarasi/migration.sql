-- AlterTable
ALTER TABLE "Firma" ADD COLUMN     "firmaNo" TEXT;

-- CreateTable
CREATE TABLE "FirmaNoSayac" (
    "tenantId" TEXT NOT NULL,
    "sonSira" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmaNoSayac_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Firma_tenantId_firmaNo_key" ON "Firma"("tenantId", "firmaNo");

-- AddForeignKey
ALTER TABLE "FirmaNoSayac" ADD CONSTRAINT "FirmaNoSayac_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-Level Security ────────────────────────────────────────────────────
ALTER TABLE "FirmaNoSayac" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FirmaNoSayac" FORCE ROW LEVEL SECURITY;
CREATE POLICY firma_no_sayac_kiraci ON "FirmaNoSayac"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY firma_no_sayac_yonetim ON "FirmaNoSayac"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

-- ── Veri adımı: mevcut firmalara numara ───────────────────────────────────
-- RLS altında veri adımı yönetim bağlamı gerektirir; yoksa UPDATE sessizce
-- sıfır satır etkiler (Faz 6'da yaşandı).
SELECT set_config('app.yonetim', 'evet', true);

-- Her kiracının firmaları createdAt sırasına göre numaralanır: A0001, A0002…
-- Rakam 9999'a ulaşınca harf ilerler (A9999 → B0001); mantık uygulamadaki
-- firmaNoUret() ile birebir aynıdır ve testler ikisini de sınar.
WITH siralanmis AS (
  SELECT
    id,
    "tenantId",
    ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS sira
  FROM "Firma"
)
UPDATE "Firma" f
SET "firmaNo" =
  chr(65 + ((s.sira - 1) / 9999)::int) ||
  lpad((s.sira - ((s.sira - 1) / 9999)::int * 9999)::text, 4, '0')
FROM siralanmis s
WHERE f.id = s.id AND s.sira <= 259974;

-- Sayaç, o kiracıda verilen en yüksek sırayla başlatılır.
INSERT INTO "FirmaNoSayac" ("tenantId", "sonSira", "updatedAt")
SELECT "tenantId", COUNT(*), NOW() FROM "Firma" GROUP BY "tenantId"
ON CONFLICT ("tenantId") DO NOTHING;
