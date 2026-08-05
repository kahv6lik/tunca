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
| **Son çıkan sürüm** | `v1.1.0` — Faz 1 tamamlandı |
| **Sıradaki faz** | **Faz 2** — PostgreSQL + Row-Level Security (`v1.2.0`) |
| **Devam eden iş** | yok |

## Genel Kurallar

- Her faz **ayrı bir sürüm etiketiyle** kapanır (major → ikinci hane artar).
- Faz kapanışı `npm run release:major -- "Faz N — <özet>"` ile yapılır.
- Bir faz, kabul kriterleri sağlanmadan kapanmış sayılmaz.
- Faz 1'den itibaren **hiçbir yeni sorgu `tenantId` filtresi olmadan yazılmaz.**
  Veri erişimi yalnızca `src/lib/tenant-db.ts` üzerinden yapılır.
- Her birleştirme öncesi `npm run kontrol:izolasyon` çalıştırılır ve geçmelidir.

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

### Faz kapanış kontrol listesi

Bir fazı kapatmadan önce hepsi sağlanmalı:

- [ ] Faz bölümündeki tüm çalışma paketleri işaretli
- [ ] Kabul kriterleri tek tek doğrulandı
- [ ] `npm run kontrol:izolasyon` geçiyor
- [ ] `npx tsc --noEmit` ve `npm run build` temiz
- [ ] Bu dosyada faz durumu ✅, "Şu An Neredeyiz" tablosu güncel
- [ ] `CLAUDE.md` içindeki faz tablosu ve sürüm geçmişi güncel
- [ ] `npm run release:major` ile sürüm çıkarıldı

## Faz Özeti

Durum işaretleri: `planlandı` · `🔨 devam ediyor` · `⏸ beklemede` · `✅ tamamlandı`

| Faz | Kapsam | Sürüm | Durum | Sorumlu |
|-----|--------|-------|-------|---------|
| 1  | A1, A2, A3 — Tenant veri modeli, oturum bağlamı, sahiplik doğrulama | `v1.1.0` | ✅ tamamlandı | — |
| 2  | A4 — PostgreSQL'e geçiş + Row-Level Security | `v1.2.0` | planlandı | |
| 3  | A5 — Çapraz kiracı sızıntı testleri | `v1.3.0` | planlandı | |
| 4  | A6, A7, A8 — RBAC, kullanıcı grupları, denetim günlüğü | `v1.4.0` | planlandı | |
| 5  | B1–B7 — Admin panel (tenant/kullanıcı/paket/impersonation/markalama) | `v1.5.0` | planlandı | |
| 6  | C1, C2, C3 — Kişi, Fırsat/Anlaşma, Kanban satış hattı | `v1.6.0` | planlandı | |
| 7  | C4–C7 — Aktivite, Lead, timeline, teklif | `v1.7.0` | planlandı | |
| 8  | D1–D5 — Bildirim, iş akışı, e-posta, takvim | `v1.8.0` | planlandı | |
| 9  | E1, E2, E5 — Dışa/içe aktarım, PDF | `v1.9.0` | planlandı | |
| 10 | E3, E4, E7 — Dashboard, kayıtlı görünüm, yedekleme | `v1.10.0` | planlandı | |
| 11 | E6 — Tenant'a özel alanlar | `v1.11.0` | planlandı | |
| 12 | F1–F4, F7 — Hesap güvenliği ve KVKK | `v1.12.0` | planlandı | |
| 13 | G1–G3 — AI özellikleri | `v1.13.0` | planlandı | |

## Yeni Katılan İçin Hızlı Başlangıç

```bash
npm install
cp .env.example .env            # AUTH_SECRET'i değiştirin
npm run db:migrate              # şemayı uygula
npm run db:seed                 # iki kiracılı demo veri
npm run dev                     # http://localhost:3000
```

Giriş: `admin@gezegen.com` / `admin123` (800 firma) ve
`admin@anadolu.com` / `anadolu123` (120 firma). İki hesapla ayrı ayrı girip
listelerin tamamen ayrı olduğunu görün — projenin temel güvenlik sözü budur.

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
  diğer kiracının verisi görünmez. → `npm run kontrol:izolasyon` (19/19),
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
- [ ] **Postgres'e geçiş**
   - `datasource` provider → `postgresql`; SQLite'a özgü kalıpların gözden geçirilmesi.
   - `docker-compose.yml`'e Postgres servisi + kalıcı volume.
   - Migration'ların Postgres için yeniden üretilmesi.
   - Mevcut SQLite verisinin taşınması için tek seferlik betik.
   - `deploy.sh` ve `.env.example` güncellemesi; yedekleme (`pg_dump`) notu.
- [ ] **Row-Level Security**
   - Tenant içeren her tabloda `ENABLE ROW LEVEL SECURITY`.
   - `USING (tenant_id = current_setting('app.tenant_id')::text)` politikaları.
   - Bağlantı başına `SET LOCAL app.tenant_id` uygulayan Prisma sarmalayıcısı.
   - Uygulama rolünün `BYPASSRLS` yetkisi **olmadığının** doğrulanması.
   - Admin/sistem işlemleri için ayrı, denetlenen rol.

### Kabul kriterleri
- Uygulama Postgres üzerinde eksiksiz çalışır; veri kaybı yok.
- `app.tenant_id` ayarlanmadan yapılan ham sorgu **sıfır satır** döner.
- RLS açıkken sorgu planları `tenant_id` indeksini kullanır (performans kontrolü).

### Not
Bu faz ne kadar geciktirilirse taşıma o kadar pahalılaşır. Canlıda müşteri
varken yapılması durumunda kesinti planı ve veri göçü penceresi gerekir.

---

## Faz 3 — Çapraz Kiracı Sızıntı Testleri (A5) → `v1.3.0`

**Amaç:** İzolasyonun bir daha bozulamayacağını otomatik olarak kanıtlamak.

### Çalışma paketleri
- [ ] **Test altyapısı** (seçilen listede yoktu ama A5 için zorunlu; bu faza dahil edildi)
   - Vitest + test veritabanı (izole Postgres şeması), fixture'lar, CI betiği.
- [ ] **İzolasyon test paketi**
   - İki kiracı + kullanıcıları üreten fixture.
   - Her modül için: liste, detay, oluştur, güncelle, sil → kiracı dışı erişim 404.
   - Rapor ve dashboard toplamlarının kiracı dışı veriyi saymadığı testi.
   - RLS testi: uygulama katmanı atlanarak yapılan sorgu boş döner.
   - Oturum kurcalama testi: JWT'deki `tenantId` değiştirilirse erişim reddedilir.
- [ ] **Regresyon koruması**
   - Yeni sorguların tenant filtresi olmadan eklenmesini yakalayan kontrol.

### Kabul kriterleri
- Test paketi CI'da yeşil; kasıtlı olarak bir filtre kaldırıldığında **kırmızıya döner**
  (testin gerçekten koruduğunun kanıtı).

---

## Faz 4 — Yetkilendirme ve Denetim (A6, A7, A8) → `v1.4.0`

- [ ] **A6 — RBAC**
   - Roller: `platform_admin` (kiracılar üstü), `tenant_admin`, `uye`, `salt_okunur`.
   - `Role` / `Permission` modelleri; modül × işlem (görüntüle/oluştur/düzenle/sil) matrisi.
   - Sunucu tarafı zorlama (`requirePermission`) + arayüzde yetkisiz öğelerin gizlenmesi.
   - **Yetki kontrolü her zaman sunucuda; arayüzdeki gizleme yalnızca kolaylık.**
- [ ] **A7 — Kullanıcı grupları**
   - `Group` modeli, grup↔izin ve kullanıcı↔grup ilişkileri.
   - Etkin izin = rol izinleri ∪ grup izinleri.
   - Toplu atama arayüzü.
- [ ] **A8 — Denetim günlüğü**
   - `AuditLog` modeli: kiracı, kullanıcı, işlem, varlık türü/ID, eski→yeni değer, IP, zaman.
   - Merkezî veri katmanına bağlanır (her yazma otomatik loglanır).
   - Kiracı yöneticisi için filtrelenebilir görüntüleme ekranı.
   - Günlükler uygulama üzerinden **değiştirilemez ve silinemez**.

### Kabul kriterleri
- Salt-okunur kullanıcı, action'ı doğrudan çağırsa bile yazma yapamaz.
- Her yazma işlemi denetim günlüğünde eski/yeni değeriyle görünür.

---

## Faz 5 — Admin Panel (B1–B7) → `v1.5.0`

Yalnızca `platform_admin` erişimli `/admin` alanı.

- [ ] **B1 — Müşteri yönetimi:** tenant ekle/düzenle/askıya al/sil, durum, iletişim bilgileri.
- [ ] **B2 — Kullanıcı yönetimi:** tenant içi kullanıcı ekle, rol/grup ata, pasifleştir, şifre sıfırla.
- [ ] **B3 — Davet akışı:** e-posta daveti, süreli tek kullanımlık token, kullanıcı kendi şifresini belirler.
- [ ] **B4 — Paket ve limitler:** `Plan` modeli; kullanıcı/kayıt limiti, modül açma-kapama; limit aşımında engelleme.
- [ ] **B5 — Impersonation:** "kiracı olarak görüntüle"; oturumda `impersonatedBy` taşınır, tüm oturum denetim günlüğüne yazılır, arayüzde kalıcı uyarı bandı, tek tıkla çıkış.
- [ ] **B6 — Platform metrikleri:** tenant sayısı, aktif kullanıcı, kayıt hacmi, son girişler.
- [ ] **B7 — Tenant markalama:** logo, ana renk, alt alan adı (`musteri.crm.com`) çözümlemesi.

### Kabul kriterleri
- `platform_admin` olmayan bir kullanıcı `/admin` altındaki hiçbir yola erişemez (sunucu tarafı).
- Impersonation ile yapılan her işlem, gerçek yönetici kimliğiyle loglanır.

---

## Faz 6 — Satış Çekirdeği (C1, C2, C3) → `v1.6.0`

- [ ] **C1 — Kişi (Contact):** firma başına çok kişi; ad, unvan, telefon, e-posta, birincil kişi işareti. Mevcut `Firma.yetkiliAd` verisi kişi kaydına taşınır.
- [ ] **C2 — Fırsat/Anlaşma (Deal):** başlık, firma, kişi, tutar, para birimi, aşama, kapanış tarihi, olasılık, sorumlu kullanıcı, kazanıldı/kaybedildi + sebep. Aşamalar kiracı bazında özelleştirilebilir.
- [ ] **C3 — Kanban satış hattı:** sürükle-bırak aşama değiştirme, aşama bazlı toplam tutar, filtre.

---

## Faz 7 — Satış Derinleştirme (C4–C7) → `v1.7.0`

- [ ] **C4 — Aktivite ve görev:** arama/toplantı/not/görev; atama, son tarih, tamamlandı; "bugün yapılacaklar" görünümü.
- [ ] **C5 — Lead yönetimi:** aday kayıt, kaynak, durum; tek tıkla firma + kişi + fırsata dönüştürme.
- [ ] **C6 — Timeline:** firma altında tüm modüllerin kronolojik birleşik akışı.
- [ ] **C7 — Teklif/sözleşme:** kalemler, tutar hesabı, revizyon geçmişi, durum takibi.

---

## Faz 8 — Otomasyon ve İletişim (D1–D5) → `v1.8.0`

- [ ] **D1 — E-posta bildirimleri:** SMTP yapılandırması, şablonlar, kullanıcı bazlı tercih.
- [ ] **D2 — İş akışı otomasyonu:** tetikleyici (durum değişti / tarih yaklaştı) → eylem (görev aç, e-posta gönder, alan güncelle); kiracı bazlı kural tanımı.
- [ ] **D3 — E-posta entegrasyonu:** IMAP/Gmail/Outlook ile iki yönlü senkron; yazışmanın ilgili kayda düşmesi.
- [ ] **D4 — Takvim:** aylık/haftalık görünüm, hatırlatma, `.ics` dışa aktarım.
- [ ] **D5 — Bildirim merkezi:** uygulama içi bildirim listesi, okundu işaretleme.

---

## Faz 9 — Veri Giriş/Çıkış (E1, E2, E5) → `v1.9.0`

- [ ] **E1 — Excel/CSV dışa aktarım:** her liste için, aktif filtreye saygılı.
- [ ] **E2 — Excel/CSV içe aktarım:** dosya yükleme, sütun eşleştirme ekranı, doğrulama ve hata raporu, ön izleme; müşteri devreye alma (onboarding) için kritik.
- [ ] **E5 — PDF rapor çıktısı:** kiracı logosu ile.

---

## Faz 10 — Kişiselleştirme ve Süreklilik (E3, E4, E7) → `v1.10.0`

- [ ] **E3 — Özelleştirilebilir dashboard:** kart seçimi, sıralama, kullanıcı bazlı kayıt.
- [ ] **E4 — Gelişmiş filtre + kayıtlı görünümler:** çoklu kriter, kaydet/paylaş, varsayılan görünüm.
- [ ] **E7 — Yedekleme/geri yükleme:** kiracı bazlı yedek alma ve geri yükleme, zamanlanmış otomatik yedek.

---

## Faz 11 — Kiracıya Özel Alanlar (E6) → `v1.11.0`

- `CustomField` tanımı (varlık, ad, tip, seçenekler, zorunluluk) + `CustomFieldValue`.
- Formlarda, listelerde, filtrelerde ve dışa aktarımda dinamik gösterim.
- Kiracı yöneticisi için alan tanımlama ekranı.

---

## Faz 12 — Hesap Güvenliği ve KVKK (F1–F4, F7) → `v1.12.0`

- [ ] **F1 — Şifre politikası + şifremi unuttum:** minimum karmaşıklık, süreli sıfırlama bağlantısı.
- [ ] **F2 — İki faktörlü doğrulama:** TOTP, yedek kodlar, kiracı bazında zorunlu kılma seçeneği.
- [ ] **F3 — Oturum yönetimi:** aktif oturum listesi, uzaktan sonlandırma, oturum süresi politikası.
- [ ] **F4 — Hız sınırlama:** giriş denemesi sınırı, geçici kilit, brute-force koruması.
- [ ] **F7 — KVKK:** veri saklama süresi, silme/dışa aktarma talebi akışı, aydınlatma metni, açık rıza kaydı.

---

## Faz 13 — AI Özellikleri (G1–G3) → `v1.13.0`

- [ ] **G1 — Lead/fırsat skorlama:** geçmiş kazanma verisinden skor; açıklanabilir gerekçe.
- [ ] **G2 — Otomatik özet:** firma geçmişinin doğal dilde özeti.
- [ ] **G3 — Doğal dilde sorgu:** "İzmir'deki onaylanmış hibeler" → filtrelenmiş liste.

**Kural:** AI çağrıları kiracı verisini kiracı sınırının dışına taşımaz; hangi
verinin modele gönderildiği kiracı yöneticisine açıkça bildirilir ve
kapatılabilir olur.

---

## Planlama Notları

- **A5 (Faz 3) test altyapısı gerektirir.** Seçilen listede F5 yoktu; test
  altyapısı Faz 3'ün ilk paketi olarak dahil edildi, ayrı faz açılmadı.
- **Faz 1 ile Faz 3 arasındaki boşluk:** izolasyon Faz 1'de kurulur ama otomatik
  kanıtı Faz 3'te gelir. Bu aralıkta Faz 1'in elle doğrulama adımları
  (kabul kriterleri) her sürüm öncesi tekrarlanır.
- **Seçilmeyen maddeler:** F5 (Faz 3'e gömüldü), F6 (mobil/PWA), F8 (faturalama).
  İhtiyaç duyulursa sonradan faz eklenebilir.
