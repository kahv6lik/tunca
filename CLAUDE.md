# Gezegen CRM — Proje Notları

## Uygulama Nedir

Müşteriye bağlı **firmalara** verilen **yatırım desteklerini, eğitimleri ve
hizmetleri** takip eden web tabanlı bir CRM. Arayüz tamamen Türkçe.

## Teknoloji Yığını

- **Next.js 14** (App Router + Server Actions, `src/app`)
- **Prisma ORM + SQLite** (`prisma/schema.prisma`, `DATABASE_URL`)
- **Tailwind CSS** + shadcn tarzı bileşen sistemi, dark mode (`next-themes`)
- **Recharts** (grafikler) + **framer-motion** (animasyon)
- Kimlik doğrulama: `jose` (JWT, `gezegen_session` cookie) + `bcryptjs`
- Dağıtım: Docker + Nginx + Let's Encrypt (`deploy.sh`, `docker-compose.yml`)

## Dizin Yapısı

```
prisma/
  schema.prisma        # User, Firma, YatirimDestegi, Egitim, Hizmet modelleri
  migrations/          # prisma migrate deploy ile uygulanır
  seed.ts              # demo veri (800 firma) — üretimde kullanılmaz
  bootstrap.ts         # üretim için ilk kullanıcı oluşturma
src/
  middleware.ts        # JWT doğrulama, /login dışındaki her yolu korur
  app/
    login/             # giriş sayfası + actions
    (app)/             # oturum gerektiren panel
      page.tsx         # Genel Bakış (KPI + grafikler + son etkinlikler)
      firmalar/        # liste, detay, yeni, düzenle + actions
      yatirim-destekleri/
      egitimler/
      hizmetler/
      raporlar/        # durum/tür/il/sektör dağılımları
      layout.tsx       # Sidebar + Topbar kabuğu
  components/
    ui/                # button, card, badge, pagination, skeleton, ...
    layout/            # sidebar, topbar, mobile-nav, theme-toggle, user-menu
    charts/            # area, bar, donut, tooltip
    dashboard/         # kpi-card, chart-card
    FirmaForm, RecordForm, AddPanel, edit-record-dialog, DeleteButton
  lib/
    auth.ts, session.ts   # oturum ve requireSession
    constants.ts          # durum/tür sabitleri + rozet etiketleri
    db.ts, format.ts, utils.ts, tr-iller.ts, chart-*.ts
```

### Veri Modeli

`Firma` merkezdedir; `YatirimDestegi`, `Egitim` ve `Hizmet` kayıtları firmaya
`firmaId` ile bağlıdır (`onDelete: Cascade`). SQLite kullanıldığı için enum
yerine `String` alan + `src/lib/constants.ts` içindeki sabitler kullanılır.

---

## Versiyonlama Kuralı (ÖNEMLİ — her geliştirmede uygulanır)

Bundan sonra **her geliştirme bir git tag'i ile çıkılır**, böylece istenen
versiyona geri dönmek mümkün olur.

- **Major değişiklik** → ikinci hane artar: `v1.0.0` → `v1.1.0`
  (yeni modül/sayfa, veri modeli değişikliği, mimari veya kırıcı değişiklik)
- **Minor değişiklik** → üçüncü hane artar: `v1.0.0` → `v1.0.1`
  (hata düzeltmesi, arayüz rötuşu, metin/etiket değişikliği, küçük iyileştirme)

Uygulanacak akış:

1. Değişikliği yap ve commit'le.
2. `package.json` içindeki `version` alanını yeni versiyona güncelle.
3. Anlamlı bir mesajla annotated tag oluştur:
   `git tag -a v1.0.2 -m "v1.0.2 — kısa açıklama"`
4. Branch'i ve tag'i gönder:
   `git push -u origin <branch>` ve `git push origin v1.0.2`

Geri dönmek için: `git checkout v1.0.1` (veya `git revert` / `git reset --hard v1.0.1`).

### Versiyon Geçmişi

- **v1.0.1** — Mevcut CRM (firma, yatırım desteği, eğitim, hizmet, raporlar,
  dark-mode arayüz) için ilk versiyon etiketi; versiyonlama akışının başlangıcı.
