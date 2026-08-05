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

### v1.2.0 — PostgreSQL'e geçiş (TEK SEFERLİK, DİKKATLİ OKUYUN)

Bu sürümde veritabanı **SQLite'tan PostgreSQL'e** taşınıyor. Bu, normal bir
sürüm alma değildir: veriniz bir motordan diğerine kopyalanır. Adımların
**sırası önemlidir** — uygulamayı veriyi taşımadan önce başlatırsanız boş bir
veritabanına yeni bir kiracı oluşturur ve taşıma reddedilir.

**1. Yedek alın ve uygulamayı durdurun**

```bash
cd /root/gezegen-crm
docker cp gezegen-crm-app:/app/data/prod.db /root/prod-yedek-$(date +%F-%H%M).db
ls -lh /root/prod-yedek-*.db          # dosya gerçekten oluştu mu?
docker compose -f docker-compose.server.yml down
```

**2. Sürüme geçin ve Postgres parolasını tanımlayın**

```bash
git fetch origin --tags --force
git checkout v1.2.0

# deploy.env dosyasına ekleyin:
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> deploy.env
echo "POSTGRES_USER=gezegen" >> deploy.env
echo "POSTGRES_DB=gezegen" >> deploy.env
```

**3. Yalnızca veritabanını başlatın**

```bash
docker compose -f docker-compose.server.yml up -d db
docker compose -f docker-compose.server.yml ps        # db "healthy" olmalı
```

**4. Şemayı kurun (uygulamayı BAŞLATMADAN)**

```bash
docker compose -f docker-compose.server.yml build app
docker compose -f docker-compose.server.yml run --rm --entrypoint sh app \
  -c "npx prisma migrate deploy"
```

**5. Veriyi taşıyın**

```bash
docker compose -f docker-compose.server.yml run --rm \
  --entrypoint sh \
  -v /root/prod-yedek-<TARIH>.db:/tmp/eski.db:ro \
  -e ESKI_SQLITE=file:/tmp/eski.db \
  app -c "npx tsx scripts/sqlite-postgres-gecis.ts"
```

Betik her tablo için `kaynak N → hedef N` satırı yazar; **sayılar birebir
tutmalıdır**. Tutmazsa taşıma kendini durdurur ve hata verir. Betik kaynak
SQLite dosyasına yalnızca okuma yapar, dosyanız değişmez.

**6. Uygulamayı başlatın**

```bash
docker compose -f docker-compose.server.yml up -d
docker logs -f gezegen-crm-app
```

**7. Doğrulayın**

Giriş yapın; firma sayınız, yatırımlarınız ve kullanıcılarınız aynı olmalı.
Kullanıcılar aynı e-posta ve şifreyle girer (şifre özetleri aynen taşınır).

#### Geri dönüş

SQLite verisi bu süreçte hiç değişmez; sorun çıkarsa eski sürüme dönmek
yeterlidir:

```bash
git checkout v1.1.2
docker compose -f docker-compose.server.yml down
docker compose -f docker-compose.server.yml up -d --build
```

Eski `gezegen-db` volume'ü ve içindeki `prod.db` yerinde durur.

#### Bu sürümle gelen güvenlik katmanı

PostgreSQL **Row-Level Security** açılır. Bundan sonra veritabanı, hangi
kiracının bağlamında olduğunu bilmeden **hiçbir satır döndürmez**. Uygulama
kodunda bir sorgu kiracı filtresini unutsa bile veri sızmaz. Üç bağlam vardır:

| Bağlam | Nerede kullanılır | Yetki |
|--------|-------------------|-------|
| `app.tenant_id` | Normal uygulama trafiği | Yalnızca o kiracının satırları |
| `app.kimlik_dogrulama` | Yalnızca giriş akışı | User + Tenant, **salt okuma** |
| `app.yonetim` | Kurulum/bakım betikleri | Tam erişim |

Doğrudan veritabanına bağlanıp veri okumak isterseniz (ör. bakım için) yönetim
bağlamını açmanız gerekir:

```sql
SELECT set_config('app.yonetim', 'evet', false);
SELECT count(*) FROM "Firma";
```

Bunu yapmadan çalıştırdığınız sorgular **sıfır satır** döndürür — bu bir arıza
değil, tasarımın kendisidir.

#### Yedekleme artık `pg_dump` ile

```bash
docker exec gezegen-crm-db pg_dump -U gezegen gezegen > /root/yedek-$(date +%F).sql
```

Geri yükleme:

```bash
cat /root/yedek-<TARIH>.sql | docker exec -i gezegen-crm-db psql -U gezegen -d gezegen
```

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
