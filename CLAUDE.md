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

- **Next.js 15** + React 19 (App Router + Server Actions, `src/app`)
  — güvenlik yamaları 14 hattına gelmediği için 15.5'e geçildi (v1.10.1);
  `package.json` içindeki `overrides` (postcss, sharp, uuid) audit'i sıfır tutar
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
                       # Kisi, Asama, Firsat, Aktivite, Lead,
                       # Teklif, TeklifKalemi, Bildirim, BildirimTercihi,
                       # EpostaAyari, EpostaKuyrugu, EpostaKaydi,
                       # IsAkisi, IsAkisiCalismasi,
                       # PanoTercihi, KayitliGorunum, Yedek,
                       # OzelAlan, OzelAlanDeger, FirmaNoSayac,
                       # Urun, Paket, PaketKalemi, Kampanya(+Urun/Paket/Firma),
                       # KampanyaKullanim, StokHareketi,
                       # Oturum, SifreSifirlama, GirisDenemesi
  migrations/          # prisma migrate deploy ile uygulanır (RLS dahil)
  _sqlite-arsiv/       # Faz 2 öncesi SQLite migration'ları (uygulanmaz)
  seed.ts              # demo veri (800 firma) — üretimde kullanılmaz
  bootstrap.ts         # üretim için ilk kullanıcı oluşturma
src/
  middleware.ts        # JWT doğrulama; yalnızca /login ve /davet açıktır
  app/
    login/             # giriş sayfası + actions
    davet/[token]/     # davet kabul — giriş gerektirmez (Faz 5)
    sifremi-unuttum/   # şifre sıfırlama isteği — giriş gerektirmez (Faz 12)
    sifre-sifirla/[token]/  # yeni şifre belirleme — giriş gerektirmez (Faz 12)
    admin/             # platform yönetimi — yalnızca platform_admin (Faz 5)
                       #   kiracilar/ (liste, detay, yeni), paketler/, page.tsx
    (app)/             # oturum gerektiren panel
      page.tsx         # Genel Bakış (KPI + grafikler + son etkinlikler)
      firmalar/        # liste, detay, yeni, düzenle + actions
      kisiler/         # kişi listesi + actions (Faz 6)
      firsatlar/       # kanban + liste + asamalar/ (Faz 6)
      adaylar/         # lead listesi + dönüştürme (Faz 7)
      teklifler/       # liste, detay, yeni (Faz 7)
      aktiviteler/     # görev ve aktivite akışı (Faz 7)
      bildirimler/     # bildirim merkezi + tercihler (Faz 8)
      takvim/          # aylık ızgara (Faz 8)
      otomasyon/       # iş akışı kuralları + eposta/ ayarları (Faz 8)
      ice-aktar/       # Excel/CSV içe aktarım sihirbazı (Faz 9)
      teklifler/[id]/yazdir/  # PDF çıktı — tarayıcı yazdırma (Faz 9)
      yedekler/        # yedek al/indir/geri yükle — yedek.yonet (Faz 10)
      ozel-alanlar/    # özel alan tanımları — ozelalan.yonet (Faz 11)
      urunler/         # ürün/hizmet kataloğu (Faz 14)
      paketler/        # ürün paketleri, firmaya özel fiyat (Faz 14)
      kampanyalar/     # kampanya tanımı, kota, kullanım raporu (Faz 14)
      stok/            # stok durumu ve hareket defteri (Faz 14)
      kullanicilar/    # kuruluş içi ekip yönetimi + güvenlik politikası (Faz 12)
      guvenlik/        # kişisel hesap güvenliği: şifre, 2FA, oturumlar (Faz 12)
      kvkk/            # aydınlatma metni + açık rıza kaydı (Faz 12)
      pano-actions.ts, gorunum-actions.ts  # kişisel tercih action'ları (Faz 10)
    api/
      gorevler/        # zamanlanmış iş çalıştırıcısı — anahtarla korunur
      takvim.ics/      # takvim dışa aktarımı (oturum gerektirir)
      disa-aktar/      # Excel/CSV dışa aktarımı (izin + denetim) (Faz 9)
      yedek/           # yedek indirme — yedek.yonet + denetim (Faz 10)
      kvkk/verilerim/  # kişisel veri kopyası (KVKK m. 11) (Faz 12)
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
    dashboard/         # kpi-card, chart-card, PanoDuzenle (Faz 10)
    admin/             # KiraciForm, KullaniciSatiri, DavetPanel, PlanPanel, ...
    firsatlar/         # Kanban, FirsatPanel, AsamaPanel (Faz 6)
    aktiviteler/       # AktivitePanel (Faz 7)
    adaylar/           # LeadPanel, DonusturPanel (Faz 7)
    teklifler/         # TeklifForm, TeklifIslemleri (Faz 7)
    bildirimler/       # BildirimListesi, TercihFormu (Faz 8)
    otomasyon/         # KuralPanel, EpostaAyarFormu (Faz 8)
    yedekler/          # YedekPanel (Faz 10)
    ozel-alanlar/      # OzelAlanPanel (Faz 11)
    urunler/           # UrunPanel, PaketPanel, KampanyaPanel, StokPanel,
                       # KullanimPanel (Faz 14)
    guvenlik/          # GuvenlikPanelleri: şifre, 2FA, oturum (Faz 12)
    kvkk/              # KvkkPanelleri: rıza formu, veri indirme (Faz 12)
    ui/ModalKatman     # modalları portala taşır (v1.11.1)
    ui/SecimKutusu     # aramalı tek seçimli açılır kutu (v1.12.1)
    FirmaForm, RecordForm, AddPanel, edit-record-dialog, DeleteButton,
    GorunumBar,         # kayıtlı görünümler (Faz 10)
    OzelAlanGirdileri   # özel alan form girdileri (Faz 11)
  lib/
    auth.ts, session.ts   # oturum ve requireSession
    constants.ts          # durum/tür sabitleri + rozet etiketleri
    tenant-db.ts          # kiracı kapsamlı veri erişimi (ZORUNLU giriş noktası)
    platform-db.ts        # kiracılar ötesi erişim — TEK KAPI (Faz 5)
    davet-db.ts           # davet akışı, oturum öncesi erişim — TEK KAPI (Faz 5)
    kiraci-ayar.ts        # kiracının markası ve paket limitleri (Faz 5)
    timeline.ts           # firma zaman akışı — izin süzgeçli (Faz 7)
    bildirim.ts           # bildirim gönderimi — TEK GİRİŞ (Faz 8)
    eposta.ts             # SMTP gönderimi ve kuyruk (Faz 8)
    eposta-gelen.ts       # IMAP gelen kutusu senkronu (Faz 8)
    is-akisi.ts           # otomasyon motoru (+ -tanimlar.ts saf veri)
    takvim.ts             # takvim öğeleri + .ics (+ -tanimlar: kategori) (Faz 8)
    sifreleme.ts          # AES-256-GCM — posta parolaları (Faz 8)
    zamanlanmis.ts        # oturumsuz zamanlanmış işler — TEK KAPI (Faz 8)
    disa-aktar.ts         # dışa aktarım — TEK KAPI (+ -saf, -tanimlar) (Faz 9)
    ice-aktar.ts          # içe aktarım (+ -saf: ayrıştırma/doğrulama) (Faz 9)
    pano-tanimlar.ts      # pano kart kayıt defteri — saf veri (Faz 10)
    gorunum.ts            # kayıtlı görünümler (+ -tanimlar: sorguTemizle) (Faz 10)
    yedek.ts              # yedekleme (+ -saf: bütün mantık, testler onu sınar) (Faz 10)
    ozel-alan.ts          # kiracıya özel alanlar (+ -tanimlar: doğrulama saf) (Faz 11)
    giris-guvenlik.ts     # giriş güvenliği, oturum ÖNCESİ — TEK KAPI (Faz 12)
    guvenlik-tanimlar.ts  # şifre politikası, kilit, base32 — saf, istemciye de girer
    guvenlik-totp.ts      # TOTP + yedek kod üretimi (node:crypto) (Faz 12)
    iki-faktor.ts         # ikinci aşama bileti, yedek kod yönetimi (Faz 12)
    kvkk-tanimlar.ts      # aydınlatma metni + saklama politikası — saf (Faz 12)
    firma-no-saf.ts       # firma numarası A0001–Z9999 + atomik sayaç (Faz 13)
    arama.ts              # Türkçe duyarsız liste araması — saf (Faz 13)
    tarih-araligi.ts      # rapor tarih aralığı + hazır aralıklar — saf (Faz 13)
    fiyat-saf.ts          # fiyat motoru: liste→paket→kampanya→KDV (Faz 14)
    kampanya.ts           # atomik kota sayacı + kullanım defteri (Faz 14)
    stok.ts               # stok hareket defteri + atomik bakiye (Faz 14)
    urun-tanimlar.ts      # kod normalize, stok durumu — saf (Faz 14)
    rls.ts                # PostgreSQL RLS bağlamları
    yetki-tanimlar.ts     # izin anahtarları + rol matrisi (saf veri)
    yetki.ts              # yetki kontrolü (server-only)
    denetim.ts            # denetim günlüğü yazımı
    db.ts, format.ts, utils.ts, tr-iller.ts, chart-*.ts, version.ts
```

### Veri Modeli

`Tenant` en üsttedir; diğer tüm modeller `tenantId` taşır. Faz 4 ile `Grup`,
`KullaniciGrup` ve `DenetimKaydi`, Faz 5 ile `Plan` ve `Davet`, Faz 6 ile
`Kisi`, `Asama` ve `Firsat`, Faz 7 ile `Aktivite`, `Lead`, `Teklif` ve
`TeklifKalemi`, Faz 8 ile `Bildirim`, `BildirimTercihi`, `EpostaAyari`,
`EpostaKuyrugu`, `EpostaKaydi`, `IsAkisi` ve `IsAkisiCalismasi`, Faz 10 ile
`PanoTercihi`, `KayitliGorunum` ve `Yedek`, Faz 11 ile `OzelAlan` ve
`OzelAlanDeger`, Faz 12 ile `Oturum`, `SifreSifirlama` ve `GirisDenemesi`
eklendi.
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
| Zamanlanmış iş | `src/lib/zamanlanmis.ts` | `GOREV_ANAHTARI` | Cron'un oturumu olamaz (Faz 8) |
| Giriş güvenliği | `src/lib/giris-guvenlik.ts` | herkes (oturum öncesi) | Kilit sayacı ve sıfırlama kimlik doğrulanmadan YAZILIR (Faz 12) |

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

### Satış Derinleştirme (Faz 7)

- **Aktivite tek modeldir.** Not ile görev arasındaki fark ayrı tablo değil,
  `sonTarih` alanının dolu olmasıdır. Timeline'ın tek sorguyla kurulmasını
  sağlayan bilinçli bir tercih.
- **Dönüşen aday silinmez.** Lead firma + kişi (+ fırsat) hâline geldiğinde
  kaydı kalır; nereye dönüştüğü `donusen*` alanlarında saklanır (kaynak
  takibi buna dayanır). Dönüşüm paket firma limitine tabidir.
- **Teklif değiştirilmez, revize edilir.** Revizyon YENİ bir satırdır
  (`ustTeklifId` ile zincire bağlı); eski sürüm dondurulur ve salt okunur olur.
  Gönderilen rakamın kaydı bozulmamalıdır.
- **Tutarlar sunucuda hesaplanır** ve saklanır; formdaki toplam önizlemedir.
- **Timeline izin süzgecinden geçer** (`src/lib/timeline.ts`): izni olmayan
  modül hiç sorgulanmaz.

### Otomasyon ve İletişim (Faz 8)

- **Bildirim tek kapıdan geçer** (`src/lib/bildirim.ts`): kullanıcının
  tercihine bakıp uygulama içi kayda ve/veya e-posta kuyruğuna yazar. Tercih
  kaydı YOKSA varsayılan geçerlidir — yeni bir bildirim türü eklendiğinde
  herkes için satır açmak gerekmez.
- **E-posta anında gönderilmez, kuyruğa yazılır.** Zamanlanmış çalıştırıcı
  gönderir; üç deneme sonunda kayıt "hata" durumunda dondurulur.
- **Kurallar zamanlanmış çalışır** çünkü tetikleyicilerin çoğu olay değil,
  zamanla oluşan bir durumdur. Aynı kayda aynı uyarı iki kez gitmez
  (`IsAkisiCalismasi` kaydına bakılır).
- **Posta parolaları AES-256-GCM ile şifreli saklanır.** Anahtar
  `AUTH_SECRET`'tan türetilir — **AUTH_SECRET değişirse kayıtlı parolalar
  çözülemez** (uygulama çökmez, ayar yeniden girilir).
- **`/api/gorevler` anahtar tanımsızsa KAPALIDIR.** "Tanımsızsa serbest"
  davranışı üretimde açık kapı bırakırdı. Anahtar başlıkta taşınır.
- **Takvimin kendi kaydı yoktur**; var olan kayıtların tarihli hâlidir.
  `.ics` dışa aktarımı oturum gerektirir (token'lı açık akış yok).

### Veri Giriş/Çıkış (Faz 9)

- **Dışa aktarım tek kapıdan geçer** (`src/lib/disa-aktar.ts`): sorgu kiracı
  katmanından, izin veri kümesinin kendi anahtarından gelir; tanımlı olmayan
  küme aktarılamaz. Her aktarım denetim günlüğüne düşer.
- **CSV Türkçe için ayarlıdır:** BOM ile başlar, noktalı virgülle ayırır
  (Excel'in TR yerelinde beklediği). Okurken ayırıcı otomatik seçilir.
- **İçe aktarım üç adımdır** ve yazma yalnızca sonuncudadır: oku →
  sütun eşleştir → **ön izle ve onayla**. Hatalı satır atlanır, aktarım
  düşmez. Aynı adlı firma iki kez açılmaz; yeni firma paket limitine tabidir.
- **PDF tarayıcının yazdırma motoruyla üretilir** — sunucuya PDF kütüphanesi
  ya da headless Chromium eklenmedi. Gerekçe `teklifler/[id]/yazdir` başında
  yazılıdır (Türkçe font + imaj boyutu).
- Ayrıştırma/doğrulama gibi saf işler `-saf.ts` dosyalarındadır; testler
  veritabanı olmadan doğrudan onları sınar.

### Kişiselleştirme ve Süreklilik (Faz 10)

- **Pano kartları kayıt defterinden gelir** (`src/lib/pano-tanimlar.ts`);
  her kartın kendi izni vardır. İzinsiz/seçilmemiş kartın **sorgusu hiç
  çalışmaz**. Yeni kartlar varsayılan düzenin DIŞINDADIR — yükseltme
  kimsenin panosunu değiştirmez.
- **Görünüm = adlandırılmış querystring** (`KayitliGorunum.sorgu`).
  `sorguTemizle` `g`/`sayfa`/biçimsiz anahtarları atar. Varsayılan görünüm
  yönlendirmesi `g=1` işareti taşır — döngü imkânsızdır. Paylaşım kiracı
  içidir.
- **Geri yükleme EKLEYİCİDİR:** yalnızca var olmayan kayıtlar eklenir
  (`skipDuplicates`), mevcutlara dokunulmaz, iki kez çalıştırmak
  zararsızdır. Yedek dosyasında `tenantId` YOKTUR; satırlar geri yüklerken
  oturumun kiracısıyla damgalanır. Kullanıcılar ve denetim günlüğü kapsam
  dışıdır. Gece yedeği zamanlanmış çalıştırıcıya bağlıdır (son 7 saklanır).
- **`yedek.yonet` yalnızca kuruluş yöneticisindedir** ve `yedek` bilinçli
  olarak paket modülü değildir — verinin sürekliliği pazarlık konusu olamaz.
- **Kişisel tercih action'ları** (pano, görünüm) yetki+denetim
  zorunluluğunun belgeli istisnasıdır (`tests/regresyon.test.ts` içindeki
  `KISISEL_TERCIH_DOSYALARI`); kullanıcı yalnızca KENDİ satırını yazar.

### Ticari Çekirdek (Faz 14)

- **Fiyat TEK saf fonksiyondan geçer** (`fiyat-saf.ts`): liste fiyatı →
  firmaya özel paket → kampanya → KDV. Sıra bilinçlidir; paket kampanyadan
  ÖNCE gelir çünkü paket "bu müşterinin fiyatı budur" anlaşmasıdır, kampanya
  onun üzerine yapılan geçici bir jesttir. **KDV indirimli tutar üzerinden**
  hesaplanır.
- **Tek kampanya uygulanır** — müşteriye en avantajlı olan otomatik seçilir,
  kullanıcı isterse değiştirir. Üst üste binen indirimler hem hesabı hem de
  müşteriye yapılan savunmayı imkânsızlaştırır. İstemciden gelen bir kampanya
  id'si ADAYLAR arasında yoksa indirim uygulanmaz.
- **Kota ve stok İKİ AYRI ATOMİK sayaçtır.** İkisi de koşullu `UPDATE … WHERE`
  ile düşer (`kampanya.ts`, `stok.ts`); "oku → kontrol et → yaz" yaklaşımı iki
  temsilcinin son adedi aynı anda satmasına izin verirdi. Kota "bu kampanyadan
  kaç adet verilebilir", stok "elde kaç adet var" sorusunu yanıtlar; bir satış
  ikisini birden düşürür.
- **Bakiye hareketlerin toplamıdır.** `Urun.stokMiktar` bir ÖZETTİR (liste
  sorgularında binlerce hareketi toplamamak için) ve ürün formundan yazılamaz.
  Sayım bakiyeyi ezmez, **FARK kadar** hareket yazar.
- **Defterler silinmez:** kullanılmış kampanya silinemez (durumu "sona erdi"
  yapılır), stok hareketi düzeltilmez (ters hareketle kapatılır), iptal edilen
  kullanım işaretlenir ve kotası iade edilir.
- **Görüntüleme ile tanım ayrı izinlerdir** (`urun.goruntule`/`urun.yonet`,
  `kampanya.goruntule`/`kampanya.yonet`): satış temsilcisi fiyatı görmeli ama
  kendine indirim tanımlayamamalı. `stok.hareket` ayrıdır — depo işi yapan
  kişi katalogu düzenlemeyebilir.
- **`urun`, `kampanya`, `stok` birer paket modülüdür**; hizmet satan bir
  kuruluş katalogu kullanır ama stok tutmaz.

### Arayüz ve Veri Düzeltmeleri (Faz 13)

- **Firma numarası oluşturmada verilir ve DEĞİŞMEZ** (`A0001`–`Z9999`,
  kiracı başına 259.974 kapasite). Sıra `FirmaNoSayac` satırından
  `UPDATE … RETURNING` ile **atomik** alınır — "en büyüğü bul + 1" yarış
  koşuludur. Numara veren dört yol (form, aday dönüşümü, içe aktarım, fırsat
  formu) aynı `siradakiFirmaNo` kapısından geçer. `updateFirma` şeması
  `firmaNo`yu hiç tanımaz, yani formdan gelse bile yok sayılır.
- **Numara dışa aktarılır, içe aktarılamaz** (`saltDisa` sütun bayrağı).
  Geri yüklemede numara korunur; başka kuruluşa yüklenen dosyada çakışan
  numara boşaltılır, kayıt yine eklenir ve sıradaki numarayı alır.
- **Arama Türkçe duyarsızdır** (`src/lib/arama.ts`). `mode: "insensitive"`
  tek başına yetmez: PostgreSQL'in ASCII eşlemesinde `upper('ı') = 'ı'`,
  yani "ısparta" yazan "ISPARTA"yı bulamaz. Çözüm sütunu değil TERİMİ
  çoğaltmaktır — metin Türkçe büyük ve küçük hâlleriyle birlikte aranır.
- **Adaylar satış hattının sekmesidir**, ayrı menü öğesi değil; `/adaylar`
  rotası korunur (kayıtlı görünüm ve bildirim bağlantıları oraya bakar).
  Aynı gerekçeyle "Kontaklar" etiketi `/kisiler` rotasını değiştirmez.
- **Fırsat formundan firma açmak kısa yol değil, aynı kapıdır:** izin, paket
  limiti, firma numarası ve denetim kaydı normal akıştaki gibi uygulanır.
- **Takvim kategori süzgeci sorguyu da kısar** — seçilmeyen kategori hiç
  sorgulanmaz; süzgeç `.ics` çıktısına da yansır.
- **Ters tarih aralığı raporu boşaltmaz.** Başlangıç > bitiş yazıldığında
  süzgeç uygulanmaz: boş rapor kullanıcıya "veri yok" der, oysa sorun
  yazım hatasıdır.

### Kiracıya Özel Alanlar (Faz 11)

- **Değer her zaman String saklanır** (`OzelAlanDeger.deger`); tip (metin/
  sayı/tarih/seçim/onay) yalnızca doğrulama ve gösterimdir. Doğrulama saf
  katmandadır (`ozel-alan-tanimlar.ts`); seçim tipi istemciden geleni
  TANIMDAKİ seçeneklerle karşılaştırır.
- **Kayıt bağlantısı gerçek FK'dir** (firmaId/kisiId/firsatId, tam biri
  dolu): kayıt silinince değerler cascade ile gider — yetim değer olamaz.
  Yeni varlık eklemek şemaya FK eklemeyi gerektirir (bilinçli takas).
- **Tanımlamak yönetim işi (`ozelalan.yonet`), değer yazmak varlık işidir.**
  `ozelalan` bir paket modülüdür; kapatılırsa `alanlariGetir` boş döner ve
  alanlar form/filtre/dışa aktarımdan tek noktadan kaybolur. Migration
  mevcut paketlere modülü ekler — yükseltme özellik kapatmaz.
- **Action deseni:** önce `formdanDegerler` doğrular, sonra ana kayıt, sonra
  `degerleriKaydet`. Tanımsız `oa_*` anahtarları sessizce yok sayılır.
- Seçim tipli firma alanları listede filtredir (`oa_<alanId>` parametresi);
  kayıtlı görünüm ve dışa aktarım bunları kendiliğinden taşır. Yedek
  kapsamında tanım değerden önce gelir.

**2. Veritabanı katmanı (Faz 2)** — PostgreSQL Row-Level Security.
`src/lib/rls.ts` her sorguyu bağlam ayarlanmış bir işleme sarar:

| Bağlam | Kullanım | Yetki |
|--------|----------|-------|
| `app.tenant_id` | `kiraciIstemcisi()` — normal trafik | O kiracının satırları |
| `app.kimlik_dogrulama` | `kimlikIstemcisi()` — yalnızca giriş | User+Tenant, salt okuma |
| `app.yonetim` | `yonetimIstemcisi()` — kurulum betikleri | Tam erişim |
| `app.giris` | `girisIstemcisi()` — yalnızca giriş güvenliği | User, Tenant, Oturum, SifreSifirlama, GirisDenemesi |

Bağlam ayarlanmazsa veritabanı **sıfır satır** döndürür. Yani uygulama
katmanında bir sorgu filtreyi unutsa bile veri sızmaz.

### Doğrulama (ZORUNLU — her geliştirmede)

```bash
npm run dogrula
```

Tip kontrolü + derleme + migration + demo veri + otomatik test paketi (Vitest)
+ HTTP izolasyonu + gerçek tarayıcıyla kimlik ve yetki doğrulaması =
**465 kontrol**.
Sonuç `docs/dogrulama/v<sürüm>.md` dosyasına yazılır ve depoda kalır.
Doğrulama ayrı bir PostgreSQL şeması (`dogrulama`) ve ayrı bir port (3100)
kullanır; geliştirme veritabanınıza dokunmaz.

Tek tek:

```bash
npm test                 # Vitest: izolasyon + RLS + yetki + denetim + regresyon (293 test, ~10 sn)
npm run test:izle        # geliştirirken sürekli koşan hâli
npm run kontrol:e2e      # HTTP (sunucu çalışırken, 14)
npm run kontrol:kimlik   # giriş + yetki + admin + satış, gerçek tarayıcı (sunucu çalışırken, 151)
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
| 7  | Aktivite, Lead, timeline, teklif (C4-C7) | `v1.7.0` | ✅ tamamlandı |
| 8  | Bildirim, iş akışı otomasyonu, e-posta, takvim (D1-D5) | `v1.8.0` | ✅ tamamlandı |
| 9  | Excel/CSV dışa-içe aktarım, PDF (E1, E2, E5) | `v1.9.0` | ✅ tamamlandı |
| 10 | Özelleştirilebilir dashboard, kayıtlı görünüm, yedekleme (E3, E4, E7) | `v1.10.0` | ✅ tamamlandı |
| 11 | Kiracıya özel alanlar (E6) | `v1.11.0` | ✅ tamamlandı |
| 12 | Şifre politikası, 2FA, oturum yönetimi, rate limit, KVKK (F1-F4, F7) | `v1.12.0` | ✅ tamamlandı |
| 13 | Arayüz/veri düzeltmeleri: firma no, filtreler, menü düzeni (H1-H9) | `v1.13.0` | ✅ tamamlandı |
| 14 | Ürün kataloğu, stok, paket, kampanya, fiyat motoru (T1-T8) | `v1.14.0` | ✅ tamamlandı |
| 15 | Sipariş, yönetici onayı, depo/sevkiyat (S1-S6) | `v1.15.0` | planlandı |
| 16 | Proje, destek kaydı, SSS (P1-P4) | `v1.16.0` | planlandı |
| 17 | Dosya/fotoğraf eki, ziyaret ve konum doğrulama (A1-A5) | `v1.17.0` | planlandı |
| 18 | Rapor merkezi, mali raporlar, firma dosyası PDF (R1-R5) | `v1.18.0` | planlandı |
| 19 | Anket tanımı, gönderim, yanıt toplama, rapor (N1-N4) | `v1.19.0` | planlandı |
| 20 | Birleşik çalışma ekranı: komut paleti, yan panel (U1-U4) | `v1.20.0` | planlandı |
| 21 | AI: skorlama, özet, doğal dilde sorgu (G1-G3) | `v1.21.0` | planlandı |

Faz tamamlandıkça bu tablodaki **Durum** sütunu güncellenir.

**Faz 13-20**, ürün ortağının kullanım sonrası bildirdiği 35 bulgudan türedi
(ayrıntı ve kararlar: `docs/ROADMAP.md` → "İKİNCİ TUR"). AI fazı bilinçli
olarak en sona alındı: saha geri bildirimleri günlük kullanımı doğrudan
etkiliyor.

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
- **v1.7.0** — **Faz 7:** Satış derinleştirme. Aktivite/görev ("Bugün"
  görünümü), aday (Lead) yönetimi ve tek işlemle firmaya dönüştürme, firma
  zaman akışı, kalemli ve revizyonlu teklif.
- **v1.8.0** — **Faz 8:** Otomasyon ve iletişim. Bildirim merkezi, kiracı
  bazlı SMTP (şifreli parolalar) ve gönderim kuyruğu, zamanlanmış iş akışı
  kuralları, IMAP gelen kutusu senkronu, takvim ve `.ics` dışa aktarım.
- **v1.9.0** — **Faz 9:** Veri giriş/çıkış. Dokuz liste için Excel/CSV dışa
  aktarım (filtreye saygılı), sütun eşleştirmeli ve ön izlemeli içe aktarım
  sihirbazı, kiracı markalı teklif PDF çıktısı.
- **v1.10.0** — **Faz 10:** Kişiselleştirme ve süreklilik. İzin süzgeçli,
  kullanıcı bazlı özelleştirilebilir pano; beş listede kaydet/paylaş/varsayılan
  destekli kayıtlı görünümler; ekleyici (idempotent) geri yüklemeli kiracı
  yedekleri, gece otomatik yedeği ve dosya indirme/yükleme.
- **v1.10.1** — Güvenlik yükseltmesi: Next.js 14.2.15 → 15.5.23 + React 19
  (14 hattına yama gelmeyen kritik/yüksek açıklar: Server Action DoS/SSRF,
  önbellek zehirlenmesi, uç nokta ifşası). recharts 3, next-themes 0.4;
  postcss/sharp/uuid `overrides` ile yamalı. `npm audit`: 0 açık.
- **v1.11.0** — **Faz 11:** Kiracıya özel alanlar. Firma/kişi/fırsat için
  beş tipli (metin, sayı, tarih, seçim, onay) alan tanımlama ekranı;
  formlarda ve detaylarda dinamik gösterim, seçim tipli firma alanlarında
  liste filtresi; kayıtlı görünüm, dışa aktarım ve yedek bütünleşmesi.
  Değerler gerçek FK ile bağlı — kayıt silinince cascade ile temizlenir.
- **v1.11.1** — Kullanıcı geri bildirimi düzeltmeleri: zaman akışı kronolojik
  (en eski üstte); kart içinden açılan modallar portala taşındı (`.card`
  backdrop-filter'ı fixed konumu hapsediyordu — `ModalKatman`); kanban
  sütunları ekrana yayılır; menüde "Yönetim" bölümü ve `/kullanicilar`
  ekranı (kuruluş yöneticisi kendi ekibini davet eder, rol/durum/şifre
  yönetir; platform rolü kiracı içinden verilemez).
- **v1.12.0** — **Faz 12:** Hesap güvenliği ve KVKK. Tek merkezli şifre
  politikası ve e-postayla şifre sıfırlama; TOTP tabanlı iki faktörlü
  doğrulama (yedek kodlar, kuruluş bazında zorunlu kılma); sunucu tarafı
  oturum kaydı ve uzaktan sonlandırma; IP + hesap bazlı hız sınırlama ve
  geçici kilit; sürümlü KVKK aydınlatma metni, açık rıza kaydı, saklama
  süresi temizliği ve kişisel veri kopyası. Dördüncü dar kapı:
  `giris-guvenlik.ts` (`app.giris` bağlamı).
- **v1.12.1** — Kişi kaydına **departman** alanı: 40 seçenekli SABİT listeden
  (`DEPARTMANLAR`) aramalı açılır kutuyla seçilir, elle yazılamaz. Serbest
  metin olsaydı aynı departman farklı yazımlarla kaydolur ve gruplama
  anlamsızlaşırdı; unvan serbest kalır. Kişiler listesinde ve firma detayında
  sütun, aramada ve dışa aktarımda alan olarak yer alır.
- **v1.12.2** — KVKK aydınlatma metnine **"Saha çalışması ve konum verisi"**
  bölümü; aktarım (harita hizmeti) ve saklama bölümleri genişletildi. Metin
  sürümü `2026-08-2` → herkesten yeniden rıza istenir. Faz 17 (konum
  doğrulama) başlamadan önce rızanın toplanmış olması için ÖNDEN yapıldı;
  metnin verdiği sözler o fazın uygulamasını bağlar. Ayrıca yol haritası:
  saha geri bildirimlerinden Faz 13-20, AI en sona (Faz 21).
- **v1.13.0** — **Faz 13:** Arayüz ve veri düzeltmeleri (ortağın 9 bulgusu).
  Firmalara değiştirilemez firma numarası (`A0001`–`Z9999`, kiracı başına
  atomik sayaç); bütün liste aramalarında Türkçe büyük/küçük harf
  duyarsızlığı; "Kişiler" → **Kontaklar** ve menüde Raporlar'ın altına;
  Adaylar satış hattının üçüncü sekmesi; fırsat formundan yerinde firma
  açma; fırsattan tek tıkla teklif hazırlama ve fırsata bağlı teklif sayısı;
  takvimde tıklanabilir kategori süzgeci (`.ics`'e de yansır); raporlarda
  tarih aralığı ve hazır dönemler (bu ay / geçen ay / bu çeyrek / bu yıl).
- **v1.14.0** — **Faz 14:** Ticari çekirdek. Ürün/hizmet kataloğu (kod, birim,
  liste fiyatı, KDV, stok takibi bayrağı); müşteriye özel ürün paketleri
  (sabit fiyat ya da iskonto, liste değerine orantılı dağıtım); kampanya
  tanımı (dört tip, kapsam, durum akışı, **atomik kota**); kampanya kullanım
  defteri ve raporu; tek saf fonksiyonlu fiyat motoru; hareket defterine
  dayalı gerçek stok takibi, sayım farkı ve kritik seviye uyarısı.
- **v1.11.2** — Arayüz: sol menü sıkılaştırıldı (13px, dar dikey aralık) ve
  taşarsa kaydırılabilir; kanban sütunları daraltıldı (min 196px) ve sayfa
  dolgusuna taşarak tam genişliğe yayılır — beş sütunlu varsayılan hat 13"
  ekrana kaydırmasız sığar.
