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

### Dosya ekleri de yedeklenir (v1.17.0'dan itibaren)

Dosya ekleri (fotoğraf, PDF, belge) **veritabanında DEĞİL**, `gezegen-dosya`
adlı Docker volume'ünde durur. Veritabanı yedeği bunları KAPSAMAZ — uygulama
içindeki JSON yedeğine de bilinçli olarak konmadılar, çünkü yedek dosyası
yüzlerce megabayt olur ve indirilemez hâle gelirdi.

Volume yedeği ayrı bir adımdır:

```bash
# Ekleri tek bir arşive al
docker run --rm \
  -v gezegen-crm_gezegen-dosya:/veri:ro \
  -v /root:/yedek \
  alpine tar czf /yedek/gezegen-dosya-$(date +%F-%H%M).tar.gz -C /veri .

ls -lh /root/gezegen-dosya-*.tar.gz
```

Geri yüklemek için (dizin BOŞ olmalı; mevcut dosyalar ezilir):

```bash
docker run --rm \
  -v gezegen-crm_gezegen-dosya:/veri \
  -v /root:/yedek \
  alpine sh -c "rm -rf /veri/* && tar xzf /yedek/gezegen-dosya-<TARIH>.tar.gz -C /veri"
```

> Volume adı `docker volume ls` çıktısındakiyle aynı olmalıdır; Compose
> proje adını ön ek olarak ekler (`gezegen-crm_gezegen-dosya`).

## 0. Her sürüm için iki adım (özet kart)

Yeni bir sürüm çıktığında sırayla iki yerde iş yapılır. Aşağıdaki iki blok
**her sürümde aynıdır**; yalnızca sürüm numarası ve commit sha'sı değişir.

### A — KENDİ MAKİNENDE: tag'i oluştur ve gönder

Claude Code oturumunun git kimliği tag ref'lerine push edemez (`HTTP 403`),
bu yüzden tag'i sen oluşturursun. Sürüm commit'inin sha'sı Claude'un kapanış
mesajında verilir.

```bash
cd <depo-dizinin>            # örn. ~/projeler/tunca
git fetch origin
git tag -a vX.Y.Z <sha> -m "<kısa açıklama>"
git push origin vX.Y.Z
```

Doğrulama: `git ls-remote --tags origin | grep vX.Y.Z` bir satır dönmeli.

### B — SUNUCUDA: sürümü al ve yayına ver

```bash
cd /root/gezegen-crm

# 1) YEDEK — atlama. Migration içeren sürümlerde hayat kurtarır.
docker compose --env-file deploy.env -f docker-compose.server.yml exec -T db \
  pg_dump -U gezegen gezegen | gzip > ~/yedek-$(date +%F-%H%M).sql.gz
ls -lh ~/yedek-*.sql.gz | tail -1

# 2) Sürümü getir
git fetch origin --tags --force
git checkout vX.Y.Z
git log --oneline -1            # beklenen commit mi?

# 3) Derle ve başlat (migration otomatik uygulanır)
docker compose --env-file deploy.env -f docker-compose.server.yml up -d --build

# 4) Başlangıç günlüğü — Ctrl+C ile çık
docker logs -f gezegen-crm-app
```

**`--env-file deploy.env` her komutta şart.** Compose dosyasındaki `${...}`
ifadeleri `env_file:` satırından okunmaz; bayrak olmadan parola boş kalır.

### C — SUNUCUDA: yayın sonrası doğrulama

```bash
cd /root/gezegen-crm
K="docker compose --env-file deploy.env -f docker-compose.server.yml"

# Migration'lar uygulandı mı?
$K exec -T db psql -U gezegen -d gezegen -c \
  'SELECT count(*) AS uygulanan FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'

# Dosya volume'ü bağlı mı? (Faz 17'den beri zorunlu)
$K exec app sh -c 'ls -la /veri/dosya' | head -3

# Konteynerler ayakta mı?
$K ps
```

Migration sayısı depodaki `prisma/migrations` klasöründeki dizin sayısına
eşit olmalı. Ardından tarayıcıdan gir: sol altta yeni sürüm numarası yazmalı.

### D — Geri dönüş

```bash
cd /root/gezegen-crm
git checkout vESKI.SURUM
docker compose --env-file deploy.env -f docker-compose.server.yml up -d --build
```

Veritabanı şeması geri ALINMAZ — yeni tablolar ve varsayılanı olan yeni
sütunlar yerinde kalır, eski kod onları görmez ve zarar vermez. Veriyi geri
almak gerekirse 1. adımdaki yedek kullanılır:

```bash
zcat ~/yedek-<tarih>.sql.gz | \
  docker compose --env-file deploy.env -f docker-compose.server.yml \
  exec -T db psql -U gezegen -d gezegen
```

---

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
docker compose --env-file deploy.env -f docker-compose.server.yml up -d --build
```

> **`--env-file deploy.env` şart.** Compose dosyasının içindeki `${...}`
> ifadeleri `env_file:` satırından okunmaz; bu bayrak olmadan parola boş kalır
> ve veritabanı bağlantısı başarısız olur. Kalıcı çözüm: `ln -sf deploy.env .env`

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

## Sık Karşılaşılan Sorunlar

Bunların hepsi gerçek bir dağıtımda yaşandı; sırayla kontrol edin.

### `502 Bad Gateway`

Uygulama konteyneri **çalışıyor** ama nginx ona ulaşamıyor. Sebep neredeyse her
zaman aynı: nginx, upstream adresini başlangıçta bir kez çözer. Konteyner
yeniden oluşturulunca yeni bir IP alır, nginx eski IP'ye gitmeye devam eder.

```bash
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i nginx   # KONTEYNER adını bulun
docker exec <NGINX_KONTEYNER_ADI> nginx -t
docker exec <NGINX_KONTEYNER_ADI> nginx -s reload
```

> `docker exec` **konteyner adı** ister, imaj adı değil. `nginx:alpine` yazarsanız
> "No such container" hatası alırsınız.

Düzelmezse ağ bağlantısını test edin:

```bash
docker exec <NGINX> wget -qO- http://gezegen-crm-app:3000/login | head -c 200
docker inspect <NGINX> --format '{{json .NetworkSettings.Networks}}'
```

HTML dönmüyorsa nginx ile uygulama aynı Docker ağında değildir.

### `Authentication failed ... credentials for 'gezegen' are not valid`

Çıktının başında şu uyarı vardır:

```
WARN[0000] The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.
```

Compose dosyasının içindeki `${POSTGRES_PASSWORD}` ifadeleri **`env_file:`'dan
okunmaz**. `env_file` değişkenleri yalnızca konteynerin içine geçirir; compose
dosyasının kendi metnindeki değişkenler kabuktan veya `.env`'den gelir. Çözüm:
her komuta `--env-file deploy.env` ekleyin.

```bash
docker compose --env-file deploy.env -f docker-compose.server.yml up -d
```

Kalıcı kolaylık için: `ln -sf deploy.env .env`

**Başlatmadan önce mutlaka doğrulayın:**

```bash
docker compose --env-file deploy.env -f docker-compose.server.yml config \
  | grep -E "POSTGRES_PASSWORD|DATABASE_URL"
```

> `config` çıktısında `POSTGRES_PASSWORD` **iki kez** görünür — biri `app`, biri
> `db` servisi için. Değerler aynıysa sorun yoktur, bu normaldir.

### Parolayı düzelttim ama hâlâ giremiyor

PostgreSQL parolayı **yalnızca veri dizinini ilk oluştururken** ayarlar. Yanlış
(veya boş) parolayla bir kez başladıysa, doğru parolayı sonradan vermek işe
yaramaz. Volume'ü silip baştan kurmak gerekir:

```bash
docker compose --env-file deploy.env -f docker-compose.server.yml down
docker volume ls | grep pgdata
docker volume rm <cikan-volume-adi>
```

Bu yalnızca Postgres verisini siler; eski SQLite volume'ü ve yedekleriniz durur.

### `deploy.env` içinde tekrarlı satırlar

`echo ... >> deploy.env` komutunu birden çok kez çalıştırdıysanız aynı değişken
birkaç kez birikir. Compose sonuncuyu alır, yani çalışır — ama karışıklık
yaratır. Temizlemek için:

```bash
cp deploy.env deploy.env.yedek
grep -v '^POSTGRES_' deploy.env > deploy.env.tmp && mv deploy.env.tmp deploy.env
{
  echo "POSTGRES_USER=gezegen"
  echo "POSTGRES_DB=gezegen"
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
} >> deploy.env
grep -c '^POSTGRES_' deploy.env      # 3 olmalı
rm deploy.env.yedek                  # işiniz bitince (içinde eski parolalar var)
```

### Uygulama bir türlü ayağa kalkmıyor

`docker compose run --rm ...` **geçici** bir konteyner açıp kapatır; kalıcı
uygulamayı başlatmaz. Migration ve veri taşıma adımları `run --rm` kullanır,
sonunda mutlaka şunu çalıştırın:

```bash
docker compose --env-file deploy.env -f docker-compose.server.yml up -d
```

### Veri taşıma "hedef veritabanı boş değil" diyor

Uygulama bir kez başladıysa `bootstrap.ts` yeni bir kiracı oluşturmuştur.
Loglarda `✅ Kiracı oluşturuldu` görüyorsanız durum budur. Şemayı sıfırlayıp
taşımayı tekrarlayın:

```bash
docker compose --env-file deploy.env -f docker-compose.server.yml stop app
docker exec gezegen-crm-db psql -U gezegen -d gezegen -c \
  'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker compose --env-file deploy.env -f docker-compose.server.yml run --rm \
  --entrypoint sh app -c "npx prisma migrate deploy"
# ardından taşıma adımı, en son: up -d
```

### Yedek almayı unuttum, eski verim gitti mi?

Muhtemelen hayır. Eski SQLite verisi kendi Docker volume'ünde durur; yeni
Postgres volume'ünü silmek ona dokunmaz.

```bash
docker volume ls | grep gezegen
docker run --rm -v <ESKI_VOLUME_ADI>:/data alpine ls -lh /data
docker run --rm -v <ESKI_VOLUME_ADI>:/data -v /root:/out alpine \
  cp /data/prod.db /out/prod-yedek-$(date +%F-%H%M).db
```

> `-v` parametresinde volume adı ile yol arasında **iki nokta** olmalı:
> `ad:/data` — `ad/data` değil.

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

### Zamanlanmış işler (Faz 8) — ZORUNLU

Faz 8'den itibaren üç iş **dışarıdan tetiklenir**: iş akışı kuralları, e-posta
kuyruğunun gönderimi ve IMAP gelen kutusu taraması. Next.js'in kendi
zamanlayıcısı yoktur, bu yüzden sunucudaki cron çağırır.

**1. Anahtarı tanımlayın** (`deploy.env` içine, uygulama ile aynı dosyaya):

```bash
GOREV_ANAHTARI=$(openssl rand -hex 32)     # çıktıyı deploy.env'e yazın
UYGULAMA_ADRESI=https://crm.screenbite.com.tr
```

`GOREV_ANAHTARI` **tanımlı değilse uç nokta tamamen kapalıdır** (401 döner).
Bu bilinçli: "tanımsızsa serbest" davranışı, herkesin tetikleyebildiği bir
uç nokta bırakırdı. `UYGULAMA_ADRESI` bildirim e-postalarındaki bağlantılarda
kullanılır.

**2. Konteyneri yeniden başlatın** ki değişkenler okunsun.

**3. Cron kaydını açın** (sunucuda, `crontab -e`):

```cron
*/10 * * * * curl -fsS -m 300 -H "X-Gorev-Anahtari: BURAYA_ANAHTAR" https://crm.screenbite.com.tr/api/gorevler >/dev/null 2>&1
```

10 dakikalık aralık makul bir başlangıçtır: bildirimler yeterince hızlı gider,
posta sunucusu da gereksiz yere meşgul edilmez.

**4. Elle deneyin:**

```bash
curl -s -H "X-Gorev-Anahtari: BURAYA_ANAHTAR" \
  https://crm.screenbite.com.tr/api/gorevler | head -c 400
```

Beklenen yanıt (yalnızca sayılar döner, müşteri verisi sızmaz):

```json
{"ok":true,"sureMs":812,"kiraci":2,"kural":3,"islenen":5,
 "eposta":{"gonderilen":0,"hatali":0},"senkron":{"okunan":0,"eslesen":0},"hata":[]}
```

Anahtarsız çağrıda `401 {"hata":"Yetkisiz"}` gelmelidir — gelmiyorsa
`GOREV_ANAHTARI` konteynere ulaşmamış demektir.

### E-posta ayarları (Faz 8)

SMTP bilgileri **uygulama içinden**, kuruluş bazında girilir:
**Otomasyon → E-posta Ayarları**. Sunucuda ortam değişkeni tanımlamanıza gerek
yoktur; her müşteri kendi posta sunucusundan gönderir.

> **DİKKAT — `AUTH_SECRET` değiştirmeyin.** Posta parolaları AES-256-GCM ile
> şifreli saklanır ve anahtar `AUTH_SECRET`'tan türetilir. Bu değeri
> değiştirirseniz kayıtlı posta parolaları **çözülemez** hâle gelir. Uygulama
> çökmez; ilgili kuruluşların ayar ekranından parolayı yeniden girmesi gerekir.
> (Aynı değişiklik zaten tüm oturumları da düşürür.)

### Admin panele ilk giriş (Faz 5)

`/admin` altındaki platform yönetimine yalnızca `platform_admin` rolündeki bir
kullanıcı girebilir ve bu rol arayüzden verilemez — ilk yönetici sunucuda
oluşturulur:

```bash
docker exec -it gezegen-crm-app \
  env PLATFORM_EMAIL='siz@sirketiniz.com' PLATFORM_PASSWORD='guclu-bir-sifre' \
  npx tsx scripts/platform-admin.ts
```

Betik "platform" adında ayrı bir kiracı ve içinde bir yönetici hesabı açar
(müşteri verisi tutmaz). Aynı komut var olan hesabın şifresini de sıfırlar —
parolanızı unutursanız bu yeterlidir.

Giriş yaptıktan sonra üst çubuktaki **Platform** düğmesinden panele geçilir.
Müşteri ekleme sırası: **Paketler** → **Yeni Kuruluş** → kuruluş detayında
**Davet Et**. Davet bağlantısı bir kez gösterilir; e-posta ile otomatik
gönderim Faz 8'de gelecek.


### Saha çalışması (Faz 17) — v1.17.0

**Dosya ekleri.** `docker-compose.yml` `gezegen-dosya` volume'ünü tanımlar ve
uygulamaya `DOSYA_DIZIN=/veri/dosya` olarak bağlar. Yükseltmeden sonra
`docker compose up -d` volume'ü kendiliğinden oluşturur; ek bir adım yoktur.
**Volume bağlı değilse ekler konteynerle birlikte kaybolur** — yükseltme
sonrası bir kez doğrulayın:

```bash
docker compose exec app sh -c 'touch /veri/dosya/.kontrol && ls -la /veri/dosya'
docker volume ls | grep gezegen-dosya
```

Sınırlar: dosya başına **10 MB**, kiracı başına **2 GB** (kiracının
`dosyaKotaMb` alanı). Görseller sunucuda 1600 piksel genişliğe küçültülür.

**Harita anahtarı (isteğe bağlı).** `GOOGLE_MAPS_API_KEY` tanımlıysa firma
adresinden koordinat üretilir. **Tanımsızsa özellik kapalıdır** ve koordinat
elle girilir — uygulama çalışmaya devam eder. Anahtar tanımlayacaksanız:

```bash
echo 'GOOGLE_MAPS_API_KEY=AIza...' >> deploy.env
docker compose up -d app
```

Google Cloud konsolunda **günlük istek sınırı (quota)** tanımlayın. Koordinat
firma kaydında saklandığı ve adres değişmedikçe yeniden istenmediği için
tipik kullanımda çağrı sayısı firma sayısı kadardır.

**AI anahtarı (isteğe bağlı, Faz 21).** `ANTHROPIC_API_KEY` tanımlıysa firma
özetini paragraf hâline getirme ve model destekli doğal dilde sorgu
çalışır. **Tanımsızsa AI kapalıdır** — skorlama ve kural tabanlı sorgu
çalışmaya devam eder, uygulama düşmez.

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> deploy.env
# İsteğe bağlı: varsayılan claude-sonnet-4-5
echo 'AI_MODEL=claude-sonnet-4-5' >> deploy.env
docker compose up -d app
```

Anahtarın tanımlı olması TEK BAŞINA yetmez: her kiracının kendi açma/kapama
ayarı vardır ve **varsayılan kapalıdır** (`/ai` ekranı). Yapılan çağrılar
aynı ekrandaki kullanım defterinden izlenir; masrafı sınırlamak için
sağlayıcı konsolunda da bir harcama sınırı tanımlayın.

**Ziyaret yarıçapı.** Varsayılan 300 m'dir (kiracının `ziyaretYaricapM`
alanı). Konum doğrulaması tarayıcının konum servisini kullanır ve bu servis
yalnızca **HTTPS** üzerinde çalışır — sunucu zaten Let's Encrypt ile
sertifikalı olduğu için ek bir adım gerekmez, ama `http://` ile test
ederseniz konum hep "doğrulanamadı" çıkar.
