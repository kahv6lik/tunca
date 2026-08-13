-- Satırda kaç PAKET satıldığı
--
-- SORUN: v1.25.0 paketi satırlara açtı (stok düşümü satırın ürününe bakar,
-- tek opak satır olsaydı depodan hiçbir şey düşmezdi). Ama fiyat da satır
-- satır hesaplanınca paket, ürünlerin TOPLAMINA indi: "paket fiyatı 1000 TL"
-- kampanyası her satıra AYRI AYRI uygulandı ve iki ürünlü bir paket 1000
-- yerine 2000 TL'ye satıldı (ortağın bulgusu).
--
-- ÇÖZÜM: satırlar kalır, fiyat PAKET DÜZEYİNDE hesaplanıp satırlara pay
-- edilir. Bunun için satırın kaç PAKETE ait olduğu bilinmelidir.
--
-- NEDEN AYRI BİR ALAN: `miktar` ürün adedidir ve stok onu düşer; kampanya
-- kotası ise PAKET sayar — 1 paket 1 hak düşer, içindeki ürün sayısı kadar
-- değil. İkisi ayrı sorulardır; birini diğerinden türetmek (miktar ÷ paket
-- içi adet) kullanıcı miktarı elle değiştirdiğinde yanlış cevap verirdi.
--
-- NULL = satır bir pakete ait değil (sıradan ürün satırı). Mevcut kayıtlar
-- olduğu gibi geçerli kalır.

ALTER TABLE "SiparisKalemi" ADD COLUMN     "paketAdedi" DOUBLE PRECISION;
ALTER TABLE "TeklifKalemi" ADD COLUMN     "paketAdedi" DOUBLE PRECISION;
