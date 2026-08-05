# Sunucuya Sürüm Alma (Deploy)

Bu kılavuz, belirli bir **sürüm etiketini** (tag) canlıya almayı anlatır.
Sunucuda uygulama `/root/gezegen-crm` dizininde ve Docker ile çalışıyor.

## Önce: Neden `git pull` yetmez

`git pull` yalnızca **açık olan dalı** günceller. Geliştirme ayrı bir dalda
ilerlediği ve sürümler tag ile işaretlendiği için, canlıya belirli bir sürümü
almak istiyorsanız o tag'e geçmek gerekir. Tag'e geçmek "detached HEAD"
durumudur — bu bir hata değildir, tam olarak istediğimiz şeydir: sunucu
rastgele bir dalın ucunu değil, **doğrulanmış bir sürümü** çalıştırır.

---

## 1. Veritabanını yedekle (ATLAMAYIN)

Şema değişikliği içeren sürümlerde (ör. `v1.1.0` — çok kiracılılık) migration
tabloları yeniden oluşturur. Migration veriyi korur ve bu test edilmiştir; yine
de canlıda **her zaman** önce yedek alın.

```bash
cd /root/gezegen-crm
docker cp gezegen-crm-app:/app/data/prod.db /root/prod-yedek-$(date +%F-%H%M).db
ls -lh /root/prod-yedek-*.db
```

## 2. Sürümü getir ve geç

```bash
cd /root/gezegen-crm
git fetch origin --tags --force
git tag -l                      # kullanılabilir sürümler
git checkout v1.1.2             # almak istediğiniz sürüm
git log --oneline -1            # doğru sürümde miyiz?
```

## 3. Derle ve başlat

Sunucunuzda hangi compose dosyasını kullanıyorsanız onunla:

```bash
docker compose -f docker-compose.server.yml up -d --build
```

> Depodaki hazır seçenekler: gömülü Nginx + Certbot için `docker-compose.yml`,
> mevcut bir ters proxy'ye bağlanmak için `deploy/reverse-proxy/docker-compose.yml`.
> Sunucunuzdaki `docker-compose.server.yml` bunlardan uyarlanmış kendi
> dosyanızdır; depoda olmadığı için `git checkout` onu etkilemez.

**Migration otomatiktir.** `docker-entrypoint.sh` konteyner her açılışta önce
`prisma migrate deploy`, sonra `prisma/bootstrap.ts` çalıştırır. Elle
migration komutu vermenize gerek yoktur.

## 4. Doğrula

```bash
# Migration ve başlangıç günlükleri
docker logs -f gezegen-crm-app        # Ctrl+C ile çıkın

# Beklenen satırlar:
#   ▶ Veritabanı migrasyonları uygulanıyor…
#   ▶ Yönetici kullanıcısı kontrol ediliyor…
#   ▶ Gezegen CRM başlatılıyor (port 3000)…

docker compose -f docker-compose.server.yml ps    # ayakta mı
```

Tarayıcıdan girin ve sol alttaki sürüm etiketinin beklediğiniz sürüm olduğunu
görün (`v1.1.2 · Premium`). Bu etiket `package.json` sürümünden gelir, yani
git tag'i ile birebir aynıdır.

## 5. Sorun çıkarsa — geri dönüş

```bash
cd /root/gezegen-crm
git checkout v1.1.0                                       # önceki sürüm
docker compose -f docker-compose.server.yml up -d --build
```

Veri de bozulduysa yedekten dönün:

```bash
docker compose -f docker-compose.server.yml down
docker cp /root/prod-yedek-<tarih>.db gezegen-crm-app:/app/data/prod.db
docker compose -f docker-compose.server.yml up -d
```

> Not: Eski bir sürüme dönerken veritabanı **yeni** şemada kalır. Migration'lar
> ileri yönlüdür; şema değişikliği içeren bir sürümden geri dönüyorsanız
> veritabanını da yedekten geri yüklemek gerekir.

## 6. Tekrar dalda çalışmak isterseniz

Tag'de "detached HEAD" durumundasınız. Dala dönmek için:

```bash
git checkout main
```

---

## Sürüme özel notlar

### v1.1.0 — Faz 1: Çok kiracılılık

İlk kez alınırken şu değişiklikler olur:

- Tüm mevcut veri **tek bir kiracıya** taşınır: "Gezegen Danışmanlık"
  (kod: `gezegen`). Firmalar, yatırımlar, eğitimler, hizmetler ve kullanıcılar
  aynen kalır, hiçbiri silinmez.
- Mevcut kullanıcılar **aynı e-posta ve şifreyle** girmeye devam eder.
- Üst çubukta aktif kuruluşun adı görünür.
- Faz 1 öncesinden kalan tarayıcı oturumları geçersiz sayılır; kullanıcılar
  bir kez yeniden giriş yapar. Bu bilinçlidir: kiracı bilgisi taşımayan bir
  oturumla sorgu çalıştırılmasını engeller.

Kiracının adını/kodunu değiştirmek isterseniz:

```sql
UPDATE "Tenant" SET "ad" = 'Şirket Adı', "slug" = 'sirket-kodu'
WHERE "id" = 'varsayilan_kiraci';
```

### Giriş yapılamıyorsa

```bash
docker exec -it gezegen-crm-app npx tsx scripts/demo-hesap.ts
```

Demo yönetici hesabını (`admin@gezegen.com` / `admin123`, tam yetkili) veriye
dokunmadan geri getirir.
