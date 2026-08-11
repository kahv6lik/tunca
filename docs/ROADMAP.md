# Gezegen CRM — Geliştirme Yol Haritası

Hedef ürün: **uzak sunucuda çalışan, çok kiracılı (multi-tenant) SaaS CRM.**
Tek uygulama üzerinden birden çok müşteriye hizmet verilir. Her müşteri yalnızca
kendi kiracısındaki (tenant) veriyi görür, düzenler ve yönetir. Müşteriler
birbirlerinin varlığından dahi haberdar olmaz. Platform sahibi, ayrı bir admin
paneli üzerinden müşterileri, kullanıcıları ve yetkileri yönetir.

> **Bu dosya projenin tek doğru kaynağıdır.** İki kişi çalıştığımız için
> geliştirmeye başlamadan önce buraya bakılır, iş bitince buradaki durum
> güncellenir. Kod ile bu dosya çeliştiğinde, kod düzeltilir değil — önce
> konuşulur, sonra ikisi birden güncellenir.

## Şu An Neredeyiz

| | |
|---|---|
| **Son çıkan sürüm** | `v1.24.0` — liquid glass tema (ön sürümden onaylanarak prod'a alındı) |
| **Sıradaki faz** | yok — **yol haritasının 21 fazı tamamlandı** |
| **Sonrası** | yeni istekler aşağıdaki "Faz Sonrası İstekler" bölümüne eklenir |
| **Devam eden iş** | yok |

## Genel Kurallar

- Her faz **ayrı bir sürüm etiketiyle** kapanır (major → ikinci hane artar).
- Faz kapanışı `npm run release:major -- "Faz N — <özet>"` ile yapılır.
- Bir faz, kabul kriterleri sağlanmadan kapanmış sayılmaz.
- Faz 1'den itibaren **hiçbir yeni sorgu `tenantId` filtresi olmadan yazılmaz.**
  Veri erişimi yalnızca `src/lib/tenant-db.ts` üzerinden yapılır.
- Her birleştirme öncesi `npm test` çalıştırılır ve geçmelidir (CI de koşar).

## Nasıl Çalışıyoruz (2 kişilik ekip)

### İş alma

1. Aşağıdaki faz tablosundan **"planlandı"** durumundaki bir çalışma paketini seç.
2. Tabloda o fazın **Sorumlu** hücresine adını yaz, durumu **🔨 devam ediyor**
   yap ve bu değişikliği tek başına commit'le
   (`docs: Faz N sorumlusu <ad>`). Böylece diğer kişi aynı işe girmez.
3. Faz bölümündeki çalışma paketi kutucuklarını (`- [ ]`) iş ilerledikçe işaretle.

### Dal (branch) düzeni

```
main                       # kararlı; yalnızca tamamlanmış fazlar
faz-2-postgres-rls         # faz dalı — tek bir fazın tüm işi
faz-2/rls-politikalari     # istenirse alt dal
```

- Faz dalı adı: `faz-<numara>-<kısa-ad>`.
- Faz bitince faz dalı `main`'e birleştirilir ve **sürüm etiketi `main` üzerinde
  atılır**.
- İki kişi aynı fazda çalışacaksa alt dal açın; aynı dosyada eşzamanlı
  çalışmaktan kaçının (özellikle `prisma/schema.prisma` ve `src/lib/tenant-db.ts`).

### Veri modeli değişiklikleri — dikkat

`prisma/schema.prisma` iki kişinin en kolay çakıştığı dosya. Kural:

- Şemaya dokunacak kişi önce diğerine haber verir.
- Migration **her zaman** yeni bir dosya olarak eklenir, mevcut migration
  düzenlenmez (uygulanmış migration'ı değiştirmek diğer geliştiricinin
  veritabanını bozar).
- Migration ürettikten sonra karşı taraf `npm run db:migrate` çalıştırır.

### Sürüm çıkarma

```bash
npm run release:minor -- "kısa açıklama"    # hata düzeltmesi, rötuş
npm run release:major -- "Faz N — özet"     # bir faz tamamlandığında
```

Betik sürümü yükseltir, commit'ler, tag atar ve push eder. Tag push'u yetki
hatası verirse (Claude Code oturumlarında olabiliyor) tag'i elle atın:

```bash
git tag -a v1.2.0 <commit> -m "v1.2.0 — Faz 2: PostgreSQL + RLS"
git push origin v1.2.0
```

### Doğrulama — her geliştirmede

```bash
npm run dogrula
```

Tek komut; tip kontrolü, üretim derlemesi, migration, demo veri, otomatik test
paketi, HTTP izolasyonu ve gerçek tarayıcıyla kimlik + yetki doğrulamasını
çalıştırır (**373 kontrol**). Sonucu ekrana yazar ve **`docs/dogrulama/v<sürüm>.md`** dosyasına
kaydeder. Bu dosya, o sürümün doğru çalıştığının kanıtı olarak depoda kalır.

Önemli: doğrulama ayrı bir PostgreSQL şeması (`dogrulama`) ve ayrı bir port
(3100) kullanır — **geliştirme veritabanınıza dokunmaz.** Şema her çalıştırmada
sıfırdan kurulur ve sonunda silinir.

Tek tek çalıştırmak isterseniz:

```bash
npm test                 # Vitest: izolasyon + RLS + yetki + denetim + regresyon (219 test)
npm run test:izle        # geliştirirken sürekli koşan hâli
npm run kontrol:e2e      # HTTP (sunucu çalışırken)
npm run kontrol:kimlik   # giriş formu, gerçek tarayıcı (sunucu çalışırken)
```

**CI:** `.github/workflows/ci.yml` her push ve pull request'te Postgres
servisiyle tip kontrolü, derleme ve testleri koşar — kiracı sınırını bozan bir
değişiklik birleştirilmeden önce yakalanır.

### Faz kapanış kontrol listesi

Bir fazı kapatmadan önce hepsi sağlanmalı:

- [ ] Faz bölümündeki tüm çalışma paketleri işaretli
- [ ] Kabul kriterleri tek tek doğrulandı
- [ ] `npm run dogrula` **sıfır hatayla** geçiyor
- [ ] `docs/dogrulama/v<sürüm>.md` raporu commit'lendi
- [ ] Bu dosyada faz durumu ✅, "Şu An Neredeyiz" tablosu güncel
- [ ] `CLAUDE.md` içindeki faz tablosu ve sürüm geçmişi güncel
- [ ] `npm run release:major` ile sürüm çıkarıldı

### Giriş yapamıyorsanız

Demo yönetici hesabını veriye dokunmadan geri getirir:

```bash
npm run demo:kur     # admin@gezegen.com / admin123, tam yetkili admin
```

Kiracı yoksa oluşturur, kullanıcı yoksa oluşturur, varsa şifresini ve rolünü
sıfırlar. Firmalarınız ve kayıtlarınız etkilenmez.

## Faz Özeti

Durum işaretleri: `planlandı` · `🔨 devam ediyor` · `⏸ beklemede` · `✅ tamamlandı`

| Faz | Kapsam | Sürüm | Durum | Sorumlu |
|-----|--------|-------|-------|---------|
| 1  | A1, A2, A3 — Tenant veri modeli, oturum bağlamı, sahiplik doğrulama | `v1.1.0` | ✅ tamamlandı | — |
| 2  | A4 — PostgreSQL'e geçiş + Row-Level Security | `v1.2.0` | ✅ tamamlandı | — |
| 3  | A5 — Çapraz kiracı sızıntı testleri | `v1.3.0` | ✅ tamamlandı | — |
| 4  | A6, A7, A8 — RBAC, kullanıcı grupları, denetim günlüğü | `v1.4.0` | ✅ tamamlandı | — |
| 5  | B1–B7 — Admin panel (tenant/kullanıcı/paket/impersonation/markalama) | `v1.5.0` | ✅ tamamlandı | — |
| 6  | C1, C2, C3 — Kişi, Fırsat/Anlaşma, Kanban satış hattı | `v1.6.0` | ✅ tamamlandı | — |
| 7  | C4–C7 — Aktivite, Lead, timeline, teklif | `v1.7.0` | ✅ tamamlandı | — |
| 8  | D1–D5 — Bildirim, iş akışı, e-posta, takvim | `v1.8.0` | ✅ tamamlandı | — |
| 9  | E1, E2, E5 — Dışa/içe aktarım, PDF | `v1.9.0` | ✅ tamamlandı | — |
| 10 | E3, E4, E7 — Dashboard, kayıtlı görünüm, yedekleme | `v1.10.0` | ✅ tamamlandı | — |
| 11 | E6 — Tenant'a özel alanlar | `v1.11.0` | ✅ tamamlandı | — |
| 12 | F1–F4, F7 — Hesap güvenliği ve KVKK | `v1.12.0` | ✅ tamamlandı | — |
| 13 | H1–H9 — Arayüz ve veri düzeltmeleri (firma no, filtreler, menü) | `v1.13.0` | ✅ tamamlandı | — |
| 14 | T1–T8 — Ürün kataloğu, **stok**, paket, kampanya, fiyat motoru | `v1.14.0` | ✅ tamamlandı | — |
| 15 | S1–S6 — Sipariş, yönetici onayı, depo/sevkiyat | `v1.15.0` | ✅ tamamlandı | — |
| 16 | P1–P4 — Proje, destek kaydı, SSS | `v1.16.0` | ✅ tamamlandı | — |
| 17 | A1–A5 — Dosya/fotoğraf eki, ziyaret ve konum doğrulama | `v1.17.0` | ✅ tamamlandı | — |
| 18 | R1–R5 — Rapor merkezi, mali raporlar, firma dosyası PDF | `v1.18.0` | ✅ tamamlandı | — |
| 19 | N1–N4 — Anket tanımı, gönderim, yanıt toplama, rapor | `v1.19.0` | ✅ tamamlandı | — |
| 20 | U1–U4 — Birleşik çalışma ekranı (komut paleti, yan panel) | `v1.20.0` | ✅ tamamlandı | |
| 21 | G1–G3 — AI özellikleri (**en sona alındı**) | `v1.21.0` | ✅ tamamlandı | |

## Yeni Katılan İçin Hızlı Başlangıç

```bash
npm install
cp .env.example .env            # AUTH_SECRET ve DATABASE_URL'i ayarlayın

# PostgreSQL gerekir (Faz 2'den itibaren). Yerelde:
#   createdb gezegen_dev
# veya Docker ile:  docker compose up -d db

npm run db:migrate              # şemayı ve RLS politikalarını uygula
npm run db:seed                 # iki kiracılı demo veri
npm run dev                     # http://localhost:3000
```

Demo hesaplar (Faz 4'ten itibaren her rolden bir tane):

| Kiracı | Rol | Giriş |
|---|---|---|
| Gezegen Platform | Platform Yöneticisi (`/admin`) | `platform@gezegen.com` / `platform123` |
| Gezegen (800 firma) | Kuruluş Yöneticisi | `admin@gezegen.com` / `admin123` |
| Gezegen | Üye | `kullanici@gezegen.com` / `user123` |
| Gezegen | Salt Okunur | `okuyucu@gezegen.com` / `okuyucu123` |
| Anadolu (120 firma) | Kuruluş Yöneticisi | `admin@anadolu.com` / `anadolu123` |

İki kiracıyla girip listelerin ayrı olduğunu, farklı rollerle girip yetkilerin
değiştiğini görün — projenin iki temel güvenlik sözü bunlar.

Mimari ve kiracı katmanı kuralları: **`CLAUDE.md`**.

---

## Faz 1 — Çok Kiracılılık Temeli (A1, A2, A3) → `v1.1.0`

**Amaç:** Uygulamayı tek kiracılıdan çok kiracılıya taşımak. Bu fazdan sonra
veri, uygulama katmanında kiracı bazında izole olur.

### Çalışma paketleri

- [x] **A1 — Tenant veri modeli**
   - `Tenant` modeli: `id`, `ad`, `slug` (benzersiz), `durum` (aktif/askida/pasif),
     `createdAt`, `updatedAt`.
   - `User`, `Firma`, `YatirimDestegi`, `Egitim`, `Hizmet` modellerine
     `tenantId` + `tenant` ilişkisi (`onDelete: Cascade`).
   - `User.email` üzerindeki global `@unique` kaldırılır →
     `@@unique([tenantId, email])` (farklı kiracılarda aynı e-posta olabilir).
   - Tüm indeksler `tenantId` **ilk sütun** olacak şekilde yeniden yazılır:
     `@@index([tenantId, ad])`, `@@index([tenantId, durum])`, …
   - Migration + mevcut verinin tek bir varsayılan kiracıya taşınması.
   - `prisma/seed.ts` ve `prisma/bootstrap.ts` kiracı üretecek şekilde güncellenir.

- [x] **A2 — Oturumda kiracı bağlamı**
   - `SessionPayload`'a `tenantId` ve `tenantSlug` eklenir (`src/lib/session.ts`).
   - Giriş akışı kiracıyı çözer (`src/app/login/actions.ts`).
   - **Merkezî kiracı kapsamlı veri erişimi:** `src/lib/tenant-db.ts` —
     oturumdaki `tenantId`'yi otomatik uygulayan tek giriş noktası. Sayfalar ve
     action'lar `prisma`'yı doğrudan çağırmayı bırakır.
   - Kiracısı askıya alınmış kullanıcı girişte reddedilir.

- [x] **A3 — Sahiplik doğrulaması**
   - Her `update` / `delete` işlemi, kaydın oturumun kiracısına ait olduğunu
     doğrular; aksi halde 404 döner (403 değil — kaydın varlığını sızdırmamak için).
   - Kapsanan dosyalar: `firmalar/actions.ts`, `yatirim-destekleri/actions.ts`,
     `egitimler/actions.ts`, `hizmetler/actions.ts`.
   - Detay sayfaları (`firmalar/[id]`) kiracı dışı ID için 404 verir.
   - **Bu paket, bugün mevcut olan gerçek bir yetkilendirme açığını kapatır:**
     şu an giriş yapmış herhangi bir kullanıcı, ID'sini bildiği herhangi bir
     kaydı düzenleyebiliyor.

### Kabul kriterleri — hepsi sağlandı ✅
- İki kiracıyla doğrulama: hiçbir listede, detayda, raporda veya grafikte
  diğer kiracının verisi görünmez. → o dönemde `kontrol:izolasyon` betiğiyle
  (19/19); Faz 3'te Vitest paketine taşındı,
  `npm run kontrol:e2e` (14/14)
- Kiracı dışı kayıt ID'si ile doğrudan URL denemesi 404 sayfası gösterir ve
  hiçbir veri sızdırmaz.
- Uygulamada `prisma` doğrudan yalnızca iki yerde kullanılır: kiracı katmanının
  kendisi ve giriş action'ı (oturum öncesi kiracı henüz belli değildir).
- Mevcut verili veritabanında migration testi: veri kaybı yok, tüm kayıtlar
  varsayılan kiracıya bağlandı.

### Uygulama notları
- **Merkezî katman:** `src/lib/tenant-db.ts` bir Prisma client extension'ıdır.
  Okuma/sayma/gruplama sorgularına `where.tenantId`, oluşturmaya `data.tenantId`
  ekler. `findUnique`, `update`, `delete`, `upsert` **engellenir** — bu işlemler
  yalnızca birincil anahtarla çalıştığı için kiracı filtresi uygulanamaz.
  Yerlerine `findFirst`, `updateMany`, `deleteMany` kullanılır.
- **Giriş akışı:** Aynı e-posta farklı kiracılarda bulunabilir
  (`@@unique([tenantId, email])`). Birden fazla eşleşme olursa giriş ekranı
  kiracı kodu ister; tek eşleşmede kullanıcı bu alanı hiç görmez.
- **Bilinen davranış:** Kiracı dışı bir sayfa istendiğinde 404 *içeriği*
  gösterilir ancak HTTP durumu 200 döner. Sebebi Next.js'in akışlı render'ıdır
  (`(app)/loading.tsx` bir Suspense sınırı oluşturur, başlıklar gövdeden önce
  gönderilir). Veri sızıntısı yoktur. Durum kodunun da 404 olması istenirse
  ayrı bir iş kalemi olarak ele alınmalıdır.

### Riskler — kapatıldı
- Migration mevcut veriyi korur: önce varsayılan kiracı oluşturulur, sonra tüm
  kayıtlar ona bağlanır. Tek kiracılı kurulum migration sonrası aynı çalışır.
- Atlanmış tek bir sorgu = veri sızıntısı riski, merkezî katmanla kapatıldı.

---

## Faz 2 — PostgreSQL + Row-Level Security (A4) → `v1.2.0`

**Amaç:** İzolasyonu veritabanı katmanında da zorunlu kılmak. Uygulama
katmanında bir hata olsa bile veritabanı yanlış satırı döndürmez
(savunma derinliği).

### Çalışma paketleri
- [x] **Postgres'e geçiş**
   - `datasource` provider → `postgresql`; SQLite'a özgü kalıpların gözden geçirilmesi.
   - `docker-compose.yml`'e Postgres servisi + kalıcı volume.
   - Migration'ların Postgres için yeniden üretilmesi.
   - Mevcut SQLite verisinin taşınması için tek seferlik betik.
   - `deploy.sh` ve `.env.example` güncellemesi; yedekleme (`pg_dump`) notu.
- [x] **Row-Level Security**
   - Tenant içeren her tabloda `ENABLE ROW LEVEL SECURITY`.
   - `USING (tenant_id = current_setting('app.tenant_id')::text)` politikaları.
   - Bağlantı başına `SET LOCAL app.tenant_id` uygulayan Prisma sarmalayıcısı.
   - Uygulama rolünün `BYPASSRLS` yetkisi **olmadığının** doğrulanması.
   - Admin/sistem işlemleri için ayrı, denetlenen rol.

### Kabul kriterleri — hepsi sağlandı ✅
- Uygulama Postgres üzerinde eksiksiz çalışır; `npm run dogrula` → **70/70**.
- `app.tenant_id` ayarlanmadan yapılan sorgu **sıfır satır** döner — altı tablo
  için ayrı ayrı ve ham SQL ile de doğrulandı.
- SQLite → PostgreSQL taşıma betiği gerçek v1.1.x formatındaki bir veritabanıyla
  test edildi: tüm kayıtlar, ondalık tutarlar, tarihler ve ilişkiler korundu.
- Performans: RLS sarmalamasıyla sorgu başına ~2 ms (ölçüldü).

### Uygulama notları
- **Üç erişim bağlamı:** `app.tenant_id` (normal trafik), `app.kimlik_dogrulama`
  (yalnızca giriş, User+Tenant salt okuma), `app.yonetim` (kurulum betikleri).
  Hiçbiri ayarlanmazsa veritabanı sıfır satır döndürür — "bağlam yoksa veri yok"
  varsayılan davranıştır.
- **`FORCE ROW LEVEL SECURITY`** kullanıldı: tablo sahibi normalde RLS'ten
  muaftır, uygulama rolü tabloların sahibi olduğu için bu olmadan politikalar
  hiçbir işe yaramazdı.
- **Her sorgu bir işlem içinde** çalışır (`set_config(..., true)` + asıl sorgu).
  Bağlantı havuzundan gelen bir bağlantının bir sonraki isteğe bağlam
  sızdırmaması için gereklidir.
- **SQLite migration'ları** `prisma/_sqlite-arsiv/` altına taşındı; Prisma
  migration'ları veritabanına özgüdür, Postgres'te uygulanamazlar.

### Canlıya alma
Bu bir motor değişikliğidir, sıradan bir sürüm alma değil. Adım adım süreç ve
geri dönüş yolu: **`docs/DEPLOY.md` → "v1.2.0 — PostgreSQL'e geçiş"**.

---

## Faz 3 — Çapraz Kiracı Sızıntı Testleri (A5) → `v1.3.0`

**Amaç:** İzolasyonun bir daha bozulamayacağını otomatik olarak kanıtlamak.

### Çalışma paketleri
- [x] **Test altyapısı** (seçilen listede yoktu ama A5 için zorunlu; bu faza dahil edildi)
   - Vitest + test veritabanı (izole Postgres şeması), fixture'lar, CI betiği.
- [x] **İzolasyon test paketi**
   - İki kiracı + kullanıcıları üreten fixture.
   - Her modül için: liste, detay, oluştur, güncelle, sil → kiracı dışı erişim 404.
   - Rapor ve dashboard toplamlarının kiracı dışı veriyi saymadığı testi.
   - RLS testi: uygulama katmanı atlanarak yapılan sorgu boş döner.
   - Oturum kurcalama testi: JWT'deki `tenantId` değiştirilirse erişim reddedilir.
- [x] **Regresyon koruması**
   - Yeni sorguların tenant filtresi olmadan eklenmesini yakalayan kontrol.

### Kabul kriterleri — hepsi sağlandı ✅
- **35 test**, 3 dosyada, ~4 saniyede koşuyor: izolasyon (17), RLS (10),
  regresyon (8). `npm test`
- **Mutasyon kanıtı** — testlerin gerçekten koruduğu iki kasıtlı hatayla
  doğrulandı:
  1. RLS bağlamı uygulanmadığında → izolasyon ve RLS testleri kırmızı
  2. Bir sayfa kiracı katmanını atladığında → regresyon testleri kırmızı
- **CI** (`.github/workflows/ci.yml`) her push ve pull request'te Postgres
  servisiyle tip kontrolü + derleme + testleri koşuyor.
- `npm run dogrula` toplam **74 kontrol** ile geçiyor.

### Uygulama notları
- Testler ayrı bir PostgreSQL şeması (`test`) kullanır, her çalıştırmada
  sıfırdan kurulur ve sonunda silinir. Geliştirme şemanıza dokunmaz.
- Her test dosyası **kendi kiracı çiftini** rastgele slug ile üretir; dosyalar
  aynı veritabanını paylaşsa bile birbirlerini etkilemez.
- **Yaşanan tuzak:** `vitest.config.ts` içindeki `test.env` ayarı globalSetup'a
  uygulanmaz — globalSetup ana süreçte, ayar devreye girmeden önce çalışır. İlk
  denemede migration'lar test şeması yerine geliştirme şemasına uygulandı.
  `tests/kurulum.ts` artık test URL'ini kendisi türetiyor ve şemanın gerçekten
  kurulduğunu doğruluyor.
- `scripts/izolasyon-kontrol.ts` kaldırıldı; yerini Vitest paketi aldı. HTTP ve
  tarayıcı kontrolleri (çalışan sunucu gerektirdikleri için) betik olarak kaldı.

---

## Faz 4 — Yetkilendirme ve Denetim (A6, A7, A8) → `v1.4.0`

- [x] **A6 — RBAC**
   - Roller: `platform_admin` (kiracılar üstü), `tenant_admin`, `uye`, `salt_okunur`.
   - `Role` / `Permission` modelleri; modül × işlem (görüntüle/oluştur/düzenle/sil) matrisi.
   - Sunucu tarafı zorlama (`requirePermission`) + arayüzde yetkisiz öğelerin gizlenmesi.
   - **Yetki kontrolü her zaman sunucuda; arayüzdeki gizleme yalnızca kolaylık.**
- [x] **A7 — Kullanıcı grupları**
   - `Group` modeli, grup↔izin ve kullanıcı↔grup ilişkileri.
   - Etkin izin = rol izinleri ∪ grup izinleri.
   - Toplu atama arayüzü.
- [x] **A8 — Denetim günlüğü**
   - `AuditLog` modeli: kiracı, kullanıcı, işlem, varlık türü/ID, eski→yeni değer, IP, zaman.
   - Merkezî veri katmanına bağlanır (her yazma otomatik loglanır).
   - Kiracı yöneticisi için filtrelenebilir görüntüleme ekranı.
   - Günlükler uygulama üzerinden **değiştirilemez ve silinemez**.

### Kabul kriterleri — hepsi sağlandı ✅
- Yetki kontrolü **her yazma action'ında** var; regresyon testi bunu her
  çalıştırmada denetler (yazma sayısı ≥ yetki kontrolü sayısı).
- Her yazma işlemi denetim günlüğüne eski/yeni değeriyle düşüyor.
- **Denetim günlüğü değiştirilemez:** RLS'te kiracı için yalnızca SELECT ve
  INSERT politikası var. Test, güncelleme ve silme denemelerinin 0 satır
  etkilediğini kanıtlıyor.
- Gerçek tarayıcıda üç rolle doğrulandı (32 kontrol): yönetici yönetim
  ekranlarını görüyor, üye menüde görmüyor **ve doğrudan URL ile de giremiyor**,
  salt okunur kullanıcı yazma düğmelerini görmüyor.
- `npm run dogrula` toplam **296 kontrol** ile geçiyor (171 birim test dahil).

### Uygulama notları
- **Dört rol:** `platform_admin`, `tenant_admin`, `uye`, `salt_okunur`.
  Matris `src/lib/yetki-tanimlar.ts` içinde; kontrol `src/lib/yetki.ts` içinde
  (server-only). Ayrı tutulmalarının sebebi tanımların istemci bileşenleri ve
  testlerce de kullanılabilmesi.
- **Etkin izin = rol izinleri ∪ grup izinleri.** Grup yalnızca yetki *ekler*,
  hiçbir zaman kısıtlamaz. `cache()` ile istek başına bir kez hesaplanır.
- **Eski roller taşındı:** migration `admin` → `tenant_admin`, `user` → `uye`.
  `rolNormalize` ayrıca bir emniyet kemeri tutar; taşınmamış bir kayıt yüzünden
  kimse yetkisiz kalmasın diye.
- **Genel Bakış bölüm bölüm yetkilendirildi:** birden çok modülü topladığı için
  tek kapı yerine her bölüm ayrı kontrol edilir; yetkisiz modülün sorgusu hiç
  çalıştırılmaz. (Bu açığı Faz 4 regresyon testi yakaladı.)
- **Yetkisiz erişimde 404 değil, açık mesaj:** kiracı dışı erişimde 404
  gösteriyoruz (kaydın varlığını sızdırmamak için), ama aynı kiracı içinde
  yetkisizlik farklı — kullanıcı zaten kuruluşun parçası, ona ne olduğunu
  söylemek doğru (`/yetkisiz`).

---

## Faz 5 — Admin Panel (B1–B7) → `v1.5.0` ✅

Yalnızca `platform_admin` erişimli `/admin` alanı.

- [x] **B1 — Müşteri yönetimi:** tenant ekle/düzenle/askıya al/sil, durum, iletişim bilgileri.
- [x] **B2 — Kullanıcı yönetimi:** tenant içi kullanıcı ekle, rol/grup ata, pasifleştir, şifre sıfırla.
- [x] **B3 — Davet akışı:** süreli tek kullanımlık token, kullanıcı kendi şifresini belirler. (E-posta gönderimi Faz 8/D1'de; şu an bağlantı panelde gösteriliyor.)
- [x] **B4 — Paket ve limitler:** `Plan` modeli; kullanıcı/firma limiti, modül açma-kapama; limit aşımında engelleme.
- [x] **B5 — Impersonation:** "kiracı olarak görüntüle"; oturumda `impersonatorId`/`impersonatorEmail` taşınır, işlemler denetim günlüğüne gerçek yönetici kimliğiyle yazılır, arayüzde kalıcı uyarı bandı ve tek tıkla çıkış.
- [x] **B6 — Platform metrikleri:** kuruluş sayısı (duruma göre), toplam kullanıcı ve firma, paket dağılımı, son eklenen kuruluşlar.
- [x] **B7 — Tenant markalama:** logo ve ana renk arayüzde uygulanır; alt alan adı alanı kaydedilir. (Alt alan adının DNS/host çözümlemesi dağıtım işidir, uygulama tarafı hazır.)

### Nasıl kuruldu

**Platform katmanı — tek kapı.** Kiracılar ötesi erişimin tamamı
`src/lib/platform-db.ts` içinden geçer; `getPlatformDb()` her çağrıda oturumun
`platform_admin` olduğunu doğrular. Bu, kiracı izolasyonunun **bilinçli**
istisnasıdır ve regresyon testi (`tests/regresyon.test.ts`) yönetim bağlamının
başka hiçbir dosyada kullanılmadığını sürekli denetler.

**Davet akışı — ikinci dar kapı.** Davet edilen kişinin henüz oturumu yoktur;
bu yüzden `src/lib/davet-db.ts` ayrı bir kapı olarak durur. Kiracı, e-posta ve
rol istemciden gelmez, davet kaydından okunur. Token'ın kendisi veritabanına
yazılmaz — yalnızca sha256 özeti saklanır.

**Paket kısıtı izin hesabının içinde.** Paketi kapalı olan modülün izinleri
`etkinIzinler()` içinde düşürülür. Böylece kısıt yalnızca menüyü gizlemekle
kalmaz; mevcut ve gelecekteki bütün sayfa/action korumalarında otomatik
uygulanır. Firma limiti kayıt oluşturmadan önce sunucuda kontrol edilir.

### Kabul kriterleri
- [x] `platform_admin` olmayan bir kullanıcı `/admin` altındaki hiçbir yola erişemez (sunucu tarafı; gerçek tarayıcıyla doğrulandı).
- [x] Impersonation ile yapılan her işlem, gerçek yönetici kimliğiyle loglanır.
- [x] Paket limiti aşıldığında yeni kullanıcı daveti ve yeni firma engellenir.
- [x] Geçersiz davet bağlantısı hiçbir kuruluşun varlığını sızdırmaz.

---

## Faz 6 — Satış Çekirdeği (C1, C2, C3) → `v1.6.0` ✅

- [x] **C1 — Kişi (Contact):** firma başına çok kişi; ad, unvan, telefon, e-posta, birincil kişi işareti. Mevcut `Firma.yetkiliAd` verisi migration'da kişi kaydına taşındı.
- [x] **C2 — Fırsat/Anlaşma (Deal):** başlık, firma, kişi, tutar, para birimi, aşama, kapanış tarihi, olasılık, sorumlu kullanıcı, kazanıldı/kaybedildi + sebep. Aşamalar kiracı bazında özelleştirilebilir.
- [x] **C3 — Kanban satış hattı:** sürükle-bırak aşama değiştirme, aşama bazlı toplam ve beklenen ciro, arama/sorumlu/durum filtreleri, liste görünümü.

### Nasıl kuruldu

**Aşama ile durum ayrıdır.** `Firsat.asamaId` hattaki yeri, `Firsat.durum`
(`acik` / `kazanildi` / `kaybedildi`) sonucu anlatır. Kapanan fırsat son
aşamasında kalır ama kanban'ın açık sütunlarından düşer; kapananlar liste
görünümünde durum filtresiyle görülür. Beklenen ciro *tutar × olasılık* ile
hesaplanır; kazanılan fırsatın olasılığı %100'e, kaybedilenin %0'a çekilir.

**Aşamalar kiracıya özeldir.** Her kuruluş kendi satış sürecini kurar.
Hattın biçimi kuruluş çapında bir karar olduğu için `firsat.asama` izni
gerekir (varsayılan: kuruluş yöneticisi); üye fırsat düzenleyebilir ama hattı
değiştiremez. İzin anahtarı bilinçli olarak `firsat.` ön ekiyle tanımlandı —
paket "firsat" modülünü kapattığında aşama yönetimi de kendiliğinden düşer.

**Sürükle-bırak için kütüphane eklenmedi.** Tarayıcının kendi HTML5
drag-and-drop API'si kullanıldı. Dokunmatik cihazlarda sürükleme güvenilir
olmadığı için her kartta ayrıca bir aşama seçici var; sürükleme bir
kolaylıktır, tek yol değildir. Aşama değişikliği sunucuda ayrı bir action ile
yapılır ve orada yetki + sahiplik yeniden doğrulanır.

**Migration veri taşıdı.** Var olan her kiracıya çalışabilir bir hat
(Yeni → İletişim → Teklif → Müzakere → Sonuç) kuruldu, `Firma.yetkiliAd`
değerleri birincil kişi olarak `Kisi` tablosuna aktarıldı ve mevcut paketlere
yeni modüller eklendi (aksi halde paketli kiracılar Kişiler/Fırsatlar
modüllerini yitirirdi). `Firma.yetkiliAd` sütunu **silinmedi**: veriyi
taşırken kaynağı yerinde bırakmak, taşımanın yanlış gitmesi hâlinde geri
dönüşü mümkün kılar.

### Kabul kriterleri
- [x] Kişi, aşama ve fırsat tablolarının üçü de RLS ile korunuyor; regresyon testi tablo listesini artık **şemadan türetiyor**, yani yeni bir model RLS'siz kalamaz.
- [x] Bir kiracı diğerinin kişisini, aşamasını veya fırsatını göremez, değiştiremez; başka kiracının aşamasına fırsat bağlayamaz.
- [x] Kişi silinince fırsat silinmez, yalnızca muhatap bağlantısı boşalır.
- [x] İçinde fırsat olan aşama silinemez (hem uygulamada hem veritabanında).
- [x] Salt okunur kullanıcı satış hattını görür ama "Yeni Fırsat" düğmesini görmez; üye aşama yönetimine URL yazarak da giremez.

---

## Faz 7 — Satış Derinleştirme (C4–C7) → `v1.7.0` ✅

- [x] **C4 — Aktivite ve görev:** arama/toplantı/e-posta/not/görev; atama, son tarih, tamamlandı; "Bugün" görünümü.
- [x] **C5 — Lead yönetimi:** aday kayıt, kaynak, huni durumu; tek işlemle firma + kişi (+ fırsat) hâline dönüştürme.
- [x] **C6 — Timeline:** firma altında tüm modüllerin kronolojik birleşik akışı.
- [x] **C7 — Teklif:** kalemler, sunucuda hesaplanan tutarlar, revizyon zinciri, durum takibi.

### Nasıl kuruldu

**Aktivite tek modeldir.** Not ile görev arasındaki fark ayrı bir tablo değil,
`sonTarih` alanının dolu olmasıdır. Bu tercih timeline'ı (C6) tek sorguyla
kurulabilir kılar ve "arama kaydı" ile "yapılacak arama" arasında yapay bir
duvar örmez. Aktivite sayfasının varsayılan sekmesi **Bugün**'dür ve
varsayılan süzgeç oturum sahibidir — sabah açılınca ilk görülmesi gereken
budur.

**Dönüşen aday silinmez.** Lead firma + kişi (+ fırsat) hâline geldiğinde
kaydı yerinde kalır; nereye dönüştüğü `donusen*` alanlarında saklanır.
"Hangi kanal ne kadar iş getirdi" sorusunun yanıtı bu bağa dayanır. Dönüşüm
paket firma limitine de tabidir — limitin arka kapısı olmamalıdır.

**Teklif değiştirilmez, revize edilir.** "Revize et" mevcut sürümü `revizyon`
durumuna alıp dondurur ve kalemleriyle birlikte yeni bir taslak kopyalar
(`ustTeklifId` ile zincire bağlı). Gönderilmiş bir teklifin üzerine yazmak
"hangi rakamı görüştük?" sorusunu yanıtsız bırakırdı. Dondurulmuş sürüm
arayüzde salt okunurdur.

**Tutar hesabı sunucudadır.** Ara toplam, indirim, KDV ve genel toplam
kalemlerden yeniden hesaplanıp saklanır; formdaki toplam yalnızca
önizlemedir. Böylece hem istemciden gelen rakama güvenilmez, hem de KDV oranı
sonradan değişse bile eski teklifin rakamları olduğu gibi kalır.

**Timeline izin süzgecinden geçer.** İzni olmayan modül hiç sorgulanmaz —
paketi kapalı bir modülün verisi akış üzerinden sızmamalıdır.

### Kabul kriterleri
- [x] Dört yeni tablo (Aktivite, Lead, Teklif, TeklifKalemi) RLS ile korunuyor; şemadan türeyen regresyon testi bunu doğruluyor.
- [x] Bir kiracı diğerinin aktivitesini, adayını, teklifini veya teklif kalemini göremez.
- [x] Aktivite bağlamı (kişi/fırsat) seçilen firmaya ait olmak zorunda; başka firmanın kaydı bağlanamaz.
- [x] Dönüşen firma silinse bile aday kaydı ayakta kalır; fırsat silinse bile teklif kalır.
- [x] Teklif numarası kiracı içinde benzersiz, kiracılar arasında çakışabilir.
- [x] Revizyon sonrası eski sürümün rakamı değişmez.
- [x] Salt okunur kullanıcı üç modülü de görür ama "Yeni Aday", "Dönüştür" ve "Yeni Teklif" düğmelerini görmez.

---

## Faz 8 — Otomasyon ve İletişim (D1–D5) → `v1.8.0` ✅

- [x] **D1 — E-posta bildirimleri:** kiracı bazlı SMTP yapılandırması (parolalar şifreli), gönderim kuyruğu, kullanıcı bazlı kanal tercihi.
- [x] **D2 — İş akışı otomasyonu:** tetikleyici → eylem kuralları, kiracı bazlı tanım, zamanlanmış çalıştırma, çalışma günlüğü.
- [x] **D3 — E-posta entegrasyonu:** IMAP ile gelen kutusu taraması; gönderen adresi kişiyle eşleşen iletiler firmanın zaman akışına düşer.
- [x] **D4 — Takvim:** aylık ızgara görünümü, kişisel/ekip süzgeci, `.ics` dışa aktarım.
- [x] **D5 — Bildirim merkezi:** uygulama içi bildirim listesi, okundu işaretleme, üst çubukta okunmamış rozeti.

### Nasıl kuruldu

**Kurallar zamanlanmış çalışır, olay anında değil.** Buradaki tetikleyicilerin
çoğu bir olay değil, zamanın geçmesiyle oluşan bir DURUMDUR: "3 gündür
hareketsiz fırsat", "son tarihi yaklaşan görev", "geçerliliği dolan teklif".
Bunlar kimsenin bir düğmeye basmasıyla oluşmaz; olay anında çalışan bir kural
bunları asla yakalayamazdı. Çalıştırma `/api/gorevler` uç noktasından yapılır
ve **aynı kayıt için aynı uyarı iki kez gönderilmez**.

**Üçüncü dar kapı.** Faz 5'te iki bilinçli istisna vardı (admin panel, davet
kabulü); zamanlanmış işler üçüncüsüdür, çünkü çalıştıran bir OTURUM yoktur.
Kapsam dar tutuldu: yönetim bağlamı yalnızca **kiracı listesini** okur, her
kiracının işi kendi bağlamında yapılır. Regresyon testi bunu ayrıca denetler —
`zamanlanmis.ts` içinde yönetim bağlamıyla iş verisine dokunulamaz.

**Uç nokta anahtar tanımsızsa KAPALIDIR.** "Tanımsızsa serbest" davranışı
üretimde yanlışlıkla herkese açık bir tetikleyici bırakırdı. Anahtar başlıkta
taşınır, sorgu dizesinde değil — sorgu dizesi erişim günlüklerine düz metin
yazılır.

**Posta parolaları şifreli saklanır** (AES-256-GCM, `src/lib/sifreleme.ts`).
Veritabanı yedeğini eline geçiren biri müşterinin posta kutusuna erişememeli.
Anahtar `AUTH_SECRET`'tan türetilir; bunun sonucu `docs/DEPLOY.md` içinde de
yazılıdır: **AUTH_SECRET değişirse kayıtlı posta parolaları çözülemez** (uygulama
çökmez, ayar "yeniden girin" durumuna düşer).

**Gönderim kuyruktan yapılır.** Bildirim yazılır, çalıştırıcı gönderir. Posta
sunucusu yavaşsa kullanıcının işlemi beklemez; başarısız gönderim üç kez
denenir ve her denemenin izi kalır.

**İletinin gövdesi saklanmaz.** IMAP senkronu yalnızca kim, ne zaman, hangi
konu bilgisini tutar. Amaç posta istemcisi olmak değil, yazışmanın CRM'de izini
bırakmak; müşteri yazışmasının tamamını kopyalamak gereksiz bir yük olurdu.

**Takvimin kendi kaydı yoktur.** Gösterilen her şey zaten var olan kayıtların
tarihli hâlidir. Ayrı bir "etkinlik" tablosu, aynı bilginin iki yerde tutulması
demek olurdu. `.ics` dışa aktarımı oturum gerektirir — token'lı herkese açık
akış bilinçli olarak yapılmadı, çünkü sızan bir bağlantı müşteri verisini
kimlik doğrulaması olmadan okunabilir kılardı.

### Kabul kriterleri
- [x] Yedi yeni tablo da RLS ile korunuyor; şemadan türeyen regresyon testi doğruluyor.
- [x] Posta parolası veritabanında açık durmuyor; kurcalanan şifreli metin çözülmüyor (GCM bütünlük).
- [x] Bir kiracı diğerinin bildirimini, e-posta kuyruğunu ya da iş akışı kuralını göremiyor.
- [x] Zamanlanmış iş uç noktası anahtarsız istekte 401 döndürüyor.
- [x] Üye otomasyon ve e-posta ayarlarına URL yazarak da giremiyor.
- [x] SMTP tanımlı değilken sistem sessizce yalnızca uygulama içi bildirime düşüyor.

---

## Faz 9 — Veri Giriş/Çıkış (E1, E2, E5) → `v1.9.0` ✅

- [x] **E1 — Excel/CSV dışa aktarım:** dokuz liste için, aktif filtreye saygılı; biçimli `.xlsx` ve Excel uyumlu `.csv`.
- [x] **E2 — Excel/CSV içe aktarım:** dosya yükleme, otomatik + elle sütun eşleştirme, satır satır doğrulama, ön izleme ve hata raporu.
- [x] **E5 — PDF çıktı:** kiracı logosu ve ana rengiyle teklif belgesi.

### Nasıl kuruldu

**Dışa aktarım tek kapıdan geçer** (`src/lib/disa-aktar.ts`). Sorgular kiracı
katmanından geçtiği için sınır aşılamaz; uç nokta veri kümesinin KENDİ iznini
arar (firmalar → `firma.goruntule`) ve paket kısıtı `etkinIzinler()` içinde
zaten uygulandığından kapalı bir modül dışa aktarılamaz. Tanımlı olmayan bir
küme adı çalıştırılamaz — sütun listesi tek yerde durur, bir alanı
yanlışlıkla dışa açmak zorlaşır. Her dışa aktarım denetim günlüğüne düşer:
bir kullanıcının bütün müşteri listesini indirmesi sonradan görülebilmelidir.

**CSV'nin ayrıntıları Türkçe için ayarlandı.** Dosya BOM ile başlar (yoksa
Excel Windows'ta yanlış kod sayfası seçer ve Türkçe karakterler bozulur) ve
ayırıcı noktalı virgüldür (Türkçe Excel'in beklediği; virgül kullanmak
sütunları tek hücrede birleştirir). Okurken ise ayırıcı otomatik seçilir —
başka sistemlerden gelen virgüllü dosyalar da kabul edilir.

**İçe aktarım üç adımdır, ikisi yazmadan önce gelir.** Dosya okunur →
sütunlar eşleştirilir (Türkçe karakter ve büyük/küçük harf farkı yok sayılarak
otomatik önerilir, kullanıcı düzeltir) → ön izlemede her satır doğrulanır ve
kullanıcı onaylar. Doğrulamasız bir içe aktarım, bir kuruluşun verisini tek
hamlede çöpe çevirebilir. **Hatalı satırlar atlanır**, geri kalanlar aktarılır
— bir satır yüzünden 500 satırlık aktarım düşmemelidir.

**Aynı adlı firma iki kez açılmaz.** Alt kayıt (kişi, yatırım, eğitim, hizmet)
içe aktarımında firma adı mevcut kayda bağlanır; aksi halde her aktarımda
firma kopyaları üretilirdi. Yeni firma açmak paket limitine tabidir — içe
aktarım limitin arka kapısı değildir.

**PDF, tarayıcının yazdırma motoruyla üretilir.** Sunucuya PDF kütüphanesi
eklenmedi ve bu bilinçli: PDFKit/react-pdf Türkçe karakter için gömülü TTF
font ister (aksi halde ş/ğ/İ/ı bozulur), headless tarayıcı ise üretim imajına
~300 MB Chromium ekler. Tarayıcının çıktısı zaten gerçek bir PDF'tir,
Türkçe kusursuzdur ve kullanıcı sayfa boyutunu kendi seçer. Sayfa
`@media print` ile hazırlandı; kabuk ve düğmeler baskıda görünmez.

**Kütüphane seçimi güvenlik gerekçesiyle değişti.** İlk tercih `xlsx`
(SheetJS) idi; npm'deki 0.18.5 sürümünün prototype pollution ve ReDoS
uyarıları var ve içe aktarım tam olarak o yola (kullanıcının yüklediği dosya)
veri veriyor. `exceljs`'e geçildi.

### Kabul kriterleri
- [x] Dışa aktarım kiracı sınırını aşamıyor; izni olmayan küme 403, tanımsız küme 400 dönüyor.
- [x] Oturumsuz dışa aktarım isteği girişe yönlendiriliyor.
- [x] Üretilen `.xlsx` geçerli bir ZIP (PK imzası), `.csv` BOM'lu ve noktalı virgüllü.
- [x] CSV ayrıştırıcı tırnak içindeki ayırıcıyı, satır sonunu ve kaçırılmış çift tırnağı doğru okuyor.
- [x] Zorunlu alanı boş ve sayı alanı metin olan satırlar ön izlemede hata olarak işaretleniyor, yazılmıyor.
- [x] İçe aktarım listesi kullanıcının oluşturma iznine göre süzülüyor (grup izniyle gelen kümeler dahil).
- [x] Teklif PDF'i kiracı logosu ve ana rengiyle çıkıyor.

---

## Faz 10 — Kişiselleştirme ve Süreklilik (E3, E4, E7) → `v1.10.0` ✅

- [x] **E3 — Özelleştirilebilir dashboard:** kart seçimi, sıralama, kullanıcı bazlı kayıt.
- [x] **E4 — Gelişmiş filtre + kayıtlı görünümler:** çoklu kriter, kaydet/paylaş, varsayılan görünüm.
- [x] **E7 — Yedekleme/geri yükleme:** kiracı bazlı yedek alma ve geri yükleme, zamanlanmış otomatik yedek.

### Nasıl kuruldu

**Pano kartları kayıt defterinden gelir** (`src/lib/pano-tanimlar.ts`).
11 kart (6 sayaç, 2 grafik, 3 liste) tek listede tanımlıdır ve her kartın
kendi izin anahtarı vardır: izni olmayan kart, tercih edilmiş olsa bile
render EDİLMEZ ve **sorgusu hiç çalıştırılmaz** — kişiselleştirme, yetki
katmanının etrafından dolaşan bir yol değildir. Faz 10 ile gelen üç yeni
kart (fırsat cirosu, bugünkü görevler sayacı ve listesi) bilinçli olarak
varsayılan düzenin DIŞINDA bırakıldı: yükseltme kimsenin panosunu
değiştirmez, yeni kartlar isteyen kullanıcı tarafından açılır. Tercih
`PanoTercihi` tablosunda kullanıcı başına tek satırdır; bilinmeyen kart
anahtarları (kaldırılmış bir karttan kalma) okurken sessizce ayıklanır.

**Görünüm = adlandırılmış querystring** (`KayitliGorunum.sorgu`). Listeler
zaten URL parametreleriyle filtrelendiği için görünümün gövdesi ham bir
querystring'dir; beş liste (firmalar, kişiler, fırsatlar, adaylar,
teklifler) için ayrı şema gerekmez ve dışa aktarım aynı parametreleri
kullandığından kayıtlı görünümler orada da kendiliğinden geçerlidir.
`sorguTemizle` kaydederken `g`/`sayfa` anahtarlarını (bayat sayfa numarası
taşınmasın), biçimsiz anahtarları (`__proto__` dahil) ve boş değerleri atar.
Varsayılan görünüm liste PARAMETRESIZ açılınca uygulanır ve yönlendirilen
adres `g=1` işareti taşır — döngü imkânsızdır, "Tümü" bağlantısı her zaman
süzgeçsiz listeye döner. Paylaşılan görünüm kiracı İÇİDİR; komşu kiracıya
sızmadığını test kanıtlar.

**Geri yükleme EKLEYİCİDİR, geri alma değildir.** Yedek dosyası kuruluşun
iş verisini (11 model, FK sırasıyla) gzip'li JSON olarak saklar; geri
yükleme `createMany({ skipDuplicates: true })` ile yalnızca var olmayan
kayıtları ekler, mevcut veriye asla dokunmaz. "Yanlışlıkla sildim"
durumunun ilacıdır ve iki kez çalıştırmak zararsızdır (idempotent — test
bunu kanıtlar). Kullanıcılar ve denetim günlüğü bilinçli olarak kapsam
dışıdır: kimlik verisi yedek dosyasında gezmemeli, değiştirilemez günlük
ise "geri yüklenerek" yeniden yazılamamalıdır. Dosyada `tenantId` YOKTUR —
satırlar geri yüklerken oturumun kiracısıyla damgalanır, bir kiracının
yedeği başka kiracıya taşınamaz. Gece yedeği zamanlanmış çalıştırıcıya
bağlıdır (23 saat eşiği, son 7 yedek saklanır) ve ekran kullanıcıya
gerçeği söyler: **gerçek yedek, indirilip dışarıda tutulandır.**

**Yedek yönetimi `yedek.yonet` iznine bağlıdır** (varsayılan: yalnızca
kuruluş yöneticisi) çünkü yedek dosyası bütün listeleri tek dosyada
içerir; sıradan bir kullanıcının onu indirebilmesi, dışa aktarım izin
modelinin etrafından dolaşmak olurdu. `yedek` bilinçli olarak paket modülü
DEĞİLDİR: paket kısıtı hangi modüllerin kullanılacağını belirler, verinin
sürekliliği pazarlık konusu değildir.

**Kişisel tercih action'ları regresyon istisnasıdır.** Pano tercihi ve
görünüm kaydetme, kullanıcının KENDİ satırını yazar (sahiplik
`session.userId` ile); iş verisi yazmadıkları için yetki + denetim
zorunluluğu aranmaz. İstisna `tests/regresyon.test.ts` içinde adıyla ve
gerekçesiyle listelidir — listeye iş verisi yazan bir dosya eklenirse test,
gerekçesini sorar.

### Kabul kriterleri
- [x] Üç yeni tablo (PanoTercihi, KayitliGorunum, Yedek) RLS ile korunuyor; kiracı sınırı testli.
- [x] Varsayılan pano düzeni Faz 10 öncesiyle aynı — yeni kartlar opsiyonel, yükseltme kimsenin panosunu değiştirmiyor.
- [x] İzni olmayan kart tercih edilse bile görünmüyor ve sorgusu çalışmıyor.
- [x] Görünüm adı kullanıcı+liste başına tekil; paylaşılan görünüm komşu kiracıya sızmıyor.
- [x] Yedek al → sil → geri yükle: silinen kayıt dönüyor, mevcutlara dokunulmuyor, ikinci çalıştırma sıfır ekliyor.
- [x] Yedek dosyasında `tenantId` yok; bozuk dosya hata fırlatmadan reddediliyor.
- [x] Üye ve salt okunur `/yedekler`e URL ile de giremiyor; oturumsuz indirme girişe yönlendiriliyor.
- [x] `npm run dogrula` toplam **296 kontrol** ile geçiyor (171 birim test dahil).

---

## Faz 11 — Kiracıya Özel Alanlar (E6) → `v1.11.0` ✅

- [x] `OzelAlan` tanımı (varlık, ad, tip, seçenekler, zorunluluk, sıra) + `OzelAlanDeger`.
- [x] Formlarda, detaylarda, filtrede ve dışa aktarımda dinamik gösterim.
- [x] Kiracı yöneticisi için alan tanımlama ekranı (`/ozel-alanlar`).

### Nasıl kuruldu

**Değer her zaman String saklanır; tip yalnızca doğrulama ve gösterimdir.**
Bu, `constants.ts`'teki "enum yerine String" tercihinin devamıdır: yeni tip
eklemek migration gerektirmez. Beş tip vardır (metin, sayı, tarih, seçim,
onay); doğrulama/biçimleme saf katmandadır (`ozel-alan-tanimlar.ts`) ve
testler onu veritabanı olmadan sınar. Sayı TR virgülünü kabul eder, seçim
tipi istemciden gelen değeri TANIMDAKİ seçeneklerle karşılaştırır — istemci
listede olmayan bir seçenek yazamaz.

**Kayıt bağlantısı gerçek yabancı anahtardır.** `OzelAlanDeger` üç seçenekli
FK sütunu taşır (`firmaId` / `kisiId` / `firsatId`, tam biri dolu): kayıt
silinince değerleri veritabanı düzeyinde cascade ile temizlenir — "yetim
değer" sınıfı sorun baştan kapatılır ve test bunu kanıtlar. Bedeli, yeni bir
varlığa özel alan açmanın migration gerektirmesidir; bu bilinçli bir
takastır (`OZEL_ALAN_VARLIKLARI` başındaki yorumda yazılıdır). FK sütunlarının
indeksleri `tenantId` ile başlamaz — cascade silme o sütunla arar; istisna
regresyon testinde gerekçesiyle listelidir.

**Alan tanımlamak yönetim işi, değer yazmak varlık işidir.** `ozelalan.yonet`
izni yalnızca kuruluş yöneticisindedir (form biçimini kuruluş çapında
değiştirir); değer görmek/yazmak ise ilgili varlığın kendi izinlerine
tabidir — üye firma formunda alanları görür ve doldurur. `ozelalan` aynı
zamanda bir paket modülüdür: paket kapatırsa `alanlariGetir` boş döner ve
alanlar formlardan, filtrelerden ve dışa aktarımdan TEK noktadan kaybolur.
Migration, mevcut paketlere modülü ekler — yükseltme kimsenin kullandığı
şeyi kapatmaz; daraltmak platform sahibinin bilinçli kararıdır.

**Doğrulama kayıttan önce, sunucuda.** Action'lar önce `formdanDegerler` ile
özel alanları doğrular (zorunluluk dahil), sonra ana kaydı yazar, sonra
değerleri. Tanımda olmayan `oa_*` anahtarları sessizce yok sayılır. Özel
değerler denetim günlüğüne ana kaydın `yeni` yüküne gömülü düşer.

**Filtre ve görünümlerle kendiliğinden bütünleşir.** Seçim tipli firma
alanları firma listesinde filtre olur (`oa_<alanId>` parametresi); filtre
querystring'de yaşadığı için kayıtlı görünümler (Faz 10) ve dışa aktarım
(Faz 9) bunları kendiliğinden taşır — `sorguTemizle` yalnızca `oa_` biçimini
tanıyacak kadar genişletildi. Dışa aktarım dosyasına tanımlı alanlar sütun
olarak eklenir. Yedek kapsamına (Faz 10) iki tablo da girdi; sıra bilinçli:
tanım değerden önce yüklenir.

### Kabul kriterleri
- [x] İki yeni tablo RLS ile korunuyor; komşu kiracı alan tanımını göremiyor.
- [x] Aynı varlıkta aynı ad iki kez tanımlanamıyor; kayıt+alan başına tek değer.
- [x] Kayıt silinince değerleri, alan silinince bütün değerleri cascade ile gidiyor.
- [x] Üye `/ozel-alanlar`a giremiyor ama formda alanları görüyor; komşu kiracının formunda alanlar yok.
- [x] Seçim filtresi, kayıtlı görünüm ve dışa aktarım özel alanları taşıyor.
- [x] Yedek dosyasına tanım+değer giriyor, `tenantId` taşımıyor.
- [x] `npm run dogrula` toplam **324 kontrol** ile geçiyor (192 birim test dahil).

---

## Faz 12 — Hesap Güvenliği ve KVKK (F1–F4, F7) → `v1.12.0` ✅

- [x] **F1 — Şifre politikası + şifremi unuttum:** minimum karmaşıklık, süreli sıfırlama bağlantısı.
- [x] **F2 — İki faktörlü doğrulama:** TOTP, yedek kodlar, kiracı bazında zorunlu kılma seçeneği.
- [x] **F3 — Oturum yönetimi:** aktif oturum listesi, uzaktan sonlandırma, oturum süresi politikası.
- [x] **F4 — Hız sınırlama:** giriş denemesi sınırı, geçici kilit, brute-force koruması.
- [x] **F7 — KVKK:** veri saklama süresi, dışa aktarma, aydınlatma metni, açık rıza kaydı.

### Nasıl kuruldu

**DÖRDÜNCÜ DAR KAPI açıldı** (`src/lib/giris-guvenlik.ts`). Hız sınırlama
sayacı, hesap kilidi, şifre sıfırlama isteği ve oturum kaydı kimlik
doğrulanmadan ÖNCE yazılmak zorundadır; `app.kimlik_dogrulama` bağlamı ise
bilinçli olarak salt okumadır ve öyle kalmalıydı. Bu yüzden dar kapsamlı bir
`app.giris` bağlamı eklendi: yalnızca User, Tenant, Oturum, SifreSifirlama,
GirisDenemesi ve e-posta kuyruğuna INSERT görür — iş verisine (firma, teklif,
kişi) hiçbir erişimi yoktur. Regresyon testi `girisIstemcisi`nin bu dosyanın
dışında kullanılmadığını sürekli denetler.

**Şifre politikası TEK yerdedir** (`guvenlik-tanimlar.ts`) ve BÜTÜN belirleme
noktalarında aynıdır: davet kabulü, şifre sıfırlama, yönetici sıfırlaması,
kuruluş içi sıfırlama, kendi şifresini değiştirme. Bir kapıda gevşek kural,
politikanın tamamını hükümsüz kılar. Kural en az 10 karakter + büyük/küçük
harf + rakam; yaygın parolalar ve e-posta adının kendisi reddedilir. **Testin
yakaladığı gerçek bir hata:** küçük harf kontrolü şifreyi önce küçük harfe
çevirip bakıyordu, yani her şifreyi geçiriyordu.

**Şifre sıfırlama yanıtı HER ZAMAN aynıdır.** Hesap bulunsun ya da bulunmasın
kullanıcı "bağlantı gönderildi" mesajını görür; aksi halde form, kimlerin
müşteri olduğunu sorgulayan bir sayaca dönüşürdü. Token saklanmaz (sha256
özeti), 1 saat yaşar, tek kullanımlıktır ve tamamlandığında kullanıcının
BÜTÜN oturumları kapanır — sıfırlamanın sebebi çoğu zaman "hesabım ele
geçirildi" şüphesidir.

**Hız sınırlama iki katmanlıdır:** IP başına saatlik başarısız deneme sınırı
(hesap aranmadan önce; sözlük saldırısı hesabın varlığından bağımsız
durdurulmalı) ve hesap başına 5 denemede 15 dakikalık kilit. Kilit, şifre
DOĞRU olsa bile uygulanır — aksi halde doğru şifreyi bulan saldırganı
durdurmazdı.

**TOTP için kütüphane kurulmadı.** RFC 6238, HMAC-SHA1 üzerine kurulu otuz
satırlık bir algoritmadır ve Node'un kendi crypto modülü yeterlidir; kimlik
doğrulama yoluna denetlenmemiş bir bağımlılık sokmamak bilinçli bir tercihtir.
Uygulama RFC'nin resmî test vektörüyle sınanır. Sır AES-256-GCM ile ŞİFRELİ
saklanır, yedek kodlar bcrypt özeti olarak tutulur ve her biri bir kez işe
yarar. 2FA kurulumu, kullanıcı ilk kodu doğru girene kadar AÇILMAZ — aksi
halde uygulamayı kuramamış kullanıcı kendi hesabından kilitlenirdi. Kapatmak
için şifre istenir: ele geçirilen bir oturum ikinci faktörü söküp atamaz.

**JWT artık `jti` taşır ve sunucuda bir Oturum satırına karşılık gelir.** JWT
kendi başına iptal edilemez; "bu oturumu sonlandır" düğmesini mümkün kılan
şey budur. Kontrol middleware'de DEĞİL `getSession()` içinde yapılır —
middleware Edge çalışma zamanındadır ve Prisma oraya girmez; uygulamanın her
sayfası ve action'ı zaten `getSession`'dan geçer. Faz 12 öncesi çerezler jti
taşımaz ve doğal ömürleri dolana kadar geçerli sayılır (kullanıcıları toptan
çıkarmamak için bilinçli geçiş kararı).

**KVKK metni SÜRÜMLÜDÜR** ve rıza, metnin hangi sürümüne verildiğiyle
saklanır: metin değişince sürüm artar ve yeniden onay istenir. "Bir kere
onaylamıştı" savunması değişmiş bir metin için geçerli değildir. Saklama
temizliği zamanlanmış çalıştırıcıdadır; denetim günlüğü kiracı bağlamında
silinemediği için (Faz 4'ün değiştirilemezlik sözü) temizlik yönetim
bağlamında ve tenantId açıkça verilerek yapılır — "değiştirilemez" ile
"süresiz saklanır" aynı şey değildir. Veri kopyasına şifre özeti ve 2FA sırrı
DAHİL EDİLMEZ: bunlar kullanıcı hakkında bilgi değil, kimlik doğrulama
sırlarıdır.

### Kabul kriterleri
- [x] Üç yeni tablo RLS ile korunuyor; oturum ve sıfırlama kayıtları kiracı sınırına tabi.
- [x] GirisDenemesi kiracı bağlamında SIFIR satır döndürüyor (kimin ne zaman denediği müşteriye açılmaz).
- [x] Şifre politikası beş belirleme noktasında da aynı; zayıf şifre hiçbirinden geçmiyor.
- [x] Geçersiz sıfırlama bağlantısı hiçbir hesap bilgisi sızdırmıyor.
- [x] TOTP, RFC 6238 test vektörünü doğruluyor; ±1 pencere toleransı var, dışı reddediliyor.
- [x] Oturum sonlandırıldığında ilgili çerez bir sonraki istekte geçersiz.
- [x] KVKK metni sürümlü, rıza kaydı denetime düşüyor, veri kopyası oturumsuz indirilemiyor.
- [x] `npm run dogrula` toplam **369 kontrol** ile geçiyor (219 birim test dahil).

---

---

# İKİNCİ TUR — Saha Geri Bildirimleri (Faz 13–20)

Aşağıdaki fazlar, ürün ortağının kullanım sonrası tespitlerinden türetildi
(35 bulgu). Bulgular olduğu gibi bırakılmadı; **birbirine bağımlı olanlar aynı
faza toplandı** ve bağımlılık sırasına dizildi:

- Sipariş, kampanya kotasından adet düşer → **kampanya ürün kataloğundan sonra**.
- Sevkiyat yalnızca onaylı siparişten doğar → **sipariş akışından sonra**.
- Mali raporlar sipariş/sevkiyat verisini okur → **onlardan sonra**.
- Birleşik ekran bütün modülleri kapsar → **en sona**.

> **Kararlar alındı.** İlk turda sorulan yedi soru yanıtlandı ve her fazın
> sonundaki **"Kararlar"** başlığına işlendi (stok takibi eklendi, kampanya
> tekil uygulanır, firma numarası `A0001`–`Z9999`, dosya depolama yerel
> volume, geocoding Google Maps, konum izni reddi engel değil, AI en sona
> alındı). Faz 16 ve 19'da yalnızca iki küçük tasarım sorusu açık kaldı;
> ikisi de o faz başlarken netleşebilir.

---

## Faz 13 — Arayüz ve Veri Düzeltmeleri → `v1.13.0`

Küçük ama günlük kullanımı doğrudan etkileyen düzeltmeler. Yeni modül yok;
bu yüzden ilk sıradadır — hızlı kazanç.

- [x] **H1 — Firma numarası.** Her firmaya kiracı içinde **değiştirilemez**,
      otomatik artan numara. Liste, detay, arama ve dışa aktarımda görünür.
      **KARAR: biçim `A0001` → `Z9999`.** Sayaç 9999'a ulaşınca harf ilerler
      (`A9999` → `B0001`); toplam kapasite **259.974 firma/kiracı**.
      *Tasarım:* numara kiracı BAŞINA sayılır (her kuruluş A0001'den başlar);
      üretim veritabanı düzeyinde tekil kısıtla korunur, eşzamanlı iki kayıt
      aynı numarayı alamaz. Sıradaki numara `(tenantId, sayac)` satırından
      atomik artırmayla alınır — "en büyüğü bul, bir ekle" yarış koşuludur.
      Harf+rakam dönüşümü saf bir fonksiyondur (`firma-no-saf.ts`) ve testler
      sınır durumları (A9999→B0001, Z9999 tükendi) doğrudan sınar.
      Mevcut firmalara migration ile `createdAt` sırasına göre numara verilir.
      Z9999 tükenirse kayıt açılmaz ve açık bir hata döner (sessizce
      numarasız kayıt açmak, alanın "değiştirilemez kimlik" sözünü bozardı).
- [x] **H2 — Filtrelerde büyük/küçük harf duyarsızlığı.** Bütün liste
      aramaları `mode: "insensitive"` kullanır.
      *Bulgu doğrulandı:* şu an firmalar, adaylar, kişiler (telefon),
      eğitimler, hizmetler ve yatırım destekleri listelerinde eksik — yani
      "TEKSTİL" arayan kullanıcı "Tekstil" firmasını bulamıyor.
      Ayrıca **Türkçe İ/ı sorunu**: `insensitive` tek başına "İSTANBUL" ile
      "istanbul"u eşleştirir ama "Istanbul" ile "ıstanbul"u ayırır; arama
      terimi normalize edilir (SecimKutusu'ndaki yöntem ortak bir yardımcıya
      taşınır).
- [x] **H3 — Kişiler → Kontaklar.** Modülün adı her yerde değişir: menü,
      başlıklar, dışa aktarım etiketi, bildirim metinleri.
      *Dikkat:* URL `/kisiler` olarak KALIR (kayıtlı görünümler `liste`
      anahtarına bağlı; değiştirmek kullanıcıların görünümlerini kırardı).
      Yalnızca görünen ad değişir; gerekçe koda yazılır.
- [x] **H4 — Kontaklar menüde Raporlar'ın altına taşınır.**
- [x] **H5 — Adaylar, Fırsatlar'ın içine taşınır.** `/adaylar` ayrı menü
      öğesi olmaktan çıkar; Fırsatlar ekranında üçüncü bir sekme olur
      (Kanban · Liste · **Adaylar**). Adres korunur (kayıtlı görünümler için).
- [x] **H6 — Yeni fırsatta yerinde firma oluşturma.** Fırsat formundaki firma
      seçicisinde "+ Yeni firma" seçeneği; ad ve gerekli asgari alanlarla
      firma açılır ve fırsata bağlanır. Paket firma limitine tabidir.
- [x] **H7 — Fırsat "Teklif" aşamasına gelince teklif bağlanır.** Fırsat
      detayında "Teklif Hazırla" düğmesi; üretilen teklif fırsata bağlanır ve
      fırsat kartında/detayında görünür.
      *Veri modeli:* `Teklif.firsatId` (opsiyonel FK, `onDelete: SetNull`).
      Bir fırsatın birden çok teklifi (ve revizyonu) olabilir.
- [x] **H8 — Takvimde kategori süzgeci.** Üstteki kategori rozetlerine
      tıklayınca yalnızca o tür öğe kalır (görev, fırsat, teklif, eğitim,
      hizmet); çoklu seçim ve "tümü" desteklenir. Süzgeç querystring'de
      yaşar — kayıtlı görünüm ve `.ics` çıktısı da ona uyar.
- [x] **H9 — Raporlarda tarih aralığı.** Bütün rapor kartları ortak bir
      tarih aralığı süzgecine bağlanır (hazır seçenekler: bu ay, geçen ay,
      bu çeyrek, bu yıl, özel aralık). Süzgeç querystring'de yaşar.

### Kararlar
- Numara biçimi `A0001`–`Z9999` (harf ilerler, 259.974 kapasite). ✅

### Uygulama notları (v1.13.0)

- **Numara dört yerde verilir** — firma formu, aday dönüşümü, içe aktarım ve
  fırsat formundaki "yeni firma". Dördü de aynı `siradakiFirmaNo` kapısından
  geçer; sayaç satırı `UPDATE … RETURNING` ile atomik artırılır.
- **Numara dışa aktarılır, içe aktarılamaz.** Sütun tanımına `saltDisa`
  bayrağı eklendi: dosyadan okunabilseydi kullanıcı iki firmaya aynı
  numarayı verebilir ve alanın tekillik sözü bozulurdu.
- **Geri yükleme numarayı korur.** Aynı kiracıya geri yüklemede numaralar
  yerinde kalır; başka kuruluşa yüklenen bir dosyada çakışan numara
  boşaltılır, kayıt yine de eklenir ve sonradan sıradaki numarayı alır.
  Sayaç geri yükleme sonunda gerçek duruma çekilir.
- **H2'nin asıl sorunu `insensitive` eksikliği değildi.** PostgreSQL'in ASCII
  eşlemesinde `upper('ı')` = `'ı'`; yani "ısparta" yazan kullanıcı "ISPARTA"
  kaydını ILIKE ile de bulamıyordu. Çözüm sütunu değil TERİMİ çoğaltmak:
  `metinArama` arama metnini Türkçe büyük ve küçük hâlleriyle birlikte arar
  (`src/lib/arama.ts`). Dokuz liste ve dışa aktarım aynı yardımcıyı kullanır.
- **Takvim süzgeci sorguyu da kısar.** Seçilmeyen kategorinin sorgusu hiç
  çalışmaz (pano kartlarındaki kural). Süzgeç `.ics` çıktısına da yansır.
- **Ters tarih aralığı raporu boşaltmaz.** Başlangıç > bitiş yazıldığında
  süzgeç uygulanmaz; boş bir rapor kullanıcıya "veri yok" der, oysa sorun
  yazım hatasıdır.

---

## Faz 14 — Ürün Kataloğu, Stok, Paket ve Kampanya → `v1.14.0`

Ticari çekirdeğin temeli. Sipariş bu fazın üstüne kurulur.

- [x] **T1 — Ürün/hizmet kataloğu.** Kod, ad, birim, liste fiyatı, KDV oranı,
      para birimi, aktif/pasif. Kiracıya özeldir.
- [x] **T2 — Müşteriye özel paket tanımı.** Bir veya birden çok üründen
      oluşan paket; firmaya özel fiyat/iskonto taşıyabilir.
- [x] **T3 — Kampanya tanımı.** Kod, ad, **tip**, **durum**, **başlangıç ve
      bitiş tarihi**, kapsadığı ürün/paketler, indirim kuralı (yüzde ya da
      tutar), firma kapsamı (tüm firmalar / seçili firmalar).
      *Tip örnekleri:* yüzde indirim, tutar indirimi, X alana Y bedava,
      paket fiyatı. Tip listesi sabit tanımdır (`constants.ts`).
      *Durum:* taslak · aktif · duraklatıldı · sona erdi (bitiş tarihi
      geçince zamanlanmış iş kendiliğinden "sona erdi"ye çeker).
- [x] **T4 — Kampanya kotası ve kullanım sayacı.** Kampanyaya **adet**
      girilir; her satışta verilen adet otomatik düşer. Firma bazında
      "bu kampanyadan kaç kez faydalandı" ve "ne kadar hakkı kaldı" görünür.
      *Kritik:* kota düşümü sipariş onayıyla ATOMİK olmalı — iki satış
      temsilcisi aynı anda son adedi satamamalı (veritabanı düzeyinde koşullu
      güncelleme; sayaç uygulama katmanında hesaplanıp yazılmaz).
- [x] **T5 — Kampanya raporu.** Kampanya bazında: kullanım adedi, kalan kota,
      ciro etkisi, firma kırılımı, tarih aralığı süzgeci.
- [x] **T6 — Fiyat motoru.** Bir sipariş satırının fiyatı tek bir SAF
      fonksiyondan geçer: liste fiyatı → firmaya özel paket → geçerli kampanya
      → son fiyat. Sıra ve öncelik yazılıdır; testler bu fonksiyonu
      veritabanı olmadan sınar (`fiyat-saf.ts`).
- [x] **T7 — Stok takibi.** Ürün bazında stok miktarı ve **stok hareketi**
      defteri: giriş (mal kabul), çıkış (sevkiyat), düzeltme, sayım. Her
      hareket kim/ne zaman/neden bilgisiyle kaydedilir ve SİLİNMEZ — stok
      bakiyesi hareketlerin toplamıdır, elle yazılan bir sayı değildir.
      *Kritik:* bakiye düşümü, kampanya kotasıyla aynı gerekçeyle atomik
      olmalıdır; iki temsilci son ürünü aynı anda satamamalı.
- [x] **T8 — Stok uyarıları ve raporu.** Kritik stok seviyesi tanımı, altına
      düşünce bildirim; stok durumu, hareket dökümü ve devir hızı raporu.

### Kararlar
- **Tek kampanya uygulanır:** en avantajlı olan otomatik seçilir, kullanıcı
  isterse değiştirir. Üst üste binen indirimler hem hesaplaması hem müşteriye
  savunması zor rakamlar üretirdi. ✅
- **Gerçek stok takibi VAR** (T7, T8). Kampanya kotası ile stok bakiyesi
  AYRI iki sayaçtır: kota "bu kampanyadan kaç adet verilebilir", stok "elde
  kaç adet var". Bir sipariş ikisini birden düşürür.
- Kota **adet** üzerinden tükenir (bulguda böyle yazıyor).

### Uygulama notları (v1.14.0)

- **Fiyat sırası tek yerde:** `fiyat-saf.ts` → liste → paket → kampanya →
  KDV. Paket kampanyadan ÖNCE gelir: paket "bu müşterinin fiyatı budur"
  anlaşması, kampanya onun üzerine yapılan geçici jesttir. Ters sırada
  sözleşmeli müşteri kampanyadan hiç yararlanamazdı.
- **KDV indirimli tutar üzerinden** hesaplanır; aksi halde müşteri almadığı
  indirimin vergisini öderdi.
- **Kota ve stok İKİ AYRI atomik sayaçtır.** İkisi de koşullu `UPDATE … WHERE`
  ile düşer; "oku → kontrol et → yaz" yaklaşımı iki temsilcinin son adedi
  aynı anda satmasına açık kapı bırakırdı. Testler 10 eşzamanlı istekle bunu
  doğruluyor.
- **Bakiye hareketlerin toplamıdır.** `Urun.stokMiktar` bir ÖZETTİR; ürün
  formundan yazılamaz, yalnızca hareketle değişir. Sayım bakiyeyi ezmez,
  FARK kadar hareket yazar — "sistemde 100, sayımda 97" bilgisi kaybolmaz.
- **Defterler silinmez.** Kullanılmış kampanya silinemez (durumu "sona erdi"
  yapılır); stok hareketi düzeltilmez, ters hareketle kapatılır; iptal edilen
  kampanya kullanımı işaretlenir ve kotası iade edilir.
- **Görüntüleme ile tanım ayrı izinlerdir.** Satış temsilcisi fiyatı ve
  kampanyayı görür, kendine indirim tanımlayamaz. Stok hareketi ise günlük
  iştir; üyede vardır.
- **Faz 15 bağlantısı:** kampanya kullanımı ve stok çıkışı şimdilik elle
  işleniyor. Sipariş onayı geldiğinde aynı `kampanyaKullan` /
  `stokHareketiIsle` kapıları çağrılacak — arayüz değişecek, kural değil.

---

## Faz 15 — Sipariş, Onay Akışı ve Sevkiyat → `v1.15.0`

- [x] **S1 — Sipariş modülü.** Firma, kalemler (ürün/paket, adet, birim
      fiyat, iskonto, KDV), toplamlar, uygulanan kampanya, para birimi.
      Tutarlar **sunucuda** hesaplanır ve saklanır (teklifteki desen).
- [x] **S2 — Projeye ve teklife bağlama.** Sipariş; bir teklif ve/veya bir
      projeyle ilişkilendirilebilir (Faz 16'daki proje modülüyle bütünleşir).
      Tekliften tek tuşla sipariş oluşturma.
- [x] **S3 — Yönetici onay akışı.** Satış personelinin girdiği her sipariş
      "onay bekliyor" durumunda açılır. Yönetici onaylar ya da reddeder
      (gerekçeyle). Onay yetkisi ayrı bir izindir (`siparis.onayla`).
      **Onaylanmadan sevkiyata hiçbir bildirim gitmez** — bu, akışın
      sözüdür ve testle sabitlenir.
- [x] **S4 — Depo / Sevkiyat modülü.** Onaylanan siparişler sevkiyat
      kuyruğuna düşer. Sevkiyat durumu: hazırlanıyor · sevk edildi ·
      teslim edildi · iptal. Kargo/taşıyıcı ve takip numarası alanı.
- [x] **S5 — Sevkiyat raporu.** Durum kırılımı, bekleme süreleri, gecikenler,
      tarih aralığı süzgeci.
- [x] **S6 — Bildirimler.** Onay bekleyen sipariş → yöneticiye; onay/ret →
      satış personeline; onaylandı → depo ekibine. Mevcut bildirim kapısından
      (`bildirim.ts`) geçer, kullanıcı tercihine saygılıdır.

### Kararlar
- **Stok Faz 14'te kuruldu.** Sipariş onaylandığında hem kampanya kotası hem
  stok bakiyesi düşer; stok yetersizse onay verilemez ve gerekçe gösterilir. ✅
- Onay **tek kademelidir** (yönetici). Tutara göre kademeli onay şimdilik
  yok; gerekirse sonradan eklenir. ✅

### Uygulama notları (v1.15.0)

- **Akışın sözü tek kapıdan geçer:** `sevkiyatAcilabilirMi`. Sevkiyat kaydı
  yalnızca onaylanmış siparişten doğar ve **depo bildirimi de yalnızca onay
  anında** gönderilir. Kural izinle değil VERİYLE korunur — depo yetkisi
  olan bir kullanıcı bile onaysız siparişe sevkiyat açamaz. Testle sabit.
- **Onay ayrı bir izindir** (`siparis.onayla`) ve üyede YOKTUR: siparişi
  giren kişi kendi siparişini onaylayamaz. Onay bir durum alanı değil, bir
  yetki ayrımıdır.
- **Onay atomiktir ve geri alınabilir:** stok yeterliliği önce toptan
  kontrol edilir, sonra satır satır atomik düşülür. Bir satır yarı yolda
  düşerse (araya başka bir onay girdiyse) o ana kadar düşülenler TERS
  HAREKETLE iade edilir ve onay reddedilir — yarım düşülmüş stok en zor
  düzeltilen durumdur.
- **Onaylanmış sipariş düzenlenemez, silinemez.** Onaylanan rakam stok ve
  kota düşümünün dayandığı rakamdır; değişmesi gerekiyorsa iptal edilip
  yenisi açılır (teklif revizyonundaki gerekçe). İptal, stoğu iade
  HAREKETİYLE geri verir; sevk edilmiş sipariş iptal edilemez.
- **Belge numarası yıl bazında atomik sayaçtan** gelir (`SIP-2026-0001`,
  `SVK-2026-0001`) — firma numarasındaki (Faz 13 / H1) desen.
- **Projeye bağlama (S2) Faz 16'ya bırakıldı:** proje modeli henüz yok.
  Sipariş şimdilik TEKLİFE bağlanıyor; kabul edilen tekliften tek tuşla
  sipariş açılıyor. Proje geldiğinde `Siparis.projeId` eklenecek.

---

## Faz 16 — Proje, Destek Kaydı ve SSS → `v1.16.0`

- [x] **P1 — Proje modülü.** Firma, ad, kod, sorumlu, başlangıç/bitiş,
      durum, bütçe. Projeye bağlı **teklifler ve siparişler** proje
      detayında listelenir ve oradan oluşturulabilir.
- [x] **P2 — Destek / başvuru kaydı (ticket).** Firma bazında açılır.
      Alanlar: **geliş kanalı** (telefon, e-posta, web, saha ziyareti,
      sosyal medya…), **öncelik** (düşük/orta/yüksek/kritik), **atanan
      kişi**, durum (açık · işlemde · beklemede · çözüldü · kapandı),
      **yapılan işlemler** (zaman damgalı işlem geçmişi).
- [x] **P3 — Destek raporu.** Firma bazında ve genel: kanal kırılımı,
      öncelik dağılımı, kişi bazında yük, çözüm süresi, tarih aralığı.
- [x] **P4 — SSS (bilgi bankası).** Manuel giriş: soru, yanıt, kategori,
      etiketler. Üstünde **arama** (Türkçe duyarsız). Destek kaydı
      ekranından ilgili SSS'ye hızlı erişim.

### Açık sorular — YANITLANDI

- Destek kaydı ile mevcut **Aktivite** modülü ne kadar ayrışacak? Aktivite
  "ne yaptık" günlüğüdür; destek kaydı ise **sahibi, önceliği ve durumu olan
  bir iş**. **KARAR: ayrı model + aktivite geçmişi.** `DestekKaydi` kendi
  tablosudur; işlem geçmişi ise `Aktivite.destekId` ile aktivite satırı
  olarak tutulur. Böylece destek işlemleri firma zaman akışında da görünür
  ve timeline tek sorguyla kurulmaya devam eder. ✅
- Teklif/siparişin projeye bağı **OPSİYONELDİR**: tek seferlik küçük satış
  için proje açmak zorunda kalmak, kullanıcıyı boş proje üretmeye iterdi. ✅

### Uygulama notları (v1.16.0)

1. **Çözüm ve kapanış damgaları KENDİLİĞİNDEN atılır** (`durumDamgalari`).
   Kullanıcıya "çözüm tarihini de yaz" dedirtmek bir gün unutulacak bir
   adımdır ve çözüm süresi raporunu sessizce bozar. Çözüm damgası bir kez
   atılır ve geri ALINMAZ (kayıt yeniden açılsa bile ilk çözüm anı
   gerçekti); kapanış damgası yeniden açılışta temizlenir. Doğrudan
   "kapandı"ya çekilen kayıt da çözülmüş sayılır — yoksa süre raporunda hiç
   görünmezdi.
2. **Destek listesi bir ARŞİV değil İŞ KUYRUĞUDUR:** varsayılan görünüm
   açık işlerdir, kapanmışlar `durum=hepsi` ile gelir. Sıralama tarihe
   değil ÖNCELİĞE bakar.
3. **Kanal ve öncelik SABİT listedir.** Serbest metin olsaydı "telefon" /
   "Telefon" / "Tel" üç ayrı kanal gibi sayılır ve kırılım raporu
   anlamsızlaşırdı (v1.12.1'deki departman kararının aynısı).
4. **Kayıt numarası sipariş/sevkiyattaki atomik sayaçtan** gelir
   (`DST-2026-0001`, `BelgeSayac`). Aynı desen dördüncü kez kullanıldı.
5. **Kişi yükü YALNIZCA açık kayıtları sayar:** "kimde kaç iş var" sorusu
   bugünü sorar, kapanmış iş kimsenin üzerinde yük değildir.
6. **SSS'de görüntüleme ile yönetim ayrı izinlerdir** (`sss.goruntule` /
   `sss.yonet`): destek ekibinin tamamı yanıtları okumalı, kurumsal cevabı
   yalnızca yetkili değiştirmelidir. Etiketler Türkçe kurallarıyla küçültülüp
   tekilleştirilir — "İADE" ve "iade" tek etikettir.
7. **Görüntülenme sayacı atomiktir** (`increment`) ama denetim günlüğüne
   yazılmaz ve sayfayı yeniden doğrulamaz: bir yanıtı okumak değişiklik
   değildir.
8. **Yedek sırası FK'ye bağlıdır:** `proje` ve `destekKaydi`, `aktivite`den
   ÖNCE geri yüklenir. Bu kural artık regresyon testiyle sabitlendi
   ("Yedek kapsamı şemayla tutarlı").
9. **Proje silmek bağlı kayıtları silmez:** teklif/sipariş/destek FK'leri
   `SetNull` — satış ve destek geçmişi projenin kapatılmasıyla yok olmamalı.

---

## Faz 17 — Saha Çalışması: Ek Dosyalar ve Konum Doğrulama → `v1.17.0`

- [x] **A1 — Dosya eki altyapısı.** Aktivite (ve sonraki fazda destek kaydı,
      sipariş) kaydına dosya eklenebilir. Boyut ve tür sınırı, kiracı bazlı
      kota, virüs riskine karşı sunucuda tür doğrulaması (uzantıya değil
      içeriğe bakılır).
- [x] **A2 — Fotoğraf çekme.** Mobil tarayıcıda kameradan doğrudan çekim
      (`capture` özniteliği); çekilen görsel sunucuda küçültülerek saklanır.
- [x] **A3 — Firma konumu.** Firma kaydına enlem/boylam. Adresten koordinat
      üretimi (geocoding) ve haritada işaretleme.
- [x] **A4 — Ziyaret kaydı ve saat.** Saha personeli ziyareti başlatır ve
      bitirir; **süre otomatik tutulur**, aktivite kaydına yazılır.
- [x] **A5 — Konum doğrulama.** Ziyaret anında tarayıcının konum servisinden
      alınan koordinat, firmanın koordinatıyla karşılaştırılır.
      Yarıçap içindeyse kayıt **yeşil**; dışındaysa **kırmızı** işaretlenir,
      aktiviteye açıklayıcı not düşer ve **yöneticiye bildirim gider**.
      Yarıçap kuruluş ayarıdır (varsayılan öneri: 300 m).

### Kararlar
1. **KVKK metni ÖNCEDEN güncellendi** (v1.12.2): "Saha çalışması ve konum
   verisi" bölümü eklendi, aktarım ve saklama bölümleri genişletildi, metin
   sürümü `2026-08-2`ye çıkarıldı. Sürüm arttığı için tüm kullanıcılardan
   **yeniden rıza** istenir. Metnin verdiği sözler bu fazın uygulamasını
   BAĞLAR: sürekli takip yok, konum yalnızca ziyaret başında/sonunda alınır,
   yalnızca "doğrulandı/doğrulanamadı" sonucu saklanır. ✅
2. **Dosya depolama: yerel Docker volume.** `docker-compose` dosyalarına
   `gezegen-dosya` volume'ü eklenir, uygulama oraya yazar. Yedek kapsamına
   dahil edilir ve `docs/DEPLOY.md`'ye yedekleme adımı yazılır. ✅
3. **Geocoding: Google Maps.** `GOOGLE_MAPS_API_KEY` ortam değişkeni.
   **Maliyet koruması zorunlu:** koordinat bir kez üretilip firma kaydında
   SAKLANIR, her görüntülemede yeniden istenmez; adres değişmedikçe yeni
   istek gitmez; anahtar tanımsızsa özellik kapalıdır (koordinat elle
   girilir) — "anahtar yoksa çalışmasın" davranışı, sessizce ücretli çağrı
   yapmaktan iyidir. ✅
4. **Konum izni reddedilirse ziyaret yine açılır**, "konum doğrulanamadı"
   (sarı) olarak işaretlenir. Teknik bir aksaklık personeli işini yapamaz
   hâle getirmemeli. ✅

### Uygulama notları (v1.17.0)

1. **Dosya türü UZANTIDAN DEĞİL İÇERİKTEN belirlenir** (`turTespit`): imza
   eşleşmezse dosya reddedilir. `.jpg` uzantılı bir çalıştırılabilir dosya,
   uzantıya güvenen bir sistemde sunucuya girip tarayıcıya görsel diye
   sunulurdu. İzinli türler BEYAZ LİSTEDİR; "şunlar yasak" yaklaşımı unutulan
   her yeni türde açık kapı bırakırdı.
2. **Zip tabanlı Office belgeleri tek imzayı paylaşır** (`PK\x03\x04`);
   docx/xlsx/pptx ayrımı imzadan yapılamaz. İçerik "zip kapsayıcı" olarak
   doğrulanır, etiket uzantıdan seçilir — uzantı burada güvenlik kararı
   değil, gösterim kararıdır.
3. **Dosyanın kendisi veritabanında DEĞİL diskte durur.** Yedeğe base64
   koymak, yedek dosyasını indirilemez hâle getirirdi (E7'nin sözü). `Dosya`
   bu yüzden JSON yedeği kapsamı DIŞINDADIR; volume yedeği `docs/DEPLOY.md`
   içinde ayrı bir adımdır.
4. **Kota yüklemeden ÖNCE bakılır** (10 MB/dosya, 2 GB/kiracı): diski
   doldurup sonra silmek, eşzamanlı iki yüklemede kotanın aşılmasına izin
   verirdi. Görseller sunucuda 1600 piksele küçültülür; küçültme başarısız
   olursa özgün dosya saklanır — bozuk bir görsel yüklemeyi düşürmemeli.
5. **İndirme ucu kiracı katmanından geçer** ve `nosniff` gönderir; görseller
   `inline`, diğer türler `attachment` olarak sunulur. Tarayıcı içeriğe bakıp
   kendi tür kararını verirse sunucudaki beyaz listenin anlamı kalmazdı.
6. **Geocoding ANAHTAR TANIMSIZSA KAPALIDIR** ve koordinat elle girilir.
   Maliyet koruması iki katmanlıdır: koordinat kayıtta saklanır, ayrıca
   `konumAdres` alanı sayesinde adres değişmedikçe yeni istek gitmez.
   Haritada gösterim GÖMÜLÜ harita değil dış BAĞLANTIDIR — gömülü harita her
   açılışta ücretli bir istektir.
7. **Konum doğrulamasının ÜÇ sonucu vardır**, iki değil: doğrulandı (yeşil),
   uyuşmuyor (kırmızı), doğrulanamadı (sarı). İzin reddi ya da koordinatsız
   firma "uzak" saymaz — teknik aksaklık personeli suçlu duruma
   düşürmemelidir (karar 4). Yöneticiye bildirim YALNIZCA kırmızıda gider.
8. **Doğrulama kararı ziyaret satırına yazılır** (`dogrulama`, `mesafeM`,
   `yaricapM`): kuruluş yarıçapı sonradan değişse bile geçmiş ziyaretlerin
   kararı sabit kalmalıdır.
9. **Süre kullanıcıdan istenmez**, damgalardan hesaplanır; ziyaret bitince
   AKTİVİTE yazılır ve firma zaman akışında görünür (destek işlemlerindeki
   aynı karar). Aynı anda iki açık ziyaret olamaz.
10. **Mesafe küresel (haversine) hesaplanır.** Düz Öklid hesabı 39. enlemde
    doğu-batı sapmasını ~%30 fazla gösterir ve yerinde olan bir ziyareti
    uzak sayardı.

> **Faturalandırma notu (doğrulanmalı):** Google Maps Platform kullandıkça
> öder; aylık sabit ücreti yoktur ve belirli bir kullanım eşiğine kadar
> ücretsiz kotası vardır — ancak hesaba **kredi kartı tanımlanması
> zorunludur** ve kota aşılırsa ücretlendirme başlar. Fiyatlandırma zaman
> içinde değiştiği için anahtar alınmadan önce Google'ın güncel
> fiyatlandırma sayfasından teyit edilmeli ve konsolda **günlük istek
> sınırı (quota)** tanımlanmalıdır. Yukarıdaki önbellekleme kararı, tipik
> kullanımda çağrı sayısını firma sayısı kadarla sınırlar.

---

## Faz 18 — Raporlama Merkezi ve Firma Dosyası → `v1.18.0`

- [x] **R1 — Rapor merkezi.** Bütün raporlar tek bir çatı altında: ortak
      tarih aralığı, ortak süzgeçler (firma, sorumlu, durum), ortak dışa
      aktarım. Yeni bir rapor eklemek kayıt defterine satır eklemek olur
      (pano kartlarındaki desen).
- [x] **R2 — Mali raporlar.** Ciro (teklif/sipariş bazlı), tahsilat
      beklentisi, kampanya maliyeti/indirim toplamı, ürün ve paket bazında
      satış, firma bazında ciro, dönem karşılaştırması.
- [x] **R3 — Modül raporları.** Fırsat hattı ve dönüşüm oranları, aktivite
      yükü, destek kaydı performansı, sevkiyat durumu, eğitim/hizmet/yatırım
      dağılımları — hepsi tarih aralığına duyarlı.
- [x] **R4 — Firma dosyası (tek PDF).** Bir firma için yapılan HER ŞEYİN tek
      belgede toplanması: künye, kontaklar, fırsatlar, teklifler, siparişler,
      projeler, destek kayıtları, aktiviteler, yatırım/eğitim/hizmet kayıtları
      ve zaman akışı. Kiracı markasıyla, tarayıcı yazdırma motoruyla (Faz 9
      deseni). İçerik izin süzgecinden geçer — izni olmayan modül belgeye
      girmez.
- [x] **R5 — Rapor özelleştirme.** Kullanıcı hangi kolonları/kırılımları
      istediğini seçer ve kaydeder (kayıtlı görünüm altyapısı kullanılır).

### Kararlar (v1.18.0)

1. **Tahsilat beklentisi MEVCUT VERİDEN türetildi; ödeme/fatura modeli
   EKLENMEDİ.** Sistemde "kim ne zaman ödedi" kaydı yoktur ve rapor bunu
   ekranda açıkça söyler ("tahmindir"). Rakam üç kalemden oluşur: onay
   bekleyen siparişler + kabul edilmiş teklifler + açık fırsatların
   olasılıkla ağırlıklı toplamı. Gerçek bir cari/alacak takibi ayrı bir
   fazın işidir; Faz 18 rapor fazı olarak kaldı. ✅
2. **R5 kayıtlı görünüm altyapısıyla karşılandı** (Faz 10 / E4): rapor
   süzgeci zaten querystring'de yaşadığı için tek yapılan `GORUNUM_LISTELERI`
   listesine `raporlar` eklemek oldu. Kolon seçimi ve rapor oluşturucu
   bilinçli olarak KAPSAM DIŞINDA — ikisi de kendi başına bir faz
   büyüklüğünde ve R1-R4'ü geciktirirdi. ✅

### Uygulama notları (v1.18.0)

1. **Merkez KENDİ rakamını hesaplamaz.** `/raporlar` hiçbir sorgu
   çalıştırmaz; kayıt defterini (`rapor-tanimlar.ts`) okur ve ortak süzgeci
   raporlara taşır. Hub açmak, kullanıcının bakmayacağı onlarca sorgu
   tetiklememelidir.
2. **YENİ RAPOR EKLEMEK = KAYIT DEFTERİNE SATIR EKLEMEK** (pano kartlarındaki
   desen). Regresyon testi, defterde tanımlı her iç raporun sayfasının
   gerçekten var olduğunu denetler — tanım eklenip sayfa unutulursa hub'da
   404 veren bir kart kalırdı.
3. **Destek, sevkiyat ve kampanya raporları KOPYALANMADI**, merkeze
   BAĞLANDI. Kopyalamak iki ayrı doğruluk kaynağı üretir; biri düzeltilince
   öteki sessizce yanlış kalır. Kartlar bunun modülün kendi ekranı olduğunu
   yazar ve ortak süzgeç oraya TAŞINMAZ (o ekranların kendi anahtarları var;
   uydurma bir querystring sessizce yok sayılırdı).
4. **CİRO = ONAYLANMIŞ SİPARİŞ.** Teklif bir niyet, fırsat bir tahmindir.
   Onay anı, stok ve kampanya kotasının düştüğü (Faz 15), yani kuruluşun
   taahhüde girdiği andır.
5. **DÖNÜŞÜM ORANI KAPANMIŞ işler üzerinden** hesaplanır. Açık fırsatları
   paydaya koymak, hattı doldurdukça başarı oranını düşük gösterir ve satış
   ekibini yeni fırsat girmekten caydırırdı.
6. **Önceki dönem SIFIRSA yüzde üretilmez** ("%500 artış" tanımsızdır) ve
   karşılaştırma yalnızca KAPALI bir aralık seçilmişse yapılır — açık uçlu
   aralıkta "önceki dönem" diye bir şey yoktur, uydurmak yanlış oran
   göstermekten kötüdür.
7. **Firma dosyası izin süzgecinden geçer:** izni olmayan modül HİÇ
   SORGULANMAZ ve belgeye girmez. Yazdırılan belge elden ele dolaşır;
   kullanıcının ekranda göremediği veri kâğıda da düşmemelidir. Künye ve
   kontaklar tarih aralığından bağımsızdır — firmanın kimliği bir döneme ait
   değildir.
8. **PDF yine tarayıcının yazdırma motoruyla** üretilir (Faz 9 / E5'teki
   aynı gerekçeler); bölümler `break-inside-avoid` ile sayfa ortasından
   bölünmez.

---

## Faz 19 — Anket → `v1.19.0`

- [x] **N1 — Anket tanımı.** Başlık, açıklama, sorular (metin, çoktan
      seçmeli, ölçek 1-5/1-10, evet-hayır), zorunluluk, sıra.
- [x] **N2 — Anket gönderimi.** Seçili firmalara/kontaklara e-postayla
      **kişiye özel bağlantı**. Bağlantı token'lıdır; token saklanmaz,
      yalnızca sha256 özeti tutulur (davet akışı deseni).
- [x] **N3 — Yanıt toplama.** Anket sayfası **oturum gerektirmez** —
      müşteri uygulamanın kullanıcısı değildir. Bu, kiracı sınırının
      **beşinci dar kapısıdır** ve tek bir dosyada toplanır
      (`anket-db.ts`); regresyon testi bunu denetler.
- [x] **N4 — Anket raporu.** Soru bazında dağılım, NPS/memnuniyet skoru,
      firma kırılımı, yanıtlama oranı, tarih aralığı.

### Açık sorular — YANITLANDI

- Anket yanıtları **anonim** mi olacak? **KARAR: ANKETE GÖRE SEÇİLİR**
  (v1.19.0). Anket tanımında bir `anonim` bayrağı vardır ve söz ARAYÜZDE
  DEĞİL VERİDE tutulur: anonim ankette yanıt satırına `gonderimId` ve
  `firmaId` HİÇ yazılmaz, yani sonradan "kim yanıtladı" diye sorulamaz.
  Aydınlatma metnine "Anket yanıtları" bölümü eklendi ve metin sürümü
  `2026-08-3`e çıkarıldı — herkesten yeniden rıza istenir. ✅
- **Bağlantı ömrü: anketin bitiş tarihine kadar, TEK KULLANIMLIK** (v1.19.0).
  Yanıtlandıktan sonra kapanır; geç kalan katılımcı teknik bir hata değil,
  açık bir "anket kapandı" mesajı görür. ✅

### Uygulama notları (v1.19.0)

1. **BEŞİNCİ DAR KAPI: `anket-db.ts`** (`app.anket` bağlamı). Anketi dolduran
   kişi uygulamanın kullanıcısı DEĞİLDİR; hesabı yoktur ve olmayacaktır.
   Kapsam yalnızca dört anket tablosudur: anket ve soru SALT OKUNUR, yanıt
   yalnızca YAZILIR (okunmaz — dolduran kişi başkalarının yanıtını göremez).
   İş verisine hiçbir erişim yoktur. Regresyon testi hem bağlamın bu dosyanın
   dışında kullanılmadığını hem de `/anket` sayfasının kiracı katmanını hiç
   çağırmadığını denetler.
2. **Anonimlik VERİDE tutulur, arayüzde değil.** Bir onay kutusunun sözü
   ancak yazılmayan bir sütunla gerçek olur. Tarayıcı kontrolü de bunu
   arayüz metninden değil VERİTABANINDAN doğrular: anonim ankette
   kimlik bağlı yanıt sayısı sıfır olmalıdır.
3. **Anonimlik yayından sonra DEĞİŞTİRİLEMEZ.** Toplanmış yanıtlar o karara
   göre yazıldı; bayrağı sonradan çevirmek ya raporu tutarsızlaştırır ya da
   verilmemiş bir sözü verilmiş gibi gösterir.
4. **Token saklanmaz, sha256 özeti tutulur** (davet akışının aynı deseni) ve
   bağlantı tek kullanımlıktır.
5. **Yanıt toplanmış ankette soru değiştirilemez:** sonradan eklenen bir soru
   önceki yanıtlayanlarda boş kalır ve yanıtlama oranını anlamsızlaştırır.
6. **NPS standart eşiklerle** hesaplanır (9-10 destekçi, 7-8 nötr, 0-6
   kötüleyen). Kendi eşiğimizi koymak rakamı sektör kıyaslamasından koparırdı.
7. **Serbest metin yanıtlar GRAFİĞE dökülmez**, olduğu gibi listelenir: her
   yanıt biriciktir ve "dağılım" göstermek her sütunu 1 yapardı.
8. **Anket raporu merkeze BAĞLANDI, kopyalanmadı** (Faz 18 deseni): rapor
   anket bazındadır, hangi anketin sonucuna bakılacağı listeden seçilir.

---

## Faz 20 — Birleşik Çalışma Ekranı → `v1.20.0`

Bulgu: *"Modellerin içinden gezmemek için modeller kompleks yapıda çalışsın.
Tek ekrandan tüm modellere erişilebilsin ki user friendly olsun (Odoo örnek)."*

- [x] **U1 — Komut paleti (Ctrl/Cmd + K).** Her yerden firma, kontak, fırsat,
      teklif, sipariş, proje, destek kaydı arama ve doğrudan açma; ayrıca
      "yeni fırsat", "yeni sipariş" gibi eylemler.
- [x] **U2 — Yan panel (drawer) ile yerinde detay.** Listeden bir kayda
      tıklayınca sayfa değiştirmeden yandan açılan panelde detay ve düzenleme;
      "aç" ile tam sayfaya geçilebilir.
- [x] **U3 — Firma çalışma ekranı.** Bir firmanın bütün modülleri (kontak,
      fırsat, teklif, sipariş, proje, destek, aktivite, ek dosyalar) sekmeli
      tek ekranda; modüller arasında gezinmeden çalışılabilir.
- [x] **U4 — İlişkili kayıt zinciri.** Her kayıtta "bununla ilişkili" şeridi:
      fırsat → teklif → sipariş → sevkiyat zinciri tek bakışta izlenir.

### Kararlar
- Kapsam **U1–U4**'tür: komut paleti + yan panel + firma çalışma ekranı +
  ilişkili kayıt zinciri. Satır içi düzenleme kapsam DIŞIDIR; ayrıca
  istenirse yeni madde olarak eklenir. ✅
- Bu faz mevcut ekranların **ÜSTÜNE** gelir, onları değiştirmez — kullanıcı
  alışkanlıkları bozulmaz, eski yollar çalışmaya devam eder. ✅

### Uygulama notları (v1.20.0)

1. **ARAMA VE EYLEMLER TEK KAYIT DEFTERİNDEN** gelir
   (`src/lib/arama-tanimlar.ts`): hangi modülün aranabildiği, hangi izne
   bağlı olduğu ve sonucun nereye götürdüğü tek yerdedir. Yeni bir modülü
   aranabilir yapmak = deftere satır eklemek (pano kartları ve rapor
   merkezindeki aynı desen). Regresyon testi her satırın GERÇEK bir izin
   anahtarına bağlı olduğunu denetler — uydurma bir izin, süzgeci sessizce
   etkisiz bırakırdı.
2. **İZNİ OLMAYAN MODÜL HİÇ SORGULANMAZ.** `/api/arama` yalnızca
   kullanıcının görebildiği türleri sorgular; gizlenmiş bir menünün kaydı
   arama sonucunda belirseydi menüyü gizlemenin anlamı kalmazdı. Aynı kural
   `/api/ozet` ve zincir kurucusu için de geçerlidir.
3. **YAN PANEL URL'DE YAŞAR** (`?panel=firma:<id>`). Bileşenden bileşene
   "açık mı" durumu taşımak; sayfa yenilenince panelin kapanmasına,
   bağlantının paylaşılamamasına ve geri tuşunun beklenmedik davranmasına
   yol açardı. Panel ÖZET gösterir, tam detayın yerini almaz — her zaman
   "Tam sayfada aç" bağlantısı taşır. **Satır içi düzenleme kapsam dışıdır**
   (karar), panel bakmak içindir.
4. **SEKME BİR SORGU KAPISIDIR.** Firma çalışma ekranında seçilmeyen
   sekmenin sorgusu HİÇ çalışmaz; eski tek parça sayfa, kullanıcı yalnızca
   kontaklara bakacakken bütün modülleri sorguluyordu. Künyedeki onaylı
   yatırım toplamı artık `aggregate` ile tek satırda gelir.
5. **Uydurma ya da izinsiz sekme sessizce "genel"e düşer.** Hata sayfası
   göstermek, eski bir yer imini açan kullanıcıyı gereksiz yere korkuturdu.
6. **Firmanın Faz 15/16/17 modülleri ilk kez firma ekranına bağlandı:**
   sipariş (Satış sekmesi), proje ve destek kaydı (Proje & Destek), ziyaret
   geçmişi (Belge & Saha). Hiçbir bölüm kaldırılmadı, yalnızca gruplandı.
7. **ZİNCİRİN SIRASI İŞ AKIŞININ KENDİSİDİR:** fırsat → teklif → sipariş →
   sevkiyat (Faz 6 → 7 → 15). Boş halka GİZLENMEZ, "—" olarak durur:
   "bu teklif henüz siparişe dönmemiş" de bilgidir. Bakılan kayıttan başka
   dolu halka yoksa şerit hiç çizilmez — tek kutu ekranda yer kaplar,
   bilgi vermez.
8. **Üst çubuktaki işlevsiz arama kutusu paletle değiştirildi.** Kullanıcıyı
   hiçbir şey yapmayan bir kutuya yazdırmak, aramanın çalışmadığını en geç
   öğreten yoldu.


---

## Faz 21 — AI Özellikleri (G1–G3) → `v1.21.0`  ‹son faz›

- [x] **G1 — Lead/fırsat skorlama:** geçmiş kazanma verisinden skor; açıklanabilir gerekçe.
- [x] **G2 — Otomatik özet:** firma geçmişinin doğal dilde özeti.
- [x] **G3 — Doğal dilde sorgu:** "İzmir'deki onaylanmış hibeler" → filtrelenmiş liste.

**Kural:** AI çağrıları kiracı verisini kiracı sınırının dışına taşımaz; hangi
verinin modele gönderildiği kiracı yöneticisine açıkça bildirilir ve
kapatılabilir olur.

### Kararlar
- **G1 dil modeli KULLANMAZ**, kiracının kendi geçmişinden istatistikle
  hesaplanır. ✅
- **Anahtar tanımsızsa AI KAPALIDIR**; kural tabanlı karşılıklar anahtarsız
  çalışmaya devam eder. ✅
- **G3'te modele yalnızca CÜMLE gider**, veri gitmez; model süzgeç önerir,
  sorguyu her zaman uygulama çalıştırır. ✅
- **`ai` paket modülüdür ve `Tenant.aiAcik` VARSAYILAN KAPALIDIR**; iki kapı
  da açık olmadan hiçbir çağrı yapılmaz. ✅

### Uygulama notları (v1.21.0)

1. **G1 SKOR DİL MODELİNE SORULMAZ.** Skor bir temsilcinin gününü sıraya
   dizer; "bu neden 72" sorusunun denetlenebilir bir yanıtı olmalıdır.
   Kiracının kendi kapanmış işlerinden çıkan oranlar bu yanıtı kendiliğinden
   verir, aynı veriye hep aynı sonucu üretir, hiçbir şeyi dışarı çıkarmaz ve
   hiçbir şeye mal olmaz. Modele sorulan bir skor bu dördünü de kaybederdi.
2. **SKOR SAKLANMAZ**, her görüntülemede yeniden hesaplanır: saklanan skor
   veri değiştikçe bayatlar ve "bu rakam ne zamanki hâline ait" sorusunu
   doğurur. Taban BİR KEZ kurulup bütün satırlarda kullanılır.
3. **AZ ÖRNEKLE KESİNLİK İDDİA EDİLMEZ.** On kapanmış işin altında rozet
   "henüz güvenilir değil" der; sessizce bir rakam basmak, olmayan bir
   kesinlik iddiasıdır. Kırılım oranı da beş işin altında ÜRETİLMEZ.
4. **ÜÇ KAPI VAR ve hiçbiri diğerinin yerine geçmez:** paket modülü
   (platform), `Tenant.aiAcik` (kiracı, varsayılan KAPALI) ve sağlayıcı
   anahtarı. Kapalıysa SEBEBİ söylenir — "AI kullanılamıyor" demek
   kullanıcıyı yöneticiye, yöneticiyi bize sorduracak bir mesajdır.
5. **ANAHTAR TANIMSIZSA KAPALIDIR** (Faz 8 `/api/gorevler` ve Faz 17
   geocoding deseni). "Tanımsızsa serbest", ücretli bir servise sessizce
   istek atmak demektir.
6. **G2 ÖZET ÖNCE VERİDEN YAZILIR**, model yalnızca akıcılaştırır. Böylece
   özellik anahtarsız da işe yarar VE modele gönderilen metin uygulamada
   üretildiği için ne gönderildiği tam olarak bilinir; ayar ekranı bunu
   adlarıyla listeler. Model bir ANLATICIDIR: istem, rakam eklemesini ve
   yorum yapmasını açıkça yasaklar.
7. **ÖZET SAYFA AÇILIŞINDA MODEL ÇAĞIRMAZ**, kullanıcı isterse çağırır —
   aksi hâlde her firma görüntülemesi ücretli bir istek olurdu.
8. **G3 MODELE VERİ GÖNDERMEZ.** Model yalnızca cümleyi ve alan sözlüğünü
   görür; ürettiği şey bir SÜZGEÇTİR ve sorguyu her zaman uygulama
   çalıştırır — kiracı katmanı, RLS ve izinler yerinde kalır.
9. **BEYAZ LİSTE + İZİN KONTROLÜ**: modelden gelen süzgeç de kural
   ayrıştırıcısından geleni de aynı `sorguDogrula`'dan geçer; tanımsız alan
   sessizce atılır (Faz 11 `oa_*` deseni), izinsiz hedef reddedilir.
10. **ANLAŞILMAYAN CÜMLE YANLIŞ LİSTEYE GÖTÜRMEZ.** Kullanıcıya "anlayamadım"
    demek, ona yanlış bir listeyi doğru sandırmaktan iyidir.
11. **KULLANIM DEFTERİ** (`AiKullanim`) sözü geriye dönük denetlenebilir
    kılar; istemin ve yanıtın METNİ saklanmaz — defter bir denetim kaydıdır,
    ikinci bir müşteri veri kopyası değildir.
12. **AI eylemdir, okuma değil:** `ai.kullan` salt okunur rolde YOKTUR —
    özet istemek dış servise istek gönderir ve ücret doğurur. Açma/kapama
    (`ai.yonet`) yöneticidedir ve denetim günlüğüne düşer.
13. **KVKK metnine "Yapay zekâ destekli özellikler" bölümü** eklendi ve sürüm
    `2026-08-4`e çıkarıldı; aktarım bölümü de güncellendi.

---

---

## Faz Sonrası İstekler

Yol haritasının 21 fazı kapandıktan sonra gelen istekler burada tutulur.
Her biri kendi sürümüyle çıkar; küçük dokunuşlar minor, yapı değişiklikleri
major olur.

### v1.24.0 — Liquid glass tema ✅

İstek: *"hasib41/liquid-glass-nav repodaki tema ve navigator'u bütün
uygulamaya uygula; hem dark hem light temada, hem üst hem alt menülerde."*

**ÖN SÜRÜM OLARAK ÇIKTI, ONAYLANDI.** `-pre.1` ve `-pre.2` denemeleri
ortağın değerlendirmesi için yapıldı; ikinci denemeden sonra *"tamam bu
artık prod sürüm olabilir"* denerek `v1.24.0` olarak kapatıldı. Ön sürüm
etiketleri geçmişte durur — beğenilmeseydi `v1.23.0`e dönülecekti.

**pre.2 (ortağın geri bildirimi):** *"Açık temayı genel olarak begendik.
Koyu tema için mouse takip eden beyaz gölgeli cursor şeysi rahatsız etti.
Onu kaldıralım."*

- [x] Koyu temada imleci izleyen parlama katmanı çizilmiyor
      (`.dark .cam-parlama { display: none }`); açık temada AYNEN duruyor.

- [x] Cam token seti (açık + koyu), mevcut renk değişkenlerinin YANINA.
- [x] Beş katmanlı cam yüzey: buzlu taban, kırılma, gövde rengi, imleci
      izleyen parlama, 1px ışıklı kenar.
- [x] SVG kırılma filtresi (SDF → normal harita → `feDisplacementMap`),
      kabukta TEK örnek.
- [x] Arka planda aurora + ince ızgara — kırılmayı görünür kılan şey.
- [x] Uygulandığı yüzeyler: üst çubuk, sol menü, bölüm sekme çubuğu, mobil
      menü, komut paleti, yan panel.
- [x] Etkin menü öğeleri kayan kapsül (framer-motion `layoutId`).

**Kararlar**
1. **KAYNAK VANİLYAYDI, TAŞINDI.** Repo bağımsız bir HTML/CSS/JS bileşenidir;
   bağımlılık olarak eklenemezdi. Katman sistemi ve kırılma tekniği bu
   projenin Tailwind + next-themes düzenine taşındı.
2. **KOYU TEMA `.dark` SINIFINDA KALDI.** Kaynak `data-theme` kullanıyor;
   ona geçmek mevcut tema düğmesini ve `next-themes` kurulumunu kırardı.
3. **FİLTRE KAPSAYICIYA DEĞİL, KATMAN ÇOCUKLARINA UYGULANIR.**
   `backdrop-filter` taşıyan öğe `position: fixed` torunları için kapsayıcı
   blok oluşturur — v1.11.1'de `.card` yüzünden bir kez yaşandı ve çözüm
   `ModalKatman` portalıydı. Katmanlar mutlak konumlu çocuklar olduğu için
   kapsayıcı temiz kalır; içindeki açılır menüler ve modallar bozulmaz.
4. **KATMANLAR TIKLAMAYI ENGELLEMEZ:** `pointer-events: none` + `z-index: -1`.
   Bir yüzeyi camlaştırmak davranışını değiştirmez.
5. **KART CAMLAŞTIRILMADI.** `.card` zaten `backdrop-blur` taşıyor ve
   `ModalKatman` dengesi ona göre kurulu; kartı beş katmana çevirmek o
   dengeyi yeniden sınamayı gerektirirdi. Ön sürümde risk alınmadı.
6. **KIRILMA DESTEKLENMİYORSA SORUN DEĞİL:** `url()` içeren backdrop-filter'ı
   çözemeyen tarayıcı o katmanı çizmez, altındaki sade buzlu cam görünür.
   Kaynak bileşenin kendi tasarım kararı; JS'te özellik denetimi yok.
7. **HARİTA BİR KEZ ÜRETİLİR.** Kaynak her yüzey için `ResizeObserver` ile
   yeniden çiziyordu; onlarca yüzeyde bu onlarca canvas işi demekti. Tek bir
   yumuşak kenar profili bütün yüzeylere yetiyor.
8. **BASKIDA CAM TAMAMEN NÖTR:** katmanlar, arka plan ışıkları ve ızgara
   `@media print` içinde kapatılır — PDF çıktıları (Faz 9 / E5, v1.23.0)
   bozulmaz.
9. **`prefers-reduced-motion`** açıkken parlama izleyicisi hiç bağlanmaz.
10. **PARLAMA KOYU TEMADA ÇİZİLMEZ (pre.2).** Açık temada beyaz parlama buzlu
    camın içinde kaybolur ve yüzeye derinlik verir; koyu zeminde ise aynı
    katman imleci takip eden beyaz bir HALE gibi okunuyor ve dikkat
    dağıtıyordu. Katman KALDIRILMADI — koyu temada yalnızca çizilmiyor
    (`.dark .cam-parlama { display: none }`), böylece açık temanın beğenilen
    görünümü aynen kalıyor ve karar tek satırda geri alınabiliyor. Karar
    CSS'te verilir; `CamParlama` yalnızca boşuna iş yapmamak için ona bakar.

---

### v1.23.0 — Kampanya kapsamı ve rapor PDF'i ✅

Bulgu: *"Kampanyalar ekranından oluşturulan kampanya sipariş veya teklif
aşamasında aktif olmuyor, kampanya kısmı hiç gözükmüyor."* ve *"Raporların
PDF olarak alınması gerekiyor."*

- [x] **HATA:** `/siparisler/yeni` kampanyaları sunucuda BİR KEZ süzüyordu ve
      bağlama `urunId` HİÇ vermiyordu; `kampanyaGecerliMi` ürün kapsamı dolu
      kampanyaları bağlamda ürün yoksa reddettiği için, belirli ürünlere
      tanımlı her kampanya listeden düşüyordu. Firma seçilmeden firma
      kapsamlılar da düşüyordu ve liste istemcide hiç tazelenmiyordu.
- [x] Katalog kapsamıyla forma verilir, süzme satır satır yapılır
      (`kampanyaKatalogu` + `satirinKampanyalari`).
- [x] Kampanya alanı boşken de çizilir ve SEBEBİNİ yazar.
- [x] Sunucu doğrulaması tarih + kota + firma + ürün kapsamının tamamını
      denetler (eskiden yalnızca `durum = aktif` bakıyordu).
- [x] **Teklif kalemleri ilk kez kataloğa bağlandı:** `urunId`, `kampanyaId`,
      `indirimTutari` (migration `20260810140000_teklif_kampanya`).
- [x] Teklif belgesinde ve çıktısında kampanya indirimi AYRI satır.
- [x] Tekliften siparişe geçişte ürün ve kampanya taşınır.
- [x] Rapor ekranlarına "Yazdır / PDF Kaydet" + baskıya özel künye.

**Uygulama notları**
1. **Süzgeç istemcide, KURAL ortak.** Form ve sunucu aynı saf fonksiyonu
   çalıştırır; ayrı yazılsaydı formda görünüp kaydederken düşen (ya da tersi)
   kampanyalar çıkardı. İstemcideki süzgeç bir KOLAYLIKTIR, koruma değildir.
2. **`kalanKota = 0` belirsizdi** (hem "sınırsız" hem "bitti"); katalog artık
   ayrı bir `tukendi` bayrağı taşır.
3. **Teklifte indirim iki parçadır:** kampanya → belge iskontosu → KDV.
   Sipariş tarafındaki sırayla aynıdır, böylece kabul edilen teklif siparişe
   döndüğünde rakam değişmez.
4. **Katalog bağı OPSİYONELDİR:** serbest metin kalem (danışmanlık, montaj)
   yazmak hâlâ mümkündür ve eski teklifler olduğu gibi geçerli kalır.
   `tutar` alanının anlamı genişledi (kampanya sonrası net); kampanyasız
   satırlarda eski değerle aynıdır.
5. **Rapor PDF'i tarayıcının yazdırma motoruyla** üretilir (Faz 9 / E5).
   Baskıda kabuk ve süzgeç formu gizlendiği için yalnızca baskıda görünen
   bir künye eklendi — kuruluş adı, dönem ve çıktı tarihi olmadan elden ele
   dolaşan bir çıktı anlamsızdır.

---

### v1.22.0 — Menü konsolidasyonu ✅

Bulgu: *"Sol menü çok uzun; herhangi bir ana başlığa tıklayınca alt
başlıklar sayfa içinde sekme olarak görünsün."*

- [x] Sol menü altı ana girişe indirildi: Genel Bakış, **CRM**,
      **Satış Yönetimi**, Takvim, Raporlar, SSS (Bilgi Bankası) + Yönetim.
- [x] **CRM** = Firmalar · Fırsatlar · Kontaklar · Aktiviteler · Projeler ·
      Destek · Ziyaretler · Anketler · Kampanyalar · Yatırım Destekleri ·
      Eğitimler · Hizmetler
- [x] **Satış Yönetimi** = Teklifler · Siparişler · Sevkiyat · Stok · Ürünler
- [x] İçe Aktar, Yönetim bölümüne alındı.
- [x] Bölüm ekranlarında sayfanın üstünde sekme çubuğu.

**Kararlar**
- Firmalar CRM'in İLK sekmesi oldu (istekte "fırsatlar" iki kez yazılmıştı;
  Firmalar hiçbir grupta geçmiyordu ve iş verisinin merkezi odur). ✅
- SSS sol menüde ayrı kaldı, etiketi "SSS (Bilgi Bankası)" oldu. ✅

**Uygulama notları**
1. **HİÇBİR ROTA DEĞİŞMEDİ.** Değişen yalnızca gezinme yolu; kayıtlı
   görünümler, bildirim bağlantıları, dışa aktarım adresleri ve kullanıcı
   yer imleri kırılmadı. Regresyon testi her sekmenin gerçek bir sayfaya
   işaret ettiğini denetler.
2. **BÖLÜM HEDEFİ HESAPLANIR, SABİT DEĞİLDİR:** kullanıcının görebildiği ilk
   sekmeye gidilir. Sabit adres, o ekrana izni olmayan kullanıcıyı
   `/yetkisiz`e düşürürdü.
3. **SEKME ÇUBUĞU KABUĞA TEK YERDE BAĞLANDI.** Her sayfaya ayrı eklenseydi,
   yeni bir ekranda unutulurdu.
4. **Bölüme ait olmayan yolda çubuk çizilmez** (Takvim, Raporlar, Yönetim,
   firma çalışma ekranı); tek sekme kalmışsa da çizilmez.
5. **Etkin sekme sınır duyarlıdır:** düz `startsWith`, ileride açılacak
   `/destekler` gibi bir rotayı yanlışlıkla "Destek" sanardı.
6. Faz 13 / H3'ün sözü ("Kişiler" değil "Kontaklar") korundu; kontrolü
   panodan CRM sekme çubuğuna taşındı.

---

## Planlama Notları

- **A5 (Faz 3) test altyapısı gerektirir.** Seçilen listede F5 yoktu; test
  altyapısı Faz 3'ün ilk paketi olarak dahil edildi, ayrı faz açılmadı.
- **Faz 1 ile Faz 3 arasındaki boşluk:** izolasyon Faz 1'de kurulur ama otomatik
  kanıtı Faz 3'te gelir. Bu aralıkta Faz 1'in elle doğrulama adımları
  (kabul kriterleri) her sürüm öncesi tekrarlanır.
- **Seçilmeyen maddeler:** F5 (Faz 3'e gömüldü), F6 (mobil/PWA), F8 (faturalama).
  İhtiyaç duyulursa sonradan faz eklenebilir.
