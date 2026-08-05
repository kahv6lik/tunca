# Gezegen CRM — Proje Notları

## Uygulama Nedir

Müşteriye bağlı **firmalara** verilen **yatırım desteklerini, eğitimleri ve
hizmetleri** takip eden web tabanlı bir CRM. Arayüz tamamen Türkçe.

### Hedef Ürün (ÖNEMLİ)

Uzak sunucuda çalışan, **çok kiracılı (multi-tenant) SaaS CRM**. Tek uygulama
üzerinden birden çok müşteriye hizmet verilir:

- Her müşteri yalnızca **kendi tenant'ındaki** veriyi görür, düzenler, yönetir.
- **Farklı müşteriler asla birbirini göremez ve birbirinden haberdar olmaz.**
- Platform sahibi ayrı bir **admin panel** üzerinden müşterileri şirketlerine
  göre ekler, kullanıcıları tek tek veya gruplar halinde yetkilendirir.

Bu hedef, tüm geliştirmelerin çerçevesidir. **Faz 1'den itibaren hiçbir yeni
sorgu `tenantId` filtresi olmadan yazılmaz.**

## Teknoloji Yığını

- **Next.js 14** (App Router + Server Actions, `src/app`)
- **Prisma ORM + SQLite** (`prisma/schema.prisma`, `DATABASE_URL`)
- **Tailwind CSS** + shadcn tarzı bileşen sistemi, dark mode (`next-themes`)
- **Recharts** (grafikler) + **framer-motion** (animasyon)
- Kimlik doğrulama: `jose` (JWT, `gezegen_session` cookie) + `bcryptjs`
- Dağıtım: Docker + Nginx + Let's Encrypt (`deploy.sh`, `docker-compose.yml`)
  — sunucuya sürüm alma adımları: **`docs/DEPLOY.md`**

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

`Tenant` en üsttedir; diğer tüm modeller `tenantId` taşır. `Firma` iş verisinin
merkezidir; `YatirimDestegi`, `Egitim` ve `Hizmet` kayıtları firmaya `firmaId`
ile bağlıdır (`onDelete: Cascade`). SQLite kullanıldığı için enum yerine
`String` alan + `src/lib/constants.ts` içindeki sabitler kullanılır.

### Kiracı Katmanı (Faz 1'den itibaren ZORUNLU)

Veri erişimi **yalnızca `src/lib/tenant-db.ts` üzerinden** yapılır:

```ts
const db = await getTenantDb();           // oturumdaki kiracıya bağlı
const firmalar = await db.firma.findMany(); // tenantId otomatik eklenir
```

- `findUnique`, `update`, `delete`, `upsert` **engellidir** — kiracı filtresi
  uygulanamayan işlemlerdir. Yerlerine `findFirst`, `tenantGuncelle`,
  `tenantSil`, `tenantOlustur` yardımcıları kullanılır.
- Alt kayıt oluşturulurken `firmaSahipligiDogrula` ile firmanın kiracıya ait
  olduğu doğrulanır.
- `prisma`'nın doğrudan kullanıldığı tek yer giriş action'ıdır
  (`src/app/login/actions.ts`) — oturum öncesi kiracı henüz belli değildir.

### Doğrulama (ZORUNLU — her geliştirmede)

```bash
npm run dogrula
```

Tip kontrolü + derleme + migration + demo veri + kiracı izolasyonu (veri
katmanı ve HTTP) + gerçek tarayıcıyla kimlik doğrulama = **58 kontrol**.
Sonuç `docs/dogrulama/v<sürüm>.md` dosyasına yazılır ve depoda kalır.
Doğrulama kendi geçici veritabanını ve portunu (3100) kullanır; geliştirme
veritabanına dokunmaz.

Tek tek: `kontrol:izolasyon` (19), `kontrol:e2e` (14), `kontrol:kimlik` (18).

Giriş yapılamaz duruma düşülürse: `npm run demo:kur` — demo yönetici hesabını
(`admin@gezegen.com` / `admin123`, tam yetkili) veriye dokunmadan geri getirir.

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

---

## Geliştirme Yol Haritası (ONAYLANDI)

Detaylı çalışma paketleri, kabul kriterleri ve riskler: **`docs/ROADMAP.md`**.
Her faz **bir major sürümle** kapanır (`npm run release:major`).

**`docs/ROADMAP.md` projenin tek doğru kaynağıdır.** Projede iki kişi
çalışıyor; işe başlamadan önce oradaki "Şu An Neredeyiz" ve "Nasıl Çalışıyoruz"
bölümlerine bakılır, iş bitince durum ve kutucuklar oradan güncellenir.

| Faz | Kapsam | Sürüm | Durum |
|-----|--------|-------|-------|
| 1  | Tenant veri modeli, oturum bağlamı, sahiplik doğrulama (A1-A3) | `v1.1.0` | ✅ tamamlandı |
| 2  | PostgreSQL'e geçiş + Row-Level Security (A4) | `v1.2.0` | planlandı |
| 3  | Çapraz kiracı sızıntı testleri + test altyapısı (A5) | `v1.3.0` | planlandı |
| 4  | RBAC, kullanıcı grupları, denetim günlüğü (A6-A8) | `v1.4.0` | planlandı |
| 5  | Admin panel: tenant/kullanıcı/davet/paket/impersonation/markalama (B1-B7) | `v1.5.0` | planlandı |
| 6  | Kişi, Fırsat/Anlaşma, Kanban satış hattı (C1-C3) | `v1.6.0` | planlandı |
| 7  | Aktivite, Lead, timeline, teklif (C4-C7) | `v1.7.0` | planlandı |
| 8  | Bildirim, iş akışı otomasyonu, e-posta, takvim (D1-D5) | `v1.8.0` | planlandı |
| 9  | Excel/CSV dışa-içe aktarım, PDF (E1, E2, E5) | `v1.9.0` | planlandı |
| 10 | Özelleştirilebilir dashboard, kayıtlı görünüm, yedekleme (E3, E4, E7) | `v1.10.0` | planlandı |
| 11 | Kiracıya özel alanlar (E6) | `v1.11.0` | planlandı |
| 12 | Şifre politikası, 2FA, oturum yönetimi, rate limit, KVKK (F1-F4, F7) | `v1.12.0` | planlandı |
| 13 | AI: skorlama, özet, doğal dilde sorgu (G1-G3) | `v1.13.0` | planlandı |

Faz tamamlandıkça bu tablodaki **Durum** sütunu güncellenir.

### Versiyon Geçmişi

- **v1.0.1** — Mevcut CRM (firma, yatırım desteği, eğitim, hizmet, raporlar,
  dark-mode arayüz) için ilk versiyon etiketi; versiyonlama akışının başlangıcı.
- **v1.0.2** — Sürüm çıkarma otomasyonu (`scripts/release.sh`).
- **v1.0.3** — Sürüm betiğinde token seçimi düzeltmesi.
- **v1.0.4** — 13 fazlık geliştirme yol haritası (`docs/ROADMAP.md`).
- **v1.1.0** — **Faz 1:** Çok kiracılılık temeli. `Tenant` modeli, tüm
  modellerde `tenantId`, oturumda kiracı bağlamı, merkezî kiracı katmanı,
  sahiplik doğrulaması. Giriş yapmış bir kullanıcının ID'sini bildiği her kaydı
  düzenleyebildiği açık kapatıldı.
