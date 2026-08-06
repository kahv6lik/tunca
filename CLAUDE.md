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
- **Prisma ORM + PostgreSQL** (`prisma/schema.prisma`, `DATABASE_URL`)
  — kiracı izolasyonu Row-Level Security ile veritabanı katmanında da zorunlu
- **Tailwind CSS** + shadcn tarzı bileşen sistemi, dark mode (`next-themes`)
- **Recharts** (grafikler) + **framer-motion** (animasyon)
- Kimlik doğrulama: `jose` (JWT, `gezegen_session` cookie) + `bcryptjs`
- Dağıtım: Docker + Nginx + Let's Encrypt (`deploy.sh`, `docker-compose.yml`)
  — sunucuya sürüm alma adımları: **`docs/DEPLOY.md`**

## Dizin Yapısı

```
prisma/
  schema.prisma        # Tenant, User, Firma, YatirimDestegi, Egitim, Hizmet,
                       # Grup, KullaniciGrup, DenetimKaydi, Plan, Davet,
                       # Kisi, Asama, Firsat
  migrations/          # prisma migrate deploy ile uygulanır (RLS dahil)
  _sqlite-arsiv/       # Faz 2 öncesi SQLite migration'ları (uygulanmaz)
  seed.ts              # demo veri (800 firma) — üretimde kullanılmaz
  bootstrap.ts         # üretim için ilk kullanıcı oluşturma
src/
  middleware.ts        # JWT doğrulama; yalnızca /login ve /davet açıktır
  app/
    login/             # giriş sayfası + actions
    davet/[token]/     # davet kabul — giriş gerektirmez (Faz 5)
    admin/             # platform yönetimi — yalnızca platform_admin (Faz 5)
                       #   kiracilar/ (liste, detay, yeni), paketler/, page.tsx
    (app)/             # oturum gerektiren panel
      page.tsx         # Genel Bakış (KPI + grafikler + son etkinlikler)
      firmalar/        # liste, detay, yeni, düzenle + actions
      kisiler/         # kişi listesi + actions (Faz 6)
      firsatlar/       # kanban + liste + asamalar/ (Faz 6)
      yatirim-destekleri/
      egitimler/
      hizmetler/
      raporlar/        # durum/tür/il/sektör dağılımları
      gruplar/         # kullanıcı grupları ve izinleri (Faz 4)
      denetim/         # denetim günlüğü — salt okunur (Faz 4)
      yetkisiz/        # yetkisiz erişim bilgilendirmesi
      layout.tsx       # Sidebar + Topbar kabuğu
  components/
    ui/                # button, card, badge, pagination, skeleton, ...
    layout/            # sidebar, topbar, mobile-nav, theme-toggle, user-menu
    charts/            # area, bar, donut, tooltip
    dashboard/         # kpi-card, chart-card
    admin/             # KiraciForm, KullaniciSatiri, DavetPanel, PlanPanel, ...
    firsatlar/         # Kanban, FirsatPanel, AsamaPanel (Faz 6)
    FirmaForm, RecordForm, AddPanel, edit-record-dialog, DeleteButton
  lib/
    auth.ts, session.ts   # oturum ve requireSession
    constants.ts          # durum/tür sabitleri + rozet etiketleri
    tenant-db.ts          # kiracı kapsamlı veri erişimi (ZORUNLU giriş noktası)
    platform-db.ts        # kiracılar ötesi erişim — TEK KAPI (Faz 5)
    davet-db.ts           # davet akışı, oturum öncesi erişim — TEK KAPI (Faz 5)
    kiraci-ayar.ts        # kiracının markası ve paket limitleri (Faz 5)
    rls.ts                # PostgreSQL RLS bağlamları
    yetki-tanimlar.ts     # izin anahtarları + rol matrisi (saf veri)
    yetki.ts              # yetki kontrolü (server-only)
    denetim.ts            # denetim günlüğü yazımı
    db.ts, format.ts, utils.ts, tr-iller.ts, chart-*.ts, version.ts
```

### Veri Modeli

`Tenant` en üsttedir; diğer tüm modeller `tenantId` taşır. Faz 4 ile `Grup`,
`KullaniciGrup` ve `DenetimKaydi`, Faz 5 ile `Plan` ve `Davet`, Faz 6 ile
`Kisi`, `Asama` ve `Firsat` eklendi.
`Plan` bilinçli olarak kiracıya ait DEĞİLDİR: platform genelinde tanımlanır,
kiracılar ona atanır. `Firma` iş verisinin
merkezidir; `YatirimDestegi`, `Egitim`, `Hizmet`, `Kisi` ve `Firsat` kayıtları
firmaya `firmaId` ile bağlıdır (`onDelete: Cascade`). `Firsat` ayrıca bir
`Asama`ya bağlıdır (`onDelete: Restrict` — içinde iş olan aşama silinemez) ve
isteğe bağlı bir `Kisi`ye (`onDelete: SetNull` — muhatabın ayrılması işi
ortadan kaldırmaz). Enum yerine `String` alan +
`src/lib/constants.ts` içindeki sabitler kullanılır (Faz 11'deki kiracıya özel
alanları kolaylaştırdığı için korunan bir tercih).

### Kiracı Katmanı — İKİ KATMAN (ZORUNLU)

**1. Uygulama katmanı** — veri erişimi **yalnızca `src/lib/tenant-db.ts`
üzerinden** yapılır:

```ts
const db = await getTenantDb();           // oturumdaki kiracıya bağlı
const firmalar = await db.firma.findMany(); // tenantId otomatik eklenir
```

- `findUnique`, `update`, `delete`, `upsert` **engellidir** — kiracı filtresi
  uygulanamayan işlemlerdir. Yerlerine `findFirst`, `tenantGuncelle`,
  `tenantSil`, `tenantOlustur` yardımcıları kullanılır.
- Alt kayıt oluşturulurken `firmaSahipligiDogrula` ile firmanın kiracıya ait
  olduğu doğrulanır.
- Kiracılar ötesi okumanın yapıldığı tek yer giriş action'ıdır
  (`src/app/login/actions.ts`) — oturum öncesi kiracı henüz belli değildir ve
  orada yalnızca `kimlikIstemcisi` (salt okuma) kullanılır.

### Yetkilendirme Katmanı (Faz 4 — ZORUNLU)

Kiracı sınırı "hangi müşteri", yetkilendirme "aynı kuruluşta kim ne yapabilir"
sorusunu yanıtlar.

```ts
await yetkiGerektir(IZIN.firmaGoruntule);   // sayfalarda, veri okumadan ÖNCE
if (!(await yetkiVarMi(IZIN.firmaSil))) …   // action'larda ve arayüzde
```

- Roller: `platform_admin`, `tenant_admin`, `uye`, `salt_okunur`.
  Matris `src/lib/yetki-tanimlar.ts`, kontrol `src/lib/yetki.ts`.
- **Etkin izin = (rol izinleri ∪ grup izinleri) ∖ paketi kapalı modüller.**
  Grup yalnızca ekler, paket yalnızca kısıtlar (Faz 5 / B4). Paket kısıtı
  `etkinIzinler()` içinde uygulandığı için bütün sayfa ve action korumalarında
  kendiliğinden geçerlidir; ayrıca kontrol yazmak gerekmez.
- **Yetki kontrolü her zaman sunucuda.** Arayüzde düğme gizlemek koruma
  değildir; kullanıcı Server Action'ı doğrudan çağırabilir.
- Her yazma işlemi `denetimYaz` ile denetim günlüğüne düşer
  (`src/lib/denetim.ts`). Günlük **değiştirilemez** — RLS'te kiracı için
  yalnızca SELECT ve INSERT politikası vardır.

### Platform Katmanı (Faz 5 — İKİ DAR KAPI)

Kiracı izolasyonunun **bilinçli** iki istisnası vardır. Her ikisi de tek bir
dosyada toplanmıştır ve regresyon testi bu dosyaların dışında yönetim bağlamı
kullanılmadığını sürekli denetler:

| Kapı | Dosya | Kim geçer | Neden gerekli |
|------|-------|-----------|---------------|
| Admin panel | `src/lib/platform-db.ts` | `platform_admin` | Platform sahibi bütün müşterileri yönetir |
| Davet kabulü | `src/lib/davet-db.ts` | token sahibi | Davet edilen kişinin henüz hesabı yok |

```ts
const db = await getPlatformDb();   // her çağrıda platform_admin doğrulanır
```

- `/admin` altındaki her sayfa hem layout'ta hem kendi içinde bu kapıdan geçer
  (Server Action'lar layout'tan geçmez — layout'a güvenmek yetmez).
- **Impersonation** ("kiracı olarak görüntüle") oturuma `impersonatorId` ve
  `impersonatorEmail` yazar; rol bilinçli olarak `tenant_admin`'e düşürülür.
  Bu bağlamda yapılan her işlem denetim günlüğüne **gerçek yönetici**
  kimliğiyle düşer ve arayüzde kapatılamaz bir uyarı bandı durur.
- **Davet token'ının kendisi saklanmaz** — yalnızca sha256 özeti. Kiracı,
  e-posta ve rol istemciden gelmez, davet kaydından okunur.

### Satış Hattı (Faz 6)

`Firsat.asamaId` hattaki **yeri**, `Firsat.durum` (`acik` / `kazanildi` /
`kaybedildi`) **sonucu** anlatır — ikisi bilinçli olarak ayrıdır. Kapanan
fırsat son aşamasında kalır ama kanban'ın açık sütunlarından düşer.
Beklenen ciro *tutar × olasılık* ile hesaplanır.

- Aşamalar **kiracıya özeldir**; her kuruluş kendi sürecini kurar.
- Aşama yönetimi izni `firsat.asama` anahtarıyla tanımlıdır (`firsat.` ön eki
  bilinçlidir: paket "firsat" modülünü kapatınca aşama yönetimi de düşer).
- Sürükle-bırak için ek kütüphane yoktur; tarayıcının HTML5 API'si kullanılır
  ve her kartta ayrıca aşama seçici bulunur (dokunmatik + klavye için).

**2. Veritabanı katmanı (Faz 2)** — PostgreSQL Row-Level Security.
`src/lib/rls.ts` her sorguyu bağlam ayarlanmış bir işleme sarar:

| Bağlam | Kullanım | Yetki |
|--------|----------|-------|
| `app.tenant_id` | `kiraciIstemcisi()` — normal trafik | O kiracının satırları |
| `app.kimlik_dogrulama` | `kimlikIstemcisi()` — yalnızca giriş | User+Tenant, salt okuma |
| `app.yonetim` | `yonetimIstemcisi()` — kurulum betikleri | Tam erişim |

Bağlam ayarlanmazsa veritabanı **sıfır satır** döndürür. Yani uygulama
katmanında bir sorgu filtreyi unutsa bile veri sızmaz.

### Doğrulama (ZORUNLU — her geliştirmede)

```bash
npm run dogrula
```

Tip kontrolü + derleme + migration + demo veri + otomatik test paketi (Vitest)
+ HTTP izolasyonu + gerçek tarayıcıyla kimlik ve yetki doğrulaması =
**170 kontrol**.
Sonuç `docs/dogrulama/v<sürüm>.md` dosyasına yazılır ve depoda kalır.
Doğrulama ayrı bir PostgreSQL şeması (`dogrulama`) ve ayrı bir port (3100)
kullanır; geliştirme veritabanınıza dokunmaz.

Tek tek:

```bash
npm test                 # Vitest: izolasyon + RLS + yetki + denetim + regresyon (95 test, ~5 sn)
npm run test:izle        # geliştirirken sürekli koşan hâli
npm run kontrol:e2e      # HTTP (sunucu çalışırken, 14)
npm run kontrol:kimlik   # giriş + yetki + admin + satış, gerçek tarayıcı (sunucu çalışırken, 54)
```

**CI:** `.github/workflows/ci.yml` her push ve PR'da Postgres servisiyle tip
kontrolü, derleme ve testleri koşar. Kiracı sınırını bozan bir değişiklik
birleştirilmeden önce yakalanır.

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
| 2  | PostgreSQL'e geçiş + Row-Level Security (A4) | `v1.2.0` | ✅ tamamlandı |
| 3  | Çapraz kiracı sızıntı testleri + test altyapısı (A5) | `v1.3.0` | ✅ tamamlandı |
| 4  | RBAC, kullanıcı grupları, denetim günlüğü (A6-A8) | `v1.4.0` | ✅ tamamlandı |
| 5  | Admin panel: tenant/kullanıcı/davet/paket/impersonation/markalama (B1-B7) | `v1.5.0` | ✅ tamamlandı |
| 6  | Kişi, Fırsat/Anlaşma, Kanban satış hattı (C1-C3) | `v1.6.0` | ✅ tamamlandı |
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
- **v1.2.0** — **Faz 2:** PostgreSQL'e geçiş ve Row-Level Security. Kiracı
  sınırı veritabanı katmanında da zorunlu; bağlam ayarlanmazsa sıfır satır.
- **v1.3.0** — **Faz 3:** Çapraz kiracı sızıntı testleri ve test altyapısı
  (ayrı `test` şeması, gerçek tarayıcıyla kimlik kontrolü).
- **v1.4.0** — **Faz 4:** RBAC, kullanıcı grupları, değiştirilemez denetim
  günlüğü.
- **v1.5.0** — **Faz 5:** Admin panel. `/admin` altında kiracı, kullanıcı,
  davet ve paket yönetimi; platform metrikleri; impersonation; kiracı
  markalaması. Kiracılar ötesi erişim iki dar kapıya (`platform-db.ts`,
  `davet-db.ts`) hapsedildi ve regresyon testiyle sabitlendi.
- **v1.6.0** — **Faz 6:** Satış çekirdeği. Kişi (Contact), Fırsat/Anlaşma
  (Deal) ve kiracıya özel aşamalarla sürükle-bırak kanban satış hattı.
  `Firma.yetkiliAd` verisi migration'da kişi kaydına taşındı.
