# Tunca CRM

Müşteriye bağlı firmalara verilen **yatırım desteklerini, eğitimleri ve
hizmetleri** takip etmek için geliştirilmiş web tabanlı bir CRM uygulaması.

## Özellikler

- 🔐 **Kullanıcı girişi** (e-posta + şifre, JWT tabanlı oturum)
- 🏢 **Firma Yönetimi** — kayıt, arama, il/durum filtresi, sayfalama (800+ firma)
- 💰 **Yatırım Destekleri** — tutar, tür, tarih ve durum takibi
- 🎓 **Eğitimler** — konu, eğitmen, süre, katılımcı ve durum takibi
- 🛠️ **Hizmetler** — sunulan hizmetlerin kaydı ve durumu
- 📈 **Raporlar** — durum/tür/il/sektör dağılımları ve en çok yatırım alan firmalar
- 📊 **Genel Bakış paneli** — özet istatistikler ve son etkinlikler

## Teknolojiler

- [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
- [Prisma ORM](https://www.prisma.io/) + **SQLite** (kolay kurulum; Postgres'e taşınabilir)
- [Tailwind CSS](https://tailwindcss.com/)
- Kimlik doğrulama: `jose` (JWT) + `bcryptjs`

## Kurulum

Gereksinim: Node.js 18+ (önerilen 20/22)

```bash
# 1) Bağımlılıkları kur
npm install

# 2) Ortam değişkenlerini ayarla
cp .env.example .env
#   .env içindeki AUTH_SECRET değerini üretimde mutlaka değiştirin:
#   openssl rand -base64 32

# 3) Veritabanını oluştur ve örnek verilerle doldur
npm run db:push
npm run db:seed

# 4) Geliştirme sunucusunu başlat
npm run dev
```

Uygulama: http://localhost:3000

### Demo Giriş Bilgileri

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Yönetici | `admin@tunca.com` | `admin123` |
| Kullanıcı | `kullanici@tunca.com` | `user123` |

> Üretime almadan önce bu kullanıcıları ve `AUTH_SECRET` değerini mutlaka değiştirin.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run start` | Üretim sunucusu |
| `npm run db:push` | Şemayı veritabanına uygula |
| `npm run db:seed` | Örnek verileri yükle |
| `npm run db:reset` | Veritabanını sıfırla + yeniden doldur |

## Veri Modeli

- **User** — sisteme giriş yapan ekip üyeleri
- **Firma** — müşteriye bağlı firmalar
- **YatirimDestegi** — firmaya verilen yatırım destekleri (Firma'ya bağlı)
- **Egitim** — firmaya verilen eğitimler (Firma'ya bağlı)
- **Hizmet** — firmaya sunulan hizmetler (Firma'ya bağlı)

Bir firma silindiğinde ilişkili tüm yatırım/eğitim/hizmet kayıtları da silinir (cascade).

## Proje Yapısı

```
prisma/
  schema.prisma        # Veri modeli
  seed.ts              # Örnek veri üreteci (800 firma)
src/
  middleware.ts        # Oturum kontrolü / sayfa koruması
  lib/                 # db, session, auth, format, sabitler
  components/          # Yeniden kullanılabilir UI bileşenleri
  app/
    login/             # Giriş sayfası
    (app)/             # Korumalı panel (sidebar düzeni)
      page.tsx         # Genel bakış
      firmalar/        # Firma listesi, detay, yeni, düzenle
      yatirim-destekleri/
      egitimler/
      hizmetler/
      raporlar/
```

## Üretime Alma Notları

- SQLite tek sunucu için idealdir. Çok kullanıcılı yoğun kullanımda
  `prisma/schema.prisma` içindeki `provider` değerini `postgresql` yapıp
  `DATABASE_URL`'i güncelleyin.
- `AUTH_SECRET`'i güçlü ve gizli bir değere ayarlayın.
