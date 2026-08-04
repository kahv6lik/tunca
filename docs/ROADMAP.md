# Gezegen CRM — Geliştirme Yol Haritası

Hedef ürün: **uzak sunucuda çalışan, çok kiracılı (multi-tenant) SaaS CRM.**
Tek uygulama üzerinden birden çok müşteriye hizmet verilir. Her müşteri yalnızca
kendi kiracısındaki (tenant) veriyi görür, düzenler ve yönetir. Müşteriler
birbirlerinin varlığından dahi haberdar olmaz. Platform sahibi, ayrı bir admin
paneli üzerinden müşterileri, kullanıcıları ve yetkileri yönetir.

## Genel Kurallar

- Her faz **ayrı bir sürüm etiketiyle** kapanır (major → ikinci hane artar).
- Faz kapanışı `npm run release:major -- "Faz N — <özet>"` ile yapılır.
- Bir faz, kabul kriterleri sağlanmadan kapanmış sayılmaz.
- Faz 1'den itibaren **hiçbir yeni sorgu `tenantId` filtresi olmadan yazılmaz.**

## Faz Özeti

| Faz | Kapsam | Sürüm | Durum |
|-----|--------|-------|-------|
| 1  | A1, A2, A3 — Tenant veri modeli, oturum bağlamı, sahiplik doğrulama | `v1.1.0` | ✅ tamamlandı |
| 2  | A4 — PostgreSQL'e geçiş + Row-Level Security | `v1.2.0` | planlandı |
| 3  | A5 — Çapraz kiracı sızıntı testleri | `v1.3.0` | planlandı |
| 4  | A6, A7, A8 — RBAC, kullanıcı grupları, denetim günlüğü | `v1.4.0` | planlandı |
| 5  | B1–B7 — Admin panel (tenant/kullanıcı/paket/impersonation/markalama) | `v1.5.0` | planlandı |
| 6  | C1, C2, C3 — Kişi, Fırsat/Anlaşma, Kanban satış hattı | `v1.6.0` | planlandı |
| 7  | C4–C7 — Aktivite, Lead, timeline, teklif | `v1.7.0` | planlandı |
| 8  | D1–D5 — Bildirim, iş akışı, e-posta, takvim | `v1.8.0` | planlandı |
| 9  | E1, E2, E5 — Dışa/içe aktarım, PDF | `v1.9.0` | planlandı |
| 10 | E3, E4, E7 — Dashboard, kayıtlı görünüm, yedekleme | `v1.10.0` | planlandı |
| 11 | E6 — Tenant'a özel alanlar | `v1.11.0` | planlandı |
| 12 | F1–F4, F7 — Hesap güvenliği ve KVKK | `v1.12.0` | planlandı |
| 13 | G1–G3 — AI özellikleri | `v1.13.0` | planlandı |

---

## Faz 1 — Çok Kiracılılık Temeli (A1, A2, A3) → `v1.1.0`

**Amaç:** Uygulamayı tek kiracılıdan çok kiracılıya taşımak. Bu fazdan sonra
veri, uygulama katmanında kiracı bazında izole olur.

### Çalışma paketleri

1. **A1 — Tenant veri modeli**
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

2. **A2 — Oturumda kiracı bağlamı**
   - `SessionPayload`'a `tenantId` ve `tenantSlug` eklenir (`src/lib/session.ts`).
   - Giriş akışı kiracıyı çözer (`src/app/login/actions.ts`).
   - **Merkezî kiracı kapsamlı veri erişimi:** `src/lib/tenant-db.ts` —
     oturumdaki `tenantId`'yi otomatik uygulayan tek giriş noktası. Sayfalar ve
     action'lar `prisma`'yı doğrudan çağırmayı bırakır.
   - Kiracısı askıya alınmış kullanıcı girişte reddedilir.

3. **A3 — Sahiplik doğrulaması**
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
1. **Postgres'e geçiş**
   - `datasource` provider → `postgresql`; SQLite'a özgü kalıpların gözden geçirilmesi.
   - `docker-compose.yml`'e Postgres servisi + kalıcı volume.
   - Migration'ların Postgres için yeniden üretilmesi.
   - Mevcut SQLite verisinin taşınması için tek seferlik betik.
   - `deploy.sh` ve `.env.example` güncellemesi; yedekleme (`pg_dump`) notu.
2. **Row-Level Security**
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
1. **Test altyapısı** (seçilen listede yoktu ama A5 için zorunlu; bu faza dahil edildi)
   - Vitest + test veritabanı (izole Postgres şeması), fixture'lar, CI betiği.
2. **İzolasyon test paketi**
   - İki kiracı + kullanıcıları üreten fixture.
   - Her modül için: liste, detay, oluştur, güncelle, sil → kiracı dışı erişim 404.
   - Rapor ve dashboard toplamlarının kiracı dışı veriyi saymadığı testi.
   - RLS testi: uygulama katmanı atlanarak yapılan sorgu boş döner.
   - Oturum kurcalama testi: JWT'deki `tenantId` değiştirilirse erişim reddedilir.
3. **Regresyon koruması**
   - Yeni sorguların tenant filtresi olmadan eklenmesini yakalayan kontrol.

### Kabul kriterleri
- Test paketi CI'da yeşil; kasıtlı olarak bir filtre kaldırıldığında **kırmızıya döner**
  (testin gerçekten koruduğunun kanıtı).

---

## Faz 4 — Yetkilendirme ve Denetim (A6, A7, A8) → `v1.4.0`

1. **A6 — RBAC**
   - Roller: `platform_admin` (kiracılar üstü), `tenant_admin`, `uye`, `salt_okunur`.
   - `Role` / `Permission` modelleri; modül × işlem (görüntüle/oluştur/düzenle/sil) matrisi.
   - Sunucu tarafı zorlama (`requirePermission`) + arayüzde yetkisiz öğelerin gizlenmesi.
   - **Yetki kontrolü her zaman sunucuda; arayüzdeki gizleme yalnızca kolaylık.**
2. **A7 — Kullanıcı grupları**
   - `Group` modeli, grup↔izin ve kullanıcı↔grup ilişkileri.
   - Etkin izin = rol izinleri ∪ grup izinleri.
   - Toplu atama arayüzü.
3. **A8 — Denetim günlüğü**
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

1. **B1 — Müşteri yönetimi:** tenant ekle/düzenle/askıya al/sil, durum, iletişim bilgileri.
2. **B2 — Kullanıcı yönetimi:** tenant içi kullanıcı ekle, rol/grup ata, pasifleştir, şifre sıfırla.
3. **B3 — Davet akışı:** e-posta daveti, süreli tek kullanımlık token, kullanıcı kendi şifresini belirler.
4. **B4 — Paket ve limitler:** `Plan` modeli; kullanıcı/kayıt limiti, modül açma-kapama; limit aşımında engelleme.
5. **B5 — Impersonation:** "kiracı olarak görüntüle"; oturumda `impersonatedBy` taşınır, tüm oturum denetim günlüğüne yazılır, arayüzde kalıcı uyarı bandı, tek tıkla çıkış.
6. **B6 — Platform metrikleri:** tenant sayısı, aktif kullanıcı, kayıt hacmi, son girişler.
7. **B7 — Tenant markalama:** logo, ana renk, alt alan adı (`musteri.crm.com`) çözümlemesi.

### Kabul kriterleri
- `platform_admin` olmayan bir kullanıcı `/admin` altındaki hiçbir yola erişemez (sunucu tarafı).
- Impersonation ile yapılan her işlem, gerçek yönetici kimliğiyle loglanır.

---

## Faz 6 — Satış Çekirdeği (C1, C2, C3) → `v1.6.0`

1. **C1 — Kişi (Contact):** firma başına çok kişi; ad, unvan, telefon, e-posta, birincil kişi işareti. Mevcut `Firma.yetkiliAd` verisi kişi kaydına taşınır.
2. **C2 — Fırsat/Anlaşma (Deal):** başlık, firma, kişi, tutar, para birimi, aşama, kapanış tarihi, olasılık, sorumlu kullanıcı, kazanıldı/kaybedildi + sebep. Aşamalar kiracı bazında özelleştirilebilir.
3. **C3 — Kanban satış hattı:** sürükle-bırak aşama değiştirme, aşama bazlı toplam tutar, filtre.

---

## Faz 7 — Satış Derinleştirme (C4–C7) → `v1.7.0`

4. **C4 — Aktivite ve görev:** arama/toplantı/not/görev; atama, son tarih, tamamlandı; "bugün yapılacaklar" görünümü.
5. **C5 — Lead yönetimi:** aday kayıt, kaynak, durum; tek tıkla firma + kişi + fırsata dönüştürme.
6. **C6 — Timeline:** firma altında tüm modüllerin kronolojik birleşik akışı.
7. **C7 — Teklif/sözleşme:** kalemler, tutar hesabı, revizyon geçmişi, durum takibi.

---

## Faz 8 — Otomasyon ve İletişim (D1–D5) → `v1.8.0`

1. **D1 — E-posta bildirimleri:** SMTP yapılandırması, şablonlar, kullanıcı bazlı tercih.
2. **D2 — İş akışı otomasyonu:** tetikleyici (durum değişti / tarih yaklaştı) → eylem (görev aç, e-posta gönder, alan güncelle); kiracı bazlı kural tanımı.
3. **D3 — E-posta entegrasyonu:** IMAP/Gmail/Outlook ile iki yönlü senkron; yazışmanın ilgili kayda düşmesi.
4. **D4 — Takvim:** aylık/haftalık görünüm, hatırlatma, `.ics` dışa aktarım.
5. **D5 — Bildirim merkezi:** uygulama içi bildirim listesi, okundu işaretleme.

---

## Faz 9 — Veri Giriş/Çıkış (E1, E2, E5) → `v1.9.0`

1. **E1 — Excel/CSV dışa aktarım:** her liste için, aktif filtreye saygılı.
2. **E2 — Excel/CSV içe aktarım:** dosya yükleme, sütun eşleştirme ekranı, doğrulama ve hata raporu, ön izleme; müşteri devreye alma (onboarding) için kritik.
3. **E5 — PDF rapor çıktısı:** kiracı logosu ile.

---

## Faz 10 — Kişiselleştirme ve Süreklilik (E3, E4, E7) → `v1.10.0`

1. **E3 — Özelleştirilebilir dashboard:** kart seçimi, sıralama, kullanıcı bazlı kayıt.
2. **E4 — Gelişmiş filtre + kayıtlı görünümler:** çoklu kriter, kaydet/paylaş, varsayılan görünüm.
3. **E7 — Yedekleme/geri yükleme:** kiracı bazlı yedek alma ve geri yükleme, zamanlanmış otomatik yedek.

---

## Faz 11 — Kiracıya Özel Alanlar (E6) → `v1.11.0`

- `CustomField` tanımı (varlık, ad, tip, seçenekler, zorunluluk) + `CustomFieldValue`.
- Formlarda, listelerde, filtrelerde ve dışa aktarımda dinamik gösterim.
- Kiracı yöneticisi için alan tanımlama ekranı.

---

## Faz 12 — Hesap Güvenliği ve KVKK (F1–F4, F7) → `v1.12.0`

1. **F1 — Şifre politikası + şifremi unuttum:** minimum karmaşıklık, süreli sıfırlama bağlantısı.
2. **F2 — İki faktörlü doğrulama:** TOTP, yedek kodlar, kiracı bazında zorunlu kılma seçeneği.
3. **F3 — Oturum yönetimi:** aktif oturum listesi, uzaktan sonlandırma, oturum süresi politikası.
4. **F4 — Hız sınırlama:** giriş denemesi sınırı, geçici kilit, brute-force koruması.
5. **F7 — KVKK:** veri saklama süresi, silme/dışa aktarma talebi akışı, aydınlatma metni, açık rıza kaydı.

---

## Faz 13 — AI Özellikleri (G1–G3) → `v1.13.0`

1. **G1 — Lead/fırsat skorlama:** geçmiş kazanma verisinden skor; açıklanabilir gerekçe.
2. **G2 — Otomatik özet:** firma geçmişinin doğal dilde özeti.
3. **G3 — Doğal dilde sorgu:** "İzmir'deki onaylanmış hibeler" → filtrelenmiş liste.

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
