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

Uygulanacak akış — **`scripts/release.sh` ile otomatik**:

```bash
npm run release:minor -- "rozet rengi düzeltildi"     # v1.0.1 -> v1.0.2
npm run release:major -- "teklif modülü eklendi"      # v1.0.1 -> v1.1.0
```

Betik sırasıyla: `package.json` sürümünü yükseltir → bekleyen değişiklikleri
commit'ler → annotated tag oluşturur → branch'i ve tag'i push eder.

Geri dönmek için: `git checkout v1.0.1` (veya `git revert` / `git reset --hard v1.0.1`).

### Tag push yetkisi ve token

Claude Code oturumunun git kimliği yalnızca **branch** ref'lerine push edebilir;
**tag** ref'leri uzak sunucu tarafından `HTTP 403` ile reddedilir. Bu yüzden
`scripts/release.sh`, `origin`'e tag push'u başarısız olursa bir GitHub token
ile doğrudan `github.com`'a push dener. Token şu sırayla denenir:

1. `~/.config/gezegen-crm/token` dosyası (mod 600)
2. `GH_TOKEN` ortam değişkeni
3. `GITHUB_TOKEN` ortam değişkeni

Claude Code oturumunda `GH_TOKEN`/`GITHUB_TOKEN` genellikle git relay'ine ait
`proxy-...` yer tutucusudur; betik bu değerleri eler. Bu yüzden dosya önce gelir.

Token **asla depoya yazılmaz** — üç kaynak da repo dışındadır.

Konteyner geçici olduğu için dosyaya kaydedilen token yalnızca o oturum boyunca
yaşar. Kalıcı olması için token'ı Claude Code ortam ayarlarında gerçek bir
`GH_TOKEN` değeri olarak tanımlayın; betik onu kendiliğinden bulur.

Token için önerilen kapsam: **fine-grained PAT**, yalnızca `kahv6lik/tunca`
deposu, tek izin **Contents: Read and write**.

### Versiyon Geçmişi

- **v1.0.1** — Mevcut CRM (firma, yatırım desteği, eğitim, hizmet, raporlar,
  dark-mode arayüz) için ilk versiyon etiketi; versiyonlama akışının başlangıcı.
