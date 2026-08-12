-- Teklif kalemine paket damgası
--
-- SORUN: Paket Faz 14'te (T2) tanımlanabiliyordu ama HİÇBİR SATIŞA BAĞLI
-- DEĞİLDİ. `paketBirimFiyati` fiyat motorunda duruyordu ve yalnızca
-- /paketler ekranındaki önizlemede çağrılıyordu; `SiparisKalemi.paketId`
-- sütunu şemada vardı ve HİÇ YAZILMIYORDU; teklifte sütun bile yoktu.
-- Ortağın bulgusu: "ürün paketi oluşturduğumda sipariş oluştururken ürün
-- seçebiliyorum ama paket seçemiyorum."
--
-- ÇÖZÜM: paket seçilince KALEMLERİNE AÇILIR (her ürün kendi satırı olur) ve
-- her satıra hangi paketten geldiği damgalanır. Tek opak satır olsaydı
-- satırın urunId'si boş kalırdı ve onay anındaki stok düşümü sessizce hiç
-- çalışmazdı — paket satılır, depodan hiçbir şey düşmezdi.
--
-- Teklif de aynı anda bağlanır (v1.23.0'daki kampanya bağının gerekçesiyle):
-- yoksa paketli teklif siparişe dönerken paket damgası kaybolur ve zincir
-- (Faz 20 / U4) yine kopar.
--
-- NULL kabul eder: paketsiz satır yazmak normal akıştır ve MEVCUT teklifler
-- olduğu gibi geçerli kalır.

ALTER TABLE "TeklifKalemi" ADD COLUMN     "paketId" TEXT;

-- AddForeignKey
-- SetNull: paket silinse bile teklif satırı KALIR. Belge, dayandığı
-- anlaşma kaydı silindi diye bozulmamalıdır (urunId ve kampanyaId ile aynı
-- gerekçe).
ALTER TABLE "TeklifKalemi" ADD CONSTRAINT "TeklifKalemi_paketId_fkey" FOREIGN KEY ("paketId") REFERENCES "Paket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
