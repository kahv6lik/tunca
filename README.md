# Gezegen CRM

Müşteriye bağlı firmalara verilen **yatırım desteklerini, eğitimleri ve
hizmetleri** takip etmek için geliştirilmiş web tabanlı bir CRM uygulaması.

## Özellikler

- 🏛️ **Çok kiracılı (multi-tenant)** — her müşteri yalnızca kendi kiracısındaki
  veriyi görür; kiracılar birbirinin verisini ve varlığını göremez
- 🛡️ **İki katmanlı izolasyon** — uygulama katmanı + PostgreSQL Row-Level
  Security; kodda bir sorgu filtreyi unutsa bile veritabanı veri döndürmez
- 🔐 **Kullanıcı girişi** (e-posta + şifre, JWT tabanlı oturum)
- 🏢 **Firma Yönetimi** — kayıt, arama, il/durum filtresi, sayfalama (800+ firma)
- 💰 **Yatırım Destekleri** — tutar, tür, tarih ve durum takibi
- 🎓 **Eğitimler** — konu, eğitmen, süre, katılımcı ve durum takibi
- 🛠️ **Hizmetler** — sunulan hizmetlerin kaydı ve durumu
- 📈 **Raporlar** — durum/tür/il/sektör dağılımları ve en çok yatırım alan firmalar
- 📊 **Genel Bakış paneli** — özet istatistikler ve son etkinlikler

## Teknolojiler

- [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
- [Prisma ORM](https://www.prisma.io/) + **PostgreSQL** (Row-Level Security ile kiracı izolasyonu)
- [Tailwind CSS](https://tailwindcss.com/)
- Kimlik doğrulama: `jose` (JWT) + `bcryptjs`
- Dağıtım: **Docker + Nginx + Let's Encrypt** (otomatik HTTPS)

## Yerel Geliştirme

Gereksinim: Node.js 18+ (önerilen 20/22)

```bash
npm install
cp .env.example .env          # AUTH_SECRET ve DATABASE_URL değerlerini ayarlayın

# PostgreSQL gerekir. Docker ile: docker compose up -d db
npm run db:migrate            # şemayı + RLS politikalarını uygula
npm run db:seed               # örnek verileri yükle (800 firma)
npm run dev                   # http://localhost:3000
```

### Demo Giriş Bilgileri

`db:seed` **iki ayrı kiracı** üretir; böylece izolasyon elle doğrulanabilir.

| Kiracı | Rol | E-posta | Şifre |
|--------|-----|---------|-------|
| Gezegen Platform | **Platform Yöneticisi** (`/admin`) | `platform@gezegen.com` | `platform123` |
| Gezegen Danışmanlık (800 firma) | Yönetici | `admin@gezegen.com` | `admin123` |
| Gezegen Danışmanlık | Kullanıcı | `kullanici@gezegen.com` | `user123` |
| Gezegen Danışmanlık | Salt Okunur | `okuyucu@gezegen.com` | `okuyucu123` |
| Anadolu Yatırım (120 firma) | Yönetici | `admin@anadolu.com` | `anadolu123` |

İki hesapla ayrı ayrı giriş yapıp listelerin tamamen ayrı olduğunu görebilirsiniz.

### İzolasyon Doğrulama

```bash
npm run dogrula              # tümü + rapor (önerilen)

npm test                     # izolasyon + RLS + regresyon testleri (~4 sn)
npm run kontrol:e2e          # gerçek HTTP üzerinden (sunucu çalışırken)
npm run kontrol:kimlik       # giriş formu, gerçek tarayıcı (sunucu çalışırken)
```

> `db:seed` sahte demo verisi üretir; üretimde kullanılmaz (aşağıya bakın).

---

## 🚀 Sunucuya Dağıtım (Hetzner / Docker + Nginx + HTTPS)

Uygulama, tek komutla Docker üzerinde yayına alınır. Nginx ters proxy görevi
görür ve Let's Encrypt ile otomatik SSL sertifikası kurulur.

### Ön Koşullar

1. **Bir sunucu** (Hetzner Cloud vb.) — Ubuntu 22.04/24.04 önerilir.
2. Sunucuda **Docker** kurulu olmalı:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Bir **alan adı** ve DNS **A kaydının** sunucunuzun IP'sine yönlenmiş olması
   (ör. `crm.sirketiniz.com → 1.2.3.4`).
4. Sunucu güvenlik duvarında **80** ve **443** portları açık olmalı.

### Adımlar

```bash
# 1) Projeyi sunucuya klonlayın
git clone <repo-url> gezegen-crm
cd gezegen-crm

# 2) Dağıtım ayarlarını oluşturun
cp deploy/deploy.env.example deploy.env
nano deploy.env        # DOMAIN ve LETSENCRYPT_EMAIL değerlerini girin

# 3) Tek komutla dağıtın
./deploy.sh
```

`deploy.sh` şunları otomatik yapar:

- `AUTH_SECRET` yoksa güçlü bir anahtar üretir ve `deploy.env`'e kaydeder
- Nginx yapılandırmasını alan adınıza göre oluşturur
- Docker imajını derler, uygulamayı + Nginx'i + Certbot'u başlatır
- Let's Encrypt'ten gerçek SSL sertifikasını alır ve Nginx'i yeniler
- Veritabanı migrasyonlarını uygular ve ilk **yönetici kullanıcısını** oluşturur

Tamamlandığında: **https://crm.sirketiniz.com** üzerinden erişilir.

### İlk Yönetici Kullanıcısı

İlk kurulumda `deploy.env` içindeki değerlerle bir yönetici oluşturulur:

```
ADMIN_EMAIL=admin@gezegen.com
ADMIN_PASSWORD=admin123        # ← MUTLAKA değiştirin
ADMIN_NAME=Sistem Yöneticisi
```

> ⚠️ Üretimde **sahte firma verisi yüklenmez.** Kendi 800 firmanızı uygulama
> arayüzünden ekleyebilir veya toplu içe aktarma için bize bildirebilirsiniz.

### Güncelleme (yeni sürüm dağıtımı)

```bash
git pull
./deploy.sh        # sertifika korunur, sadece imaj yeniden derlenir
```

### Faydalı Komutlar

```bash
docker compose ps                     # servis durumu
docker compose logs -f app            # uygulama logları
docker compose down                   # durdur
docker compose up -d                  # başlat
```

### Veri Yedekleme

Tüm veriler `gezegen-pgdata` adlı Docker volume'ünde (PostgreSQL) tutulur:

```bash
# Yedek al
docker exec gezegen-crm-db pg_dump -U gezegen gezegen > yedek-$(date +%F).sql

# Geri yükle
cat yedek-<TARIH>.sql | docker exec -i gezegen-crm-db psql -U gezegen -d gezegen
```

### Sertifika Testi (isteğe bağlı)

Kuruluma başlamadan önce Let's Encrypt rate-limit'ine takılmamak için
`deploy.env` içinde `STAGING=1` yaparak test sertifikasıyla deneyebilir,
başarılı olunca `STAGING=0` yapıp sertifika klasörünü sıfırlayabilirsiniz:

```bash
rm -rf deploy/certbot/conf/live && ./deploy.sh
```

---

## Mevcut bir Nginx reverse proxy'ye bağlanma (çok-siteli sunucu)

Sunucuda zaten 80/443'ü yöneten bir Nginx (+ Certbot) varsa, gömülü
Nginx/Certbot yerine yalnızca uygulamayı çalıştırıp mevcut proxy'ye bağlayın:

```bash
# 1) Uygulamayı mevcut proxy ağına bağlı olarak çalıştır
#    (deploy/reverse-proxy/docker-compose.yml içindeki `name: root_web`'i
#     kendi proxy ağınızın adıyla güncelleyin)
docker compose -f deploy/reverse-proxy/docker-compose.yml up -d --build

# 2) deploy/reverse-proxy/nginx-crm.conf içindeki server bloklarını mevcut
#    Nginx yapılandırmanıza ekleyin, sertifikayı alın ve Nginx'i reload edin
#    (komutlar dosyanın başındaki yorumlarda).
```

Detaylar: `deploy/reverse-proxy/` klasörü. Bu mod, uygulamayı `gezegen-crm-app:3000`
olarak yayınlar; TLS ve alan adı yönlendirmesi mevcut Nginx tarafından yönetilir.

---

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run start` | Üretim sunucusu (Node) |
| `npm run db:migrate` | Migrasyonları uygula (prisma migrate deploy) |
| `npm run db:seed` | Örnek demo verilerini yükle |
| `npm run db:bootstrap` | Kiracı + yönetici kullanıcısı oluştur (üretim) |
| `npm test` | Kiracı izolasyonu, RLS ve regresyon testleri |
| `npm run dogrula` | Tam doğrulama + rapor (`docs/dogrulama/v<sürüm>.md`) |
| `npm run demo:kur` | Demo yönetici hesabını geri getir (veriye dokunmaz) |
| `npm run platform:kur` | Platform yöneticisi oluştur/şifresini sıfırla (`/admin` erişimi) |
| `npm run gecis:postgres` | SQLite → PostgreSQL veri taşıma (tek seferlik) |
| `./deploy.sh` | Docker + Nginx + HTTPS ile sunucuya dağıt |

## Veri Modeli

- **Tenant** — kiracı (hizmet verilen müşteri şirketi); diğer tüm modeller
  `tenantId` taşır ve kiracı sınırı hem uygulamada hem veritabanında (RLS) zorunludur
- **User** — sisteme giriş yapan ekip üyeleri
- **Firma** — müşteriye bağlı firmalar
- **YatirimDestegi** — firmaya verilen yatırım destekleri (Firma'ya bağlı)
- **Egitim** — firmaya verilen eğitimler (Firma'ya bağlı)
- **Hizmet** — firmaya sunulan hizmetler (Firma'ya bağlı)
- **Kisi** — firmadaki muhataplar; biri birincil kişi olarak işaretlenir (Faz 6)
- **Asama** — satış hattı aşamaları; **kiracıya özeldir** (Faz 6)
- **Firsat** — satış hattındaki iş: firma + kişi + aşama + tutar + olasılık (Faz 6)
- **Grup / KullaniciGrup** — izinleri toplu atama (Faz 4)
- **DenetimKaydi** — değiştirilemez denetim günlüğü (Faz 4)
- **Plan / Davet** — abonelik paketi ve kullanıcı daveti (Faz 5)
- **Bildirim / BildirimTercihi** — uygulama içi bildirim ve kanal tercihi (Faz 8)
- **EpostaAyari / EpostaKuyrugu / EpostaKaydi** — kiracının SMTP+IMAP ayarı, gönderim kuyruğu, senkronlanan yazışma özeti (Faz 8)
- **IsAkisi / IsAkisiCalismasi** — otomasyon kuralları ve çalışma günlüğü (Faz 8)
- **Aktivite** — arama/toplantı/e-posta/not/görev; `sonTarih` doluysa görevdir (Faz 7)
- **Lead** — aday kayıt; dönüştüğünde firma + kişi (+ fırsat) açılır, kaydı kalır (Faz 7)
- **Teklif / TeklifKalemi** — kalemli teklif; revizyon yeni satırdır, eskisi dondurulur (Faz 7)
- **PanoTercihi** — kullanıcının pano kart seçimi ve sırası (Faz 10)
- **KayitliGorunum** — listelerin adlandırılmış filtreleri; paylaşım kiracı içidir (Faz 10)
- **Yedek** — kiracının iş verisi yedeği; geri yükleme ekleyicidir (Faz 10)

Bir firma silindiğinde ilişkili tüm yatırım/eğitim/hizmet/kişi/fırsat kayıtları
da silinir (cascade). İçinde fırsat olan bir aşama silinemez; bir kişi
silindiğinde fırsatları silinmez, yalnızca muhatap bağlantısı boşalır.

## Proje Yapısı

```
prisma/
  schema.prisma        # Veri modeli
  migrations/          # Prisma migrasyonları (üretim için)
  seed.ts              # Demo veri üreteci (800 firma) — geliştirme
  bootstrap.ts         # Üretim: yalnızca yönetici kullanıcısı
src/
  middleware.ts        # Oturum kontrolü / sayfa koruması
  lib/                 # db, session, auth, format, sabitler
  components/          # Yeniden kullanılabilir UI bileşenleri
  app/
    login/             # Giriş sayfası
    (app)/             # Korumalı panel (sidebar düzeni)
Dockerfile             # Üretim imajı
docker-compose.yml     # db (postgres) + app + nginx + certbot
docker-entrypoint.sh   # migrate + bootstrap + start
deploy.sh              # Otomatik dağıtım script'i
deploy/
  nginx/app.conf.template
  deploy.env.example
```

## Üretime Alma Notları

- PostgreSQL çok kullanıcılı kullanım için uygundur. Çok yoğun kullanımda
  `prisma/schema.prisma` içindeki `provider` değerini `postgresql` yapıp
  `DATABASE_URL`'i güncelleyin.
- `AUTH_SECRET`'i güçlü ve gizli bir değere ayarlayın (deploy.sh otomatik üretir).
