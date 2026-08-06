-- CreateTable
CREATE TABLE "Kisi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "unvan" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "birincil" BOOLEAN NOT NULL DEFAULT false,
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asama" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "olasilik" INTEGER NOT NULL DEFAULT 0,
    "renk" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firsat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "kisiId" TEXT,
    "asamaId" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "olasilik" INTEGER NOT NULL DEFAULT 0,
    "kapanisTarihi" TIMESTAMP(3),
    "sorumluId" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'acik',
    "kapanisSebebi" TEXT,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firsat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Kisi_tenantId_firmaId_idx" ON "Kisi"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Kisi_tenantId_ad_idx" ON "Kisi"("tenantId", "ad");

-- CreateIndex
CREATE INDEX "Kisi_tenantId_email_idx" ON "Kisi"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Asama_tenantId_sira_idx" ON "Asama"("tenantId", "sira");

-- CreateIndex
CREATE UNIQUE INDEX "Asama_tenantId_ad_key" ON "Asama"("tenantId", "ad");

-- CreateIndex
CREATE INDEX "Firsat_tenantId_asamaId_idx" ON "Firsat"("tenantId", "asamaId");

-- CreateIndex
CREATE INDEX "Firsat_tenantId_firmaId_idx" ON "Firsat"("tenantId", "firmaId");

-- CreateIndex
CREATE INDEX "Firsat_tenantId_durum_idx" ON "Firsat"("tenantId", "durum");

-- CreateIndex
CREATE INDEX "Firsat_tenantId_sorumluId_idx" ON "Firsat"("tenantId", "sorumluId");

-- CreateIndex
CREATE INDEX "Firsat_tenantId_kapanisTarihi_idx" ON "Firsat"("tenantId", "kapanisTarihi");

-- AddForeignKey
ALTER TABLE "Kisi" ADD CONSTRAINT "Kisi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kisi" ADD CONSTRAINT "Kisi_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asama" ADD CONSTRAINT "Asama_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firsat" ADD CONSTRAINT "Firsat_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firsat" ADD CONSTRAINT "Firsat_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "Firma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firsat" ADD CONSTRAINT "Firsat_kisiId_fkey" FOREIGN KEY ("kisiId") REFERENCES "Kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firsat" ADD CONSTRAINT "Firsat_asamaId_fkey" FOREIGN KEY ("asamaId") REFERENCES "Asama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ── Row-Level Security ────────────────────────────────────────────────────
-- Faz 2'de kurulan üç bağlam burada da aynen geçerlidir. Yeni bir tabloyu
-- RLS'siz bırakmak, kiracı sınırındaki ikinci savunma hattını o tablo için
-- devre dışı bırakmak demektir — o yüzden üç tablo da açıkça kapatılıyor.

ALTER TABLE "Kisi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Kisi" FORCE ROW LEVEL SECURITY;
CREATE POLICY kisi_kiraci ON "Kisi"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY kisi_yonetim ON "Kisi"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Asama" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asama" FORCE ROW LEVEL SECURITY;
CREATE POLICY asama_kiraci ON "Asama"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY asama_yonetim ON "Asama"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());

ALTER TABLE "Firsat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Firsat" FORCE ROW LEVEL SECURITY;
CREATE POLICY firsat_kiraci ON "Firsat"
  FOR ALL USING ("tenantId" = app_kiraci()) WITH CHECK ("tenantId" = app_kiraci());
CREATE POLICY firsat_yonetim ON "Firsat"
  FOR ALL USING (app_yonetim()) WITH CHECK (app_yonetim());


-- ── Veri taşıma için yönetim bağlamı ──────────────────────────────────────
-- DİKKAT: buradan sonraki INSERT'ler mevcut satırları OKUR. RLS açık olduğu
-- için bağlam ayarlanmazsa migration bağlantısı "Tenant" ve "Firma" satırlarını
-- göremez; sorgular hata vermez, sessizce SIFIR satır döndürür ve veri taşıma
-- hiç çalışmamış olur. `true` üçüncü argüman ayarı işleme (transaction) özel
-- kılar, migration bitince kaybolur.
SELECT set_config('app.yonetim', 'evet', true);


-- ── Varsayılan satış hattı ────────────────────────────────────────────────
-- Her mevcut kiracıya çalışabilir bir hat kurulur; aksi halde fırsat modülü
-- boş bir kanban ile açılır ve kullanıcı ne yapacağını bilemez. Aşamalar
-- kiracıya aittir, sonradan serbestçe değiştirilir.

INSERT INTO "Asama" ("id", "tenantId", "ad", "sira", "olasilik", "renk", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t."id" || v."ad"),
  t."id", v."ad", v."sira", v."olasilik", v."renk", now(), now()
FROM "Tenant" t
CROSS JOIN (VALUES
  ('Yeni',          0, 10, '#6366f1'),
  ('İletişim',      1, 25, '#0ea5e9'),
  ('Teklif',        2, 50, '#f59e0b'),
  ('Müzakere',      3, 75, '#a855f7'),
  ('Sonuç',         4, 90, '#10b981')
) AS v("ad", "sira", "olasilik", "renk")
ON CONFLICT ("tenantId", "ad") DO NOTHING;


-- ── Firma.yetkiliAd → Kisi (C1) ───────────────────────────────────────────
-- Mevcut yetkili kişi bilgisi kişi kaydına taşınır ve firmanın birincil
-- muhatabı olarak işaretlenir. `Firma.yetkiliAd` sütunu SİLİNMEZ: veriyi
-- taşırken kaybetmemek için kaynak yerinde bırakılır, arayüz artık kişi
-- kaydını kullanır.

INSERT INTO "Kisi" ("id", "tenantId", "firmaId", "ad", "telefon", "email", "birincil", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || f."id"),
  f."tenantId", f."id", btrim(f."yetkiliAd"), f."telefon", f."email", true, now(), now()
FROM "Firma" f
WHERE f."yetkiliAd" IS NOT NULL AND btrim(f."yetkiliAd") <> '';


-- ── Mevcut paketlere yeni modüller ────────────────────────────────────────
-- Paket kısıtı "listede olmayan modül kapalıdır" biçiminde çalışır. Bu yüzden
-- yeni modüller eklenirken mevcut paketlere de yazılmalıdır; aksi halde
-- yükseltmeden sonra paketli her kiracı Kişiler ve Fırsatlar modüllerini
-- yitirmiş olurdu. Paketi kısıtlamak isteyen platform yöneticisi bunu admin
-- panelden bilinçli olarak yapar.

UPDATE "Plan"
SET "moduller" = array_append("moduller", 'kisi')
WHERE NOT ('kisi' = ANY("moduller"));

UPDATE "Plan"
SET "moduller" = array_append("moduller", 'firsat')
WHERE NOT ('firsat' = ANY("moduller"));
