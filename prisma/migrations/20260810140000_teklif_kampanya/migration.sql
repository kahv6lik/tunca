-- Teklif kalemlerine ürün ve kampanya bağı
--
-- SORUN: Teklif Faz 7'de yazıldı, ticari çekirdek (Faz 14) ise sonra geldi.
-- Sipariş kalemleri kataloga ve fiyat motoruna bağlandı ama TEKLİF kalemleri
-- serbest metin olarak kaldı. Sonuç: kullanıcı kampanya tanımlıyor, teklif
-- hazırlarken kampanya diye bir şey göremiyor ve indirim ancak sipariş
-- aşamasında uygulanabiliyordu — oysa müşteriye giden belge TEKLİFTİR.
--
-- ÇÖZÜM: kalem, siparişteki desenin aynısıyla ürüne ve kampanyaya bağlanır.
-- Üçü de NULL kabul eder: serbest metin kalem yazmak hâlâ mümkündür
-- (danışmanlık, montaj gibi katalogda olmayan satırlar için gereklidir) ve
-- MEVCUT teklifler olduğu gibi geçerli kalır.
--
-- `tutar` alanının anlamı GENİŞLEDİ: eskiden miktar × birimFiyat idi, artık
-- kampanya indirimi düşülmüş NET tutardır. Kampanyasız satırlarda ikisi
-- aynıdır, yani eski kayıtların rakamı değişmez.

ALTER TABLE "TeklifKalemi" ADD COLUMN     "indirimTutari" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "kampanyaId" TEXT,
ADD COLUMN     "urunId" TEXT;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_kampanyaId_fkey" FOREIGN KEY ("kampanyaId") REFERENCES "Kampanya"("id") ON DELETE SET NULL ON UPDATE CASCADE;
