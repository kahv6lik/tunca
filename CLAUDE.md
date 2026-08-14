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
                       # Siparis, SiparisKalemi, Sevkiyat, BelgeSayac,
                       # Proje, DestekKaydi, Sss, Dosya, Ziyaret,
                       # Anket, AnketSorusu, AnketGonderim, AnketYanit,
                       # Oturum, SifreSifirlama, GirisDenemesi,
                       # AiKullanim
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
    anket/[token]/     # anket yanıtlama — GİRİŞ GEREKTİRMEZ (Faz 19)
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
      siparisler/      # sipariş, onay/ret, tekliften sipariş (Faz 15)
      sevkiyat/        # sevkiyat kuyruğu ve raporu (Faz 15)
      projeler/        # proje listesi ve detayı (Faz 16)
      destek/          # destek kaydı, işlem geçmişi, rapor/ (Faz 16)
      sss/             # SSS / bilgi bankası (Faz 16)
      ziyaretler/      # saha ziyareti, süre, konum doğrulama (Faz 17)
      anketler/        # anket tanımı, gönderim, sonuç raporu (Faz 19)
      raporlar/        # rapor MERKEZİ + genel/ mali/ satis/ urun/ aktivite/
      firmalar/[id]/   # firma ÇALIŞMA EKRANI — sekmeli (?sekme=) (Faz 20)
      firmalar/[id]/dosya/  # firma dosyası — tek belge PDF (Faz 18)
      ai/              # AI ayarı + kullanım defteri (Faz 21)
      ai-actions.ts    # firma özeti + doğal dilde sorgu action'ları (Faz 21)
      dosya-actions.ts # dosya eki yükleme/silme — tek action (Faz 17)
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
      dosya/           # dosya eki indirme — izin + kiracı süzgeci (Faz 17)
      yatirim-destekleri/
      egitimler/
      hizmetler/
      arama/           # komut paleti araması — izin süzgeçli (Faz 20)
      ozet/            # yan panel özeti — izin süzgeçli (Faz 20)
      raporlar/        # durum/tür/il/sektör dağılımları
      gruplar/         # kullanıcı grupları ve izinleri (Faz 4)
      denetim/         # denetim günlüğü — salt okunur (Faz 4)
      yetkisiz/        # yetkisiz erişim bilgilendirmesi
      layout.tsx       # Sidebar + Topbar kabuğu
  components/
    ui/                # button, card, badge, pagination, skeleton, ...
    layout/            # sidebar, topbar, mobile-nav, theme-toggle, user-menu,
                       # BolumSekmeleri (bölüm sekme çubuğu, v1.22.0)
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
                       # KullanimPanel (Faz 14), PaketSecici (v1.25.0)
    siparisler/        # SiparisForm, OnayPanel, SevkiyatPanel,
                       # DurumDugmeleri (Faz 15)
    projeler/          # ProjePanel (Faz 16)
    destek/            # DestekPanel, IslemFormu, OncelikRozet,
                       # DestekDurumDugmeleri (Faz 16)
    sss/               # SssPanel, SssKarti (Faz 16)
    ekler/             # EkPaneli, EkAcilir (Faz 17)
    ziyaretler/        # ZiyaretBaslat, ZiyaretBitir (Faz 17)
    raporlar/          # RaporSuzgeci — ortak süzgeç çubuğu (Faz 18)
    anketler/          # AnketPanel, SoruFormu, GonderimPanel, YanitFormu
    palet/             # KomutPaleti — Ctrl/Cmd+K (Faz 20)
    panel/             # YanPanel, PanelBaglantisi, OzetDugmesi (Faz 20)
    zincir/            # ZincirSeridi — fırsat→teklif→sipariş→sevkiyat (Faz 20)
    ai/                # SkorRozet, FirmaOzetPaneli, AiAyarPanel (Faz 21)
    guvenlik/          # GuvenlikPanelleri: şifre, 2FA, oturum (Faz 12)
    kvkk/              # KvkkPanelleri: rıza formu, veri indirme (Faz 12)
    ui/ModalKatman     # modalları portala taşır (v1.11.1); merkez düzen ve
                       # sürükleme-kapatma koruması (v1.26.0)
    ui/CamKatmanlari   # liquid glass beş katmanı (v1.24.0)
    ui/CamFiltre       # SVG kırılma filtresi — kabukta TEK örnek
    ui/CamParlama      # imleci izleyen parlama — tek dinleyici
    ui/SecimKutusu     # aramalı tek seçimli açılır kutu (v1.12.1)
    ui/CokluSecim      # onay kutulu çoklu seçim + sayaç + tümünü seç (v1.25.1)
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
    paket.ts              # paket kataloğu — satışa açık paketler (v1.25.0)
    kampanya.ts           # atomik kota sayacı + kullanım defteri (Faz 14)
    stok.ts               # stok hareket defteri + atomik bakiye (Faz 14)
    urun-tanimlar.ts      # kod normalize, stok durumu — saf (Faz 14)
    siparis.ts            # onay akışı + sevkiyat kapısı + belge no (Faz 15)
    destek-tanimlar.ts    # durum damgaları + çözüm süresi + özet — saf (Faz 16)
    sss-tanimlar.ts       # etiket/kategori normalize — saf (Faz 16)
    dosya.ts              # dosya deposu — TEK KAPI (+ -tanimlar: tür/kota saf)
    anket-db.ts           # anket yanıtlama, oturumsuz — TEK KAPI (Faz 19)
    anket-tanimlar.ts     # soru tipleri, yanıt doğrulama, NPS — saf (Faz 19)
    ai-tanimlar.ts        # AI kapıları + gönderilen/gönderilmeyen listesi — saf
    ai.ts                 # dil modeli çağrısı — TEK KAPI, anahtarsızsa KAPALI
    skor-saf.ts           # fırsat/aday skoru — saf istatistik, dış çağrı YOK
    skor.ts               # skor tabanı (kiracının kendi geçmişi) (Faz 21)
    firma-ozet-saf.ts     # firma özeti cümleleri + model istemi — saf (Faz 21)
    firma-ozet.ts         # özet girdisi — izin süzgeçli (Faz 21)
    sorgu-saf.ts          # doğal dilde sorgu: kural ayrıştırıcı + beyaz liste
    bolum-tanimlar.ts     # sol menü bölümleri + sekme çubuğu — saf (v1.22.0)
    arama-tanimlar.ts     # arama/eylem kayıt defteri + panel adresi — saf (Faz 20)
    firma-sekme-tanimlar.ts # firma çalışma ekranı sekmeleri — saf (Faz 20)
    zincir-tanimlar.ts    # kayıt zinciri sırası — saf (Faz 20)
    zincir.ts             # zinciri kurar — izin süzgeçli (Faz 20)
    rapor-tanimlar.ts     # rapor kayıt defteri — saf veri (Faz 18)
    rapor-saf.ts          # ciro, dönüşüm, dönem farkı, kırılım — saf (Faz 18)
    konum-saf.ts          # mesafe, doğrulama, süre, adres — saf (Faz 17)
    geocode.ts            # adresten koordinat — anahtar yoksa KAPALI (Faz 17)
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
`OzelAlanDeger`, Faz 12 ile `Oturum`, `SifreSifirlama` ve `GirisDenemesi`, Faz 16 ile `Proje`,
`DestekKaydi` ve `Sss`, Faz 17 ile `Dosya` ve `Ziyaret`, Faz 19 ile `Anket`, `AnketSorusu`,
`AnketGonderim` ve `AnketYanit` eklendi.
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
| Anket yanıtlama | `src/lib/anket-db.ts` | token sahibi | Anketi dolduran müşteri, uygulamanın kullanıcısı DEĞİLDİR (Faz 19) |

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
- **ÜRÜN VE PAKET KAPSAMI TEK KAPSAMDIR** (v1.26.1): ikisi de boşsa kampanya
  her kaleme açıktır; biri doluysa satır ya o ürünlerden biri olmalı YA DA o
  paketlerden birinden açılmış olmalıdır. `paketIdler` v1.25.0'a kadar
  SORULAMIYORDU (satırın hangi paketten geldiği bilinmiyordu) ve bu yüzden
  `kampanyaGecerliMi` içinde hiç okunmuyordu; sonuç, paketten açılan satırlara
  kampanya uygulanmaması ve ONAYDA KOTANIN DÜŞMEMESİYDİ — kota yalnızca
  UYGULANAN kampanya için düşer.
- **Tek kampanya uygulanır** — müşteriye en avantajlı olan otomatik seçilir,
  kullanıcı isterse değiştirir. Üst üste binen indirimler hem hesabı hem de
  müşteriye yapılan savunmayı imkânsızlaştırır. İstemciden gelen bir kampanya
  id'si ADAYLAR arasında yoksa indirim uygulanmaz.
- **KOTA ONAYDA DÜŞER, OLUŞTURMADA DEĞİL** (Faz 15) — reddedilen sipariş
  kotayı boşuna tüketmemeli. Ekran bunu SÖYLEMELİDİR (v1.27.1): kampanya
  kartı onay bekleyen hakları "(+N onay bekliyor)" olarak ayrıca gösterir ve
  sipariş formu "hak onaylandığında düşer" yazar. Bekleyen sayaca
  KARIŞTIRILMAZ; `kullanilan` hâlâ yalnızca gerçekten düşüleni anlatır.
  Bekleyen de `kotaKullanimlari` ile sayılır — onayla aynı kural, yoksa
  rakam onaydan sonra sıçrardı.
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

### Paket Bir Bütündür (v1.27.0)

- **SATIRLAR KALIR, FİYAT PAKET DÜZEYİNDEN GELİR.** v1.25.0 paketi satırlara
  açtı (stok için doğruydu) ama fiyatı da satır satır hesapladı; "paket
  fiyatı 1000 TL" kampanyası iki ürünlü bir pakette 2×1000 oldu. Artık aynı
  `paketId`yi taşıyan satırlar TEK GRUPTUR: `paketGrubuHesapla` paketin
  bedelini hesaplar, kampanyayı bir kez uygular ve indirimi satırlara BRÜT
  PAYIYLA dağıtır (kuruş artığı son satırda kapanır).
- **KAMPANYA PAKETİ BİRİM KABUL EDER:** `kampanyaIndirimi`'ne "birim fiyat"
  olarak PAKETİN bedeli, "miktar" olarak PAKET ADEDİ verilir. Yeni indirim
  matematiği yazılmadı; bütün tipler kendiliğinden doğru anlama gelir
  (`paketfiyat` = bir paketin fiyatı, `alnodem` = "3 paket al 2 öde").
- **`paketAdedi` AYRI BİR ALANDIR**, `miktar`dan türetilmez: `miktar` ürün
  adedidir (stok onu düşer), kota ise PAKET sayar. Bölerek türetmek,
  kullanıcı satır miktarını elle değiştirdiğinde yanlış cevap verirdi.
- **KOTA PAKET SAYAR** (`kotaKullanimlari`, saf): iki ürünlü paketten 1 adet
  satmak 1 hak düşer, 2 değil. Onay ve iptal AYNI fonksiyondan geçer —
  ayrışsalardı kota her iptalde sessizce kayardı.
- **AYNI PAKET İKİNCİ KEZ EKLENİRSE ADEDİ ARTAR**, satır çoğalmaz; ayrı grup
  olsaydı kampanya iki kez uygulanırdı.
- **ÜRÜN SATIRI DEĞİŞMEDİ:** pakete ait olmayan kalemler eskisi gibi kendi
  miktarı, iskontosu ve kampanyasıyla çalışır.
- **HER GİRDİDE `name` ŞART** (v1.27.2): paket grubundaki birim fiyat alanına
  `name` konmadığı için alan forma hiç gönderilmedi ve sipariş ₺0 kaydedildi.
  Önizleme doğru görünüyordu — hata yalnızca GÖNDERİMDE vardı. Regresyon
  testi artık action'ın okuduğu her alan adını koddan çıkarıp formda arar.

### Paketin Satışa Bağlanması (v1.25.0)

- **PAKET TEK SATIR DEĞİL, KALEMLERİNE AÇILIR.** Paket Faz 14'te
  tanımlanabiliyordu ama hiçbir satışa bağlı DEĞİLDİ (`paketBirimFiyati`
  yalnızca `/paketler` önizlemesinde çağrılıyordu, `SiparisKalemi.paketId`
  hiç yazılmıyordu, teklifte sütun bile yoktu). Artık "Paketten kalem ekle"
  paketi satırlara açar: her ürün KENDİ satırıdır. Tek opak satır olsaydı
  satırın `urunId`'si boş kalırdı ve onay anındaki stok düşümü SESSİZCE hiç
  çalışmazdı — paket satılır, depodan hiçbir şey düşmezdi.
- **`paketId` BİR DAMGADIR, BİR ALAN DEĞİL:** "bu birim fiyat neden liste
  fiyatından farklı?" sorusunun yanıtıdır ve satırda GÖRÜNÜR. Kullanıcı
  fiyatı ya da miktarı sonradan değiştirebilir; satır sıradanlaşır ama damga
  kalır. Ürün değişirse damga düşer (iddia yalan olurdu).
- **DAMGA SUNUCUDA DOĞRULANIR** (`paketDamgasiGecerliMi`): paket katalogda
  olmalı, belgenin firmasına açık olmalı ve satırın ürünü paketin içinde
  bulunmalıdır. Uydurma damga SESSİZCE düşer — satır geçerli kalır, yalnızca
  iddia kaydedilmez.
- **KATALOG KAPSAMIYLA VERİLİR, SÜZME İSTEMCİDE** (kampanyadaki gerekçe).
  Firma seçilmemişken yalnızca GENEL paketler listelenir; seçici liste boşken
  de çizilir ve sebebini yazar.
- **TEKLİF DE BAĞLIDIR** (`TeklifKalemi.paketId`): yoksa paketli teklif
  siparişe dönerken damga kaybolurdu. Revizyon kopyası da ürün/paket/kampanya
  bağlarını taşır.

### Sipariş, Onay ve Sevkiyat (Faz 15)

- **AKIŞIN SÖZÜ:** sevkiyat YALNIZCA onaylanmış siparişten doğar ve depo
  bildirimi de yalnızca onay anında gönderilir. Kural tek kapıdadır
  (`sevkiyatAcilabilirMi`) ve izinle değil VERİYLE korunur — depo yetkisi
  olan kullanıcı bile onaysız siparişe sevkiyat açamaz.
- **Onay ayrı izindir** (`siparis.onayla`, üyede YOK): siparişi giren kişi
  kendi siparişini onaylayamaz. Onay bir durum alanı değil, yetki ayrımıdır.
- **Onay atomiktir:** stok önce toptan kontrol edilir, sonra satır satır
  atomik düşülür; bir satır yarı yolda düşerse o ana kadar düşülenler ters
  hareketle İADE EDİLİR ve onay reddedilir. Sipariş onaylanmadıysa stok da
  düşmemiş olur.
- **Onaylanmış sipariş düzenlenemez ve silinemez** — onaylanan rakam stok ve
  kota düşümünün dayandığı rakamdır. Değişiklik gerekiyorsa iptal edilip
  yenisi açılır; iptal stoğu iade HAREKETİYLE geri verir. **Sevk edilmiş
  sipariş iptal edilemez** (mal yola çıkmıştır).
- **Belge numarası yıl bazında atomik sayaçtan** gelir (`SIP-2026-0001`);
  `BelgeSayac` firma numarasındaki desenin aynısıdır.
- **Kabul edilen tekliften tek tuşla sipariş** açılır; kalemler teklifin
  kalemlerinden hazır gelir.

### Proje, Destek ve Bilgi Bankası (Faz 16)

- **Destek kaydı ayrı modeldir, işlem geçmişi AKTİVİTEDİR.** `DestekKaydi`
  sahibi, önceliği ve durumu olan bir iştir; yapılan işlemler ise
  `Aktivite.destekId` ile aktivite satırı olarak yazılır. Böylece destek
  işlemleri firma zaman akışında da görünür ve timeline tek sorguyla
  kurulmaya devam eder.
- **Çözüm ve kapanış damgaları KENDİLİĞİNDEN atılır** (`durumDamgalari`):
  kullanıcıya tarih girdirmek unutulacak bir adımdır ve çözüm süresi raporunu
  sessizce bozar. Çözüm damgası bir kez atılır ve geri ALINMAZ; kapanış
  damgası kayıt yeniden açılınca temizlenir. Doğrudan "kapandı"ya çekilen
  kayıt da çözülmüş sayılır.
- **Destek listesi arşiv değil İŞ KUYRUĞUDUR:** varsayılan görünüm açık
  işlerdir (`durum=hepsi` ile hepsi gelir) ve sıralama tarihe değil
  ÖNCELİĞE bakar.
- **Kanal ve öncelik SABİT listedir** (`DESTEK_KANAL`, `DESTEK_ONCELIK`);
  serbest metin kanal kırılımı raporunu anlamsızlaştırırdı (departman
  alanındaki aynı gerekçe). Kayıt numarası `BelgeSayac`'tan gelir
  (`DST-2026-0001`) — firma numarasındaki atomik desenin aynısı.
- **Kişi yükü YALNIZCA açık kayıtları sayar**; kapanmış iş kimsenin üzerinde
  yük değildir. Rapor hesabı saf fonksiyondadır (`destekOzeti`) ve testler
  veritabanı olmadan onu sınar.
- **Proje bağı OPSİYONELDİR** (teklif, sipariş, destek): tek seferlik küçük
  satış için proje açmak zorunda kalmak, boş proje üretmeye iterdi. Proje
  silinince bağlı kayıtlar SİLİNMEZ, yalnızca bağ kopar (`SetNull`).
- **SSS'de görüntüleme ile yönetim ayrı izinlerdir** (`sss.goruntule` /
  `sss.yonet`). Etiketler Türkçe kurallarıyla küçültülüp tekilleştirilir —
  "İADE" ile "iade" tek etikettir. Görüntülenme sayacı atomiktir ama denetim
  günlüğüne yazılmaz: bir yanıtı okumak değişiklik değildir.
- **Yedek sırası FK'ye bağlıdır:** `proje` ve `destekKaydi`, `aktivite`den
  ÖNCE geri yüklenir; kural regresyon testiyle sabitlendi.

### Anket ve Oturumsuz Yanıt Toplama (Faz 19)

- **BEŞİNCİ DAR KAPI: `anket-db.ts`** (`app.anket` bağlamı). Anketi dolduran
  kişi müşterinin çalışanıdır; uygulamanın kullanıcısı DEĞİLDİR ve
  olmayacaktır. Kapsam yalnızca dört anket tablosudur: anket ve soru SALT
  OKUNUR, yanıt yalnızca YAZILIR — dolduran kişi başkalarının yanıtını
  göremez. İş verisine hiçbir erişim yoktur. Regresyon testi hem bağlamın bu
  dosya dışında kullanılmadığını hem de `/anket` sayfasının kiracı katmanını
  hiç çağırmadığını denetler.
- **ANONİMLİK ANKET BAZINDADIR ve VERİDE tutulur.** Anonim ankette yanıt
  satırına `gonderimId` ve `firmaId` HİÇ yazılmaz; söz bir onay kutusunda
  değil, yazılmayan bir sütunda yaşar. "Kime gönderdik / kaçı yanıtladı" yine
  bilinir — bu anonimlikle çelişmez, çünkü ayrı bir sorudur.
- **Anonimlik yayından sonra değiştirilemez:** toplanmış yanıtlar o karara
  göre yazıldı; bayrağı çevirmek ya raporu tutarsızlaştırır ya da verilmemiş
  bir sözü verilmiş gibi gösterir.
- **`yanitGrubu` bir doldurma OTURUMUNU işaretler:** anonim ankette bile
  aynı kişinin yanıtlarını birbirine bağlar (kişi başına hesaplar için) ama
  hiçbir kimliğe çevrilemez.
- **Token saklanmaz, sha256 özeti tutulur** (davet deseni); bağlantı kişiye
  özel, TEK KULLANIMLIK ve anketin bitiş tarihine bağlıdır. Üç engel ayrı
  mesaj verir (taslak / kapandı / süre doldu / yanıtlandı) — hepsini
  "bağlantı geçersiz" demek, süresi dolmuş anketi teknik hata gibi
  gösterirdi.
- **Yanıt toplanmış ankette soru değiştirilemez:** sonradan eklenen soru
  önceki yanıtlayanlarda boş kalır ve yanıtlama oranını anlamsızlaştırır.
- **Çoktan seçmeli yanıt TANIMDAKİ seçeneklerle** doğrulanır (özel
  alanlardaki aynı kural); istemciden gelen değere güvenilmez.
- **NPS standart eşiklerle** hesaplanır (9-10 / 7-8 / 0-6). Serbest metin
  yanıtlar grafiğe dökülmez, olduğu gibi listelenir — her yanıt biriciktir.
- **TANIMLAMAK ile GÖNDERMEK ayrı izinlerdir** (`anket.yonet` /
  `anket.gonder`): anket kuruluşun müşteriye sorduğu sorudur, yanlış zamanda
  gönderilen e-posta geri alınamaz. E-posta kuyruğa yazılır (Faz 8).
- **KVKK metnine "Anket yanıtları" bölümü eklendi** ve sürüm `2026-08-3`e
  çıkarıldı; anonimlik sözü aydınlatma metninde de verilir.

### Kampanya Kapsamı ve Rapor Çıktısı (v1.23.0)

- **KAMPANYA SÜZGECİ İSTEMCİDE, KURAL SUNUCUDAKİYLE AYNI.** Kampanya
  kataloğu KAPSAMIYLA birlikte forma verilir (`kampanyaKatalogu`), süzme
  satır satır `satirinKampanyalari` ile yapılır. Sunucuda bir kez süzmek
  yanlıştı: bağlam (firma + ürün) kullanıcı yazdıkça değişir, ilk çizimde
  ikisi de boştur ve kapsamlı hiçbir kampanya listeye giremez.
- **KAMPANYA ALANI BOŞKEN DE ÇİZİLİR ve SEBEBİNİ YAZAR** ("önce firma
  seçin", "ürün seçin", "bu firma ve ürün için geçerli kampanya yok").
  Alanı gizlemek kullanıcıya "kampanya diye bir şey yok" dedirtiyordu.
- **SUNUCU TAM KAPSAMLA DOĞRULAR:** yalnızca `durum = aktif` bakmak yetmez;
  tarihi geçmiş, kotası dolmuş ya da başka firmaya/ürüne tanımlı bir
  kampanyanın id'si istemciden gelirse indirim UYGULANMAZ — aksi hâlde
  indirim yetkisi fiilen herkese açılır.
- **TEKLİF KALEMLERİ KATALOĞA BAĞLANDI** (v1.23.0): teklif Faz 7'de yazıldı,
  ticari çekirdek (Faz 14) sonra geldi ve teklif hiç bağlanmamıştı. Artık
  kalem ürüne ve kampanyaya bağlanır; üçü de NULL olabilir, yani serbest
  metin kalem (danışmanlık, montaj) yazmak hâlâ mümkündür ve eski teklifler
  olduğu gibi geçerli kalır.
- **TEKLİFTE İNDİRİM İKİ PARÇADIR:** kalem kampanyası + belge iskontosu.
  Sıra kampanya → iskonto → KDV'dir (siparişteki sırayla aynı), böylece
  kabul edilen teklif siparişe döndüğünde rakam değişmez. Belgede iki satır
  ayrı yazılır; tek satırda "İndirim (%10)" demek kampanyadan gelen tutarı da
  yüzdeyle açıklanmış gibi gösterirdi.
- **RAPOR PDF'İ TARAYICININ YAZDIRMA MOTORUYLA** üretilir (Faz 9 / E5
  kararı). Baskıda kabuk ve süzgeç formu gizlenir; bu yüzden yalnızca baskıda
  görünen bir KÜNYE eklenir (kuruluş adı, rapor adı, dönem, çıktı tarihi) —
  elden ele dolaşan bir çıktıda bunlar olmadan rakamlar anlamsızdır.

### Liquid Glass Tema (v1.24.0)

Kaynak: `hasib41/liquid-glass-nav`. Bağımsız bir HTML/CSS/JS bileşeniydi;
bağımlılık olarak eklenemezdi, tekniği bu projenin Tailwind + next-themes
düzenine TAŞINDI.

- **BEŞ KATMAN:** buzlu taban → kırılma → gövde rengi → imleci izleyen
  parlama → 1px ışıklı kenar. Katmanlar `pointer-events: none` ve
  `z-index: -1` taşır: bir yüzeyi camlaştırmak DAVRANIŞINI DEĞİŞTİRMEZ.
- **FİLTRE KAPSAYICIYA DEĞİL, KATMAN ÇOCUKLARINA UYGULANIR.**
  `backdrop-filter` taşıyan öğe `position: fixed` torunları için kapsayıcı
  blok oluşturur — v1.11.1'de `.card` yüzünden yaşandı ve çözümü
  `ModalKatman` portalıydı. Katmanlar mutlak konumlu çocuklar olduğu için
  kapsayıcı temiz kalır.
- **KIRILMA GERÇEKTİR:** yuvarlatılmış dikdörtgenin işaretli mesafe alanı
  (SDF) bir normal haritaya çevrilir, `feDisplacementMap` arka planı kenar
  bandında iter. Arka plandaki ince ızgara bu yüzden vardır — düz çizgi
  bükülmezse kırılma ile bulanıklık ayırt edilemez.
- **HARİTA BİR KEZ ÜRETİLİR** ve bütün yüzeyler tek filtreye bakar; kaynak
  bileşendeki yüzey başına `ResizeObserver` yaklaşımı onlarca canvas işi
  demekti.
- **DESTEKLEMEYEN TARAYICIDA KENDİLİĞİNDEN DÜŞER:** `url()` içeren
  backdrop-filter çözülemezse o katman çizilmez, sade buzlu cam görünür.
  JS'te özellik denetimi YOKTUR.
- **KOYU TEMA `.dark` SINIFINDA KALDI** (kaynak `data-theme` kullanıyor):
  `next-themes` kurulumunu ve tema düğmesini kırmamak için.
- **PARLAMA KOYU TEMADA ÇİZİLMEZ** (v1.24.0): açık temada buzlu camın
  içinde kaybolup derinlik veren beyaz parlama, koyu zeminde imleci takip
  eden bir HALE gibi okunuyordu. Katman kaldırılmadı, koyu temada yalnızca
  çizilmiyor — açık temanın görünümü aynen kalır ve karar tek satırda geri
  alınır. Karar CSS'tedir; `CamParlama` yalnızca boşuna iş yapmamak için bakar.
- **BASKIDA CAM TAMAMEN NÖTR:** katmanlar, arka plan ışıkları ve ızgara
  `@media print` içinde kapatılır; PDF çıktıları bozulmaz.
- **`.card` CAMLAŞTIRILMADI:** `ModalKatman` dengesi ona göre kurulu ve o
  denge yeniden sınanmadı.

### Modal Davranışı (v1.26.0)

- **KAPATMA KARARI TEK YERDE:** `ModalKatman`. Otuzdan fazla modal var;
  kural her birine ayrı yazılsaydı biri er ya da geç unutulurdu.
- **İÇERİDEN BAŞLAYAN SÜRÜKLEME MODALI KAPATMAZ.** Tarayıcının `click`
  olayı, basma ve bırakma FARKLI öğelerdeyse ikisinin ORTAK ATASINDA
  tetiklenir; metin seçerken imleç formun dışına taştığında ortak ata
  kaplama olur ve girilen bütün veri kaybolurdu. Kapatma artık yalnızca
  basma DA bırakma DA kaplamada olduğunda çalışır.
- **KAPLAMA KAYDIRILMAZ, MODAL ORTADA SABİT DURUR.** Taşan içerik pencerenin
  İÇİNDE kaydırılır (`.modal-kaplama > *`). `items-start`/`overflow-y-auto`
  merkez düzende ayıklanır. Yan panel ve komut paleti `duzen="ozel"` ile
  dışarıdadır: ikisi de bir "pencere" değildir.
- **`sr-only` ONAY KUTUSU KULLANILMAZ.** 1px'e sıkıştırılıp akıştan koptuğu
  için, odaklanan öğeyi görünür kılmak isteyen tarayıcı listeyi ve modalı
  zıplatıyordu (ortağın "saçma sapan kaymalar" bulgusu). Girdi görsel
  kutunun tam üstünde, kendi yerinde durur.

### Menü ve Bölümler (v1.22.0)

- **SOL MENÜ BÖLÜMLERE İNDİ** (`bolum-tanimlar.ts`): ~25 öğe, günlük işte
  kullanılan ekranı bulmayı bir tarama işine çeviriyordu. Artık iki bölüm
  (CRM, Satış Yönetimi) + tek ekranlı dört giriş (Genel Bakış, Takvim,
  Raporlar, SSS) + Yönetim var.
- **HİÇBİR ROTA DEĞİŞMEDİ.** `/kisiler`, `/urunler`, `/destek`… hepsi aynı
  adreste; değişen yalnızca oraya nasıl gidildiğidir. Kayıtlı görünümler,
  bildirim bağlantıları ve dışa aktarım adresleri kırılmaz — Faz 13'te
  "Kontaklar" etiketi değişirken rotanın korunması da aynı gerekçeyleydi.
- **BÖLÜM HEDEFİ SABİT DEĞİL, HESAPLANIR** (`bolumHedefi`): kullanıcının
  görebildiği İLK sekmeye gidilir. Sabit adres yazılsaydı, o ekrana izni
  olmayan kullanıcı bölüme tıklayınca `/yetkisiz`e düşerdi.
- **SEKME ÇUBUĞU KABUĞA TEK YERDE BAĞLI** (`(app)/layout.tsx`): 25 sayfaya
  ayrı ayrı eklenseydi, yeni ekran eklendiğinde biri unutulurdu. Bulunulan
  yol bir bölüme ait değilse çubuk HİÇ çizilmez; tek sekme kalmışsa da
  çizilmez — bilgi vermeyen bir çubuk gürültüdür.
- **AYARLAR BÖLÜMÜ (v1.26.0):** Yönetim başlığındaki dokuz satır tek bir
  "Ayarlar" girişine indi (Kullanıcılar, Gruplar, Özel Alanlar, Satış
  Aşamaları, Otomasyon, E-posta, AI, Yedekler, İçe Aktar). Denetim Günlüğü
  ve KVKK DIŞARIDA: ilki bir ayar değil KAYITTIR, ikincisi kişisel bir
  haktır ve herkese açıktır. E-posta ayarı Otomasyon ekranının içinden
  çıkarıldı — SMTP kurulumu kuralların alt ayrıntısı değil, kendi başına bir
  sistem ayarıdır.
- **EN ÖZEL EŞLEŞME KAZANIR** (`sekmeSkoru`, v1.26.0): `/otomasyon/eposta`
  hem Otomasyon'a hem E-posta'ya, `/firsatlar/asamalar` hem CRM'in
  Fırsatlar'ına hem Ayarlar'ın Satış Aşamaları'na uyar. Kural olmadan ikisi
  birden etkin görünür ya da yanlış bölümün çubuğu çizilirdi.
- **ETKİN SEKME `startsWith` DEĞİL, SINIR DUYARLI**: `/destekler` diye bir
  ekran açılsa düz `startsWith` onu da "Destek" sanırdı.

### AI Özellikleri (Faz 21)

- **SKOR DİL MODELİNE SORULMAZ** (`skor-saf.ts`): kiracının kendi kapanmış
  işlerinden istatistikle çıkar. Gerekçesi denetlenebilir, aynı veriye hep
  aynı yanıtı verir, hiçbir şeyi dışarı çıkarmaz ve hiçbir şeye mal olmaz.
  **Skor SAKLANMAZ**, her görüntülemede yeniden hesaplanır — saklanan skor
  veri değiştikçe bayatlar. Taban bir kez kurulup bütün satırlarda kullanılır.
- **AZ ÖRNEKLE KESİNLİK İDDİA EDİLMEZ:** on kapanmış işin altında rozet
  "henüz güvenilir değil" der; kırılım oranı beş işin altında üretilmez.
- **ÜÇ KAPI:** paket modülü (`ai`), `Tenant.aiAcik` (VARSAYILAN KAPALI) ve
  sağlayıcı anahtarı. Üçü de açık değilse çağrı yapılmaz ve **SEBEBİ
  söylenir**. Anahtar tanımsızsa KAPALIDIR (Faz 8 / Faz 17 deseni).
- **ÖZET ÖNCE VERİDEN YAZILIR** (`firma-ozet-saf.ts`), model yalnızca
  akıcılaştırır: özellik anahtarsız da işe yarar ve modele gönderilen metin
  uygulamada üretildiği için ne gönderildiği tam bilinir — `/ai` ekranı
  gönderilenleri VE gönderilmeyenleri adlarıyla listeler. Model bir
  ANLATICIDIR; istem rakam eklemesini ve yorum yapmasını yasaklar.
- **SAYFA AÇILIŞINDA MODEL ÇAĞRILMAZ:** özet paragrafı kullanıcı isterse
  üretilir, yoksa her firma görüntülemesi ücretli bir istek olurdu.
- **DOĞAL DİLDE SORGU MODELE VERİ GÖNDERMEZ:** model yalnızca cümleyi ve
  alan sözlüğünü görür, ürettiği şey bir SÜZGEÇTİR ve sorguyu her zaman
  uygulama çalıştırır. Modelden gelen süzgeç de kural ayrıştırıcısından
  geleni de aynı `sorguDogrula`'dan geçer: tanımsız alan sessizce atılır,
  izinsiz hedef reddedilir. **Anlaşılmayan cümle yanlış listeye götürmez.**
- **AI EYLEMDİR, OKUMA DEĞİL:** `ai.kullan` salt okunur rolde YOKTUR (özet
  istemek dış servise istek gönderir). `ai.yonet` yöneticidedir ve
  açma/kapama denetim günlüğüne düşer.
- **KULLANIM DEFTERİ** (`AiKullanim`) sözü geriye dönük denetlenebilir kılar;
  istemin ve yanıtın METNİ saklanmaz.

### Birleşik Çalışma Ekranı (Faz 20)

- **ARAMA VE EYLEMLER TEK KAYIT DEFTERİNDEN** gelir
  (`arama-tanimlar.ts`): hangi modülün aranabildiği, hangi izne bağlı olduğu
  ve sonucun nereye götürdüğü tek yerdedir (pano kartları ve rapor
  merkezindeki desen). Yeni modülü aranabilir yapmak = deftere satır eklemek.
  Regresyon testi her satırın GERÇEK bir izin anahtarına bağlı olduğunu
  denetler — uydurma bir izin süzgeci sessizce etkisiz bırakırdı.
- **İZNİ OLMAYAN MODÜL HİÇ SORGULANMAZ** (`/api/arama`, `/api/ozet`,
  `zincir.ts`): gizlenmiş menünün kaydı arama sonucunda belirseydi menüyü
  gizlemenin anlamı kalmazdı.
- **YAN PANEL URL'DE YAŞAR** (`?panel=firma:<id>`): sayfa yenilenince panel
  açık kalır, bağlantı paylaşılabilir, geri tuşu paneli kapatır. Panel
  ÖZET'tir, tam detayın yerini almaz — her zaman "Tam sayfada aç" taşır.
  **Satır içi düzenleme kapsam DIŞIDIR**; panel bakmak içindir.
- **SEKME BİR SORGU KAPISIDIR:** firma çalışma ekranında seçilmeyen sekmenin
  sorgusu hiç çalışmaz. Uydurma/izinsiz sekme sessizce "genel"e düşer —
  hata sayfası, eski bir yer imini açan kullanıcıyı boşuna korkuturdu.
- **ZİNCİRİN SIRASI İŞ AKIŞININ KENDİSİDİR:** fırsat → teklif → sipariş →
  sevkiyat. Boş halka gizlenmez, "—" olarak durur ("bu teklif henüz siparişe
  dönmemiş" de bilgidir); bakılan kayıttan başka dolu halka yoksa şerit hiç
  çizilmez.

### Rapor Merkezi ve Firma Dosyası (Faz 18)

- **Rapor merkezi KENDİ rakamını hesaplamaz.** `/raporlar` hiçbir sorgu
  çalıştırmaz; kayıt defterini (`rapor-tanimlar.ts`) okur ve ortak süzgeci
  (tarih aralığı + firma + sorumlu) raporlara taşır. **Yeni rapor eklemek =
  deftere satır eklemek** (pano kartlarındaki desen); regresyon testi,
  defterdeki her iç raporun sayfasının gerçekten var olduğunu denetler.
- **Destek, sevkiyat ve kampanya raporları KOPYALANMADI, BAĞLANDI.**
  Kopyalamak iki ayrı doğruluk kaynağı üretirdi. Ortak süzgeç dış raporlara
  TAŞINMAZ — o ekranların kendi anahtarları var, uydurma bir querystring
  sessizce yok sayılır ve kullanıcıya "dönem uygulandı" yanılgısı verirdi.
- **CİRO = ONAYLANMIŞ SİPARİŞ.** Teklif niyet, fırsat tahmindir; ikisini
  ciroya saymak rakamı şişirirdi. Onay anı, stok ve kampanya kotasının
  düştüğü (Faz 15), yani taahhüde girilen andır.
- **BEKLENEN TAHSİLAT bir TAHMİNDİR** ve ekranda öyle etiketlenir: sistemde
  ödeme/fatura kaydı YOKTUR (karar: v1.18.0). Rakam onay bekleyen sipariş +
  kabul edilen teklif + olasılıkla ağırlıklı açık fırsattan oluşur.
- **DÖNÜŞÜM ORANI KAPANMIŞ işler üzerinden** hesaplanır; açık fırsatları
  paydaya koymak, hattı doldurdukça başarıyı düşük gösterirdi.
- **Önceki dönem sıfırsa yüzde üretilmez** ve karşılaştırma yalnızca KAPALI
  aralıkta yapılır — "önceki dönem" açık uçlu bir aralıkta tanımsızdır.
- **Firma dosyası (tek PDF) izin süzgecinden geçer:** izni olmayan modül hiç
  sorgulanmaz ve belgeye girmez; yazdırılan belge elden ele dolaşır. Künye
  ve kontaklar tarih aralığından bağımsızdır. PDF yine tarayıcının yazdırma
  motoruyla üretilir (Faz 9 / E5 gerekçeleri).
- **Rapor süzgeci kayıtlı görünüm olarak saklanır** (R5): süzgeç zaten
  querystring'de yaşadığı için `GORUNUM_LISTELERI`'ne `raporlar` eklemek
  yetti; varsayılan görünüm merkezi doğrudan o döneme açar.

### Saha Çalışması: Ekler ve Konum (Faz 17)

- **Dosya türü UZANTIDAN DEĞİL İÇERİKTEN belirlenir** (`turTespit`): imza
  eşleşmezse dosya reddedilir — `.jpg` adlı bir çalıştırılabilir dosya
  sunucuya girip tarayıcıya görsel diye sunulamaz. İzinli türler BEYAZ
  LİSTEDİR. Zip tabanlı Office belgeleri tek imzayı paylaştığı için içerik
  "zip kapsayıcı" olarak doğrulanır, etiket uzantıdan seçilir; uzantı burada
  güvenlik değil GÖSTERİM kararıdır.
- **Dosyanın kendisi diskte durur** (`DOSYA_DIZIN`, üretimde `gezegen-dosya`
  volume'ü); veritabanı yalnızca üstveriyi taşır. `Dosya` bu yüzden JSON
  yedeğinin kapsamı DIŞINDADIR — base64 gömmek yedeği indirilemez hâle
  getirirdi. Volume yedeği `docs/DEPLOY.md` içinde ayrı bir adımdır.
- **Kota yüklemeden ÖNCE bakılır** (10 MB/dosya, 2 GB/kiracı): "yaz, sonra
  kontrol et" eşzamanlı iki yüklemede kotanın aşılmasına izin verirdi.
  Görseller sunucuda 1600 piksele küçültülür; küçültme başarısız olursa
  özgün dosya saklanır.
- **Ek TEK action'dan geçer** (`dosya-actions.ts`) çünkü kural her varlıkta
  aynıdır: tür, boyut, kota, denetim. Her ekran kendi yüklemesini yazsaydı
  bu dördünden biri er ya da geç unutulurdu. Bağlam GERÇEK FK'dir (firma,
  aktivite, destek, sipariş, teklif) — kayıt silinince ekler cascade ile
  gider.
- **İndirme ucu kiracı katmanından geçer**, `nosniff` gönderir; görseller
  `inline`, diğerleri `attachment` sunulur.
- **Geocoding ANAHTAR TANIMSIZSA KAPALIDIR**; koordinat elle girilir ve
  arayüz bunu açıkça söyler. Maliyet koruması iki katmanlı: koordinat kayıtta
  saklanır, `konumAdres` sayesinde adres değişmedikçe yeni istek gitmez.
  Harita GÖMÜLÜ değil BAĞLANTIDIR — gömülü harita her açılışta ücretli bir
  istektir.
- **Konum doğrulamasının ÜÇ sonucu vardır:** doğrulandı / uyuşmuyor /
  doğrulanamadı. İzin reddi ya da koordinatsız firma "uzak" saymaz; teknik
  aksaklık personeli suçlu duruma düşürmemelidir. Yöneticiye bildirim
  YALNIZCA "uyuşmuyor" durumunda gider. Karar ziyaret satırına yazılır
  (`yaricapM` dahil) — kuruluş ayarı sonradan değişse de geçmiş kararlar
  sabit kalır.
- **Ziyaret süresi kullanıcıdan istenmez**, damgalardan hesaplanır; ziyaret
  bitince AKTİVİTE yazılır ve firma zaman akışında görünür. Aynı anda iki
  açık ziyaret olamaz. Mesafe küresel (haversine) hesaplanır — düz hesap
  39. enlemde doğu-batı sapmasını ~%30 fazla gösterirdi.
- **Konum yalnızca ziyaretin başında alınır; sürekli takip YOKTUR.** Bu,
  KVKK aydınlatma metninin (v1.12.2) verdiği sözdür ve uygulamayı bağlar.
  Bitişte konum sorulmaz, `watchPosition` kurulmaz.
- **KONUM AYRI BİR DÜĞME DEĞİL, BAŞLATMANIN PARÇASIDIR** (v1.26.1): iki
  adımın ikisi de zorunlu değildi ve "Konumumu al"a basmadan başlatan
  kullanıcı ziyareti konumsuz açıyor, kayıt sessizce "doğrulanamadı" oluyordu.
  Tek düğme önce konumu alır, SONRA formu gönderir (`requestSubmit`); değerler
  React durumuna değil doğrudan gizli alana yazılır, yoksa gönderim bir çizim
  turu geriden gelen boş değerle giderdi.
- **FİRMANIN PAKETLERİ SAHADA GÖRÜNÜR** (v1.26.1): firma çalışma ekranının
  Satış sekmesinde ve açık ziyaret varken ziyaret ekranında. Ziyaret
  ekranında ayrıca PAKETİN STOK KAPASİTESİ (`paketStokKapasitesi`: en dar
  kaleme bağlıdır ve dar boğaz da yazılır) ve FİRMAYI KAPSAYAN KAMPANYALAR
  kalan haklarıyla listelenir (v1.27.3). Kampanyada ürün/paket kapsamı
  burada SÜZGEÇ DEĞİL bilgidir — henüz satır yokken süzmek temsilciye
  "kampanya yok" dedirtirdi. "Bu müşteriye
  hangi paketi verdik?" sorusunun yanıtı v1.25.0'a kadar yalnızca sipariş
  formunda vardı.

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
| `app.anket` | `anketIstemcisi()` — oturumsuz anket yanıtlama | Anket ve soru SALT OKUNUR, yanıt yalnızca YAZILIR |

Bağlam ayarlanmazsa veritabanı **sıfır satır** döndürür. Yani uygulama
katmanında bir sorgu filtreyi unutsa bile veri sızmaz.

### Doğrulama (ZORUNLU — her geliştirmede)

```bash
npm run dogrula
```

Tip kontrolü + derleme + migration + demo veri + otomatik test paketi (Vitest)
+ HTTP izolasyonu + gerçek tarayıcıyla kimlik ve yetki doğrulaması =
**934 kontrol**.
Sonuç `docs/dogrulama/v<sürüm>.md` dosyasına yazılır ve depoda kalır.
Doğrulama ayrı bir PostgreSQL şeması (`dogrulama`) ve ayrı bir port (3100)
kullanır; geliştirme veritabanınıza dokunmaz.

Tek tek:

```bash
npm test                 # Vitest: izolasyon + RLS + yetki + denetim + regresyon (615 test, ~18 sn)
npm run test:izle        # geliştirirken sürekli koşan hâli
npm run kontrol:e2e      # HTTP (sunucu çalışırken, 14)
npm run kontrol:kimlik   # giriş + yetki + admin + satış + destek + saha + rapor + anket + çalışma ekranı + AI + menü + kampanya + tema, gerçek tarayıcı (sunucu çalışırken, 298)
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

### Her sürüm kapanışında İKİ blok birden verilir (ZORUNLU)

Sürüm kapanış mesajında **yalnızca tag komutu vermek yetmez**; hemen ardından
**sunucu deploy bloğu** da verilir (yedek → tag'e geç → derle → doğrula).
İkisi tek bir işin iki yarısıdır; tag'i atıp sunucuda ne basacağını aramak
zorunda kalmak ortağın bildirdiği bir sürtünmedir. Şablon:
**`docs/DEPLOY.md` → "0. Her sürüm için iki adım (özet kart)"** (A / B / C / D).

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
| 15 | Sipariş, yönetici onayı, depo/sevkiyat (S1-S6) | `v1.15.0` | ✅ tamamlandı |
| 16 | Proje, destek kaydı, SSS (P1-P4) | `v1.16.0` | ✅ tamamlandı |
| 17 | Dosya/fotoğraf eki, ziyaret ve konum doğrulama (A1-A5) | `v1.17.0` | ✅ tamamlandı |
| 18 | Rapor merkezi, mali raporlar, firma dosyası PDF (R1-R5) | `v1.18.0` | ✅ tamamlandı |
| 19 | Anket tanımı, gönderim, yanıt toplama, rapor (N1-N4) | `v1.19.0` | ✅ tamamlandı |
| 20 | Birleşik çalışma ekranı: komut paleti, yan panel (U1-U4) | `v1.20.0` | ✅ tamamlandı |
| 21 | AI: skorlama, özet, doğal dilde sorgu (G1-G3) | `v1.21.0` | ✅ tamamlandı |

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
- **v1.15.0** — **Faz 15:** Sipariş, yönetici onayı ve sevkiyat. Kalemli
  sipariş (tutarlar sunucuda, fiyat motoruyla); "onay bekliyor" varsayılan
  durumu ve ayrı onay izni; onayda atomik stok + kampanya kotası düşümü,
  yarı kalan düşümlerin ters hareketle iadesi; onaylı siparişten doğan
  sevkiyat kuyruğu, taşıyıcı/takip no ve durum akışı; sevkiyat raporu
  (durum kırılımı, bekleme süresi, gecikenler); onay/ret/sevkiyat
  bildirimleri; kabul edilen tekliften tek tuşla sipariş.
- **v1.16.0** — **Faz 16:** Proje, destek kaydı ve bilgi bankası. Firmaya
  bağlı proje (kod, sorumlu, tarih aralığı, bütçe; teklif/sipariş/destek
  kayıtları detayında toplanır ve oradan açılır); kanal, öncelik, atama ve
  durum akışı olan destek kaydı (`DST-2026-0001`), işlem geçmişi aktivite
  olarak tutulduğu için firma zaman akışında da görünür; kendiliğinden atılan
  çözüm/kapanış damgalarına dayanan destek raporu (kanal kırılımı, öncelik
  dağılımı, kişi yükü, ortalama çözüm süresi, en uzun bekleyenler, firma ve
  tarih süzgeci); kategori/etiketli, Türkçe duyarsız aramalı SSS bilgi
  bankası ve destek kaydından tek tıkla erişim.
- **v1.17.0** — **Faz 17:** Saha çalışması. İçerik imzasından tür doğrulayan,
  10 MB/dosya ve 2 GB/kiracı kotalı, görselleri sunucuda küçülten dosya eki
  altyapısı (firma, aktivite, destek kaydı, sipariş ve teklif kayıtlarında);
  mobil kameradan doğrudan fotoğraf çekme; firma koordinatı ve anahtar
  tanımlıysa adresten koordinat üretimi (koordinat saklanır, adres
  değişmedikçe yeni istek gitmez); başlat/bitir damgalarından süre hesaplayan
  saha ziyareti, 300 m varsayılan yarıçapla üç sonuçlu konum doğrulaması
  (doğrulandı / uyuşmuyor / doğrulanamadı) ve yalnızca uyuşmayan ziyaretlerde
  yöneticiye bildirim. Ekler `gezegen-dosya` volume'ünde durur ve ayrı
  yedeklenir.
- **v1.18.0** — **Faz 18:** Rapor merkezi ve firma dosyası. Kayıt defterine
  dayalı, ortak tarih/firma/sorumlu süzgeçli rapor merkezi (izni olmayan
  rapor listede görünmez); mali rapor (ciro, beklenen tahsilat tahmini,
  indirim maliyeti, firma ve ürün bazında kırılım, aynı uzunlukta önceki
  dönemle karşılaştırma); satış hattı raporu (aşama dağılımı, kapanmış işler
  üzerinden dönüşüm oranı, kayıp sebepleri, aday dönüşümü); aktivite yükü ve
  ürün satış raporları; destek/sevkiyat/kampanya raporlarına merkezden
  bağlantı; bir firmanın her şeyini izin süzgecinden geçirerek tek belgede
  toplayan firma dosyası (PDF); rapor süzgeçlerinin kayıtlı görünüm olarak
  saklanması.
- **v1.19.0** — **Faz 19:** Anket. Beş soru tipli (metin, çoktan seçmeli,
  ölçek 1-5, ölçek 0-10, evet/hayır) anket tanımı; kontaklara e-postayla
  kişiye özel, tek kullanımlık ve bitiş tarihine bağlı token'lı bağlantı
  (token saklanmaz, sha256 özeti tutulur); OTURUM GEREKTİRMEYEN yanıt sayfası
  ve beşinci dar kapı (`anket-db.ts`, `app.anket` bağlamı); anket bazında
  seçilebilen ANONİMLİK — anonimde yanıt satırına kimlik bağı hiç yazılmaz;
  soru bazında dağılım, ortalama, NPS ve yanıtlama oranı raporu. KVKK metni
  `2026-08-3`e çıkarıldı.
- **v1.20.0** — **Faz 20:** Birleşik çalışma ekranı. Ctrl/Cmd+K komut paleti
  (yedi modülde Türkçe duyarsız arama + hızlı eylemler, izin süzgeçli);
  querystring'de yaşayan yan panel ile listeden çıkmadan kayıt özeti
  ("Tam sayfada aç" bir tık uzakta); firmanın bütün modüllerini sekmeli tek
  ekranda toplayan çalışma ekranı (sipariş, proje, destek ve ziyaret ilk kez
  firma ekranına bağlandı; seçilmeyen sekme HİÇ sorgulanmaz); teklif ve
  sipariş detayında fırsat → teklif → sipariş → sevkiyat zincir şeridi.
- **v1.21.0** — **Faz 21:** AI özellikleri. Kiracının KENDİ kapanmış
  işlerinden hesaplanan, tıklanınca gerekçesini açan fırsat ve aday skoru
  (dış çağrı yok, az örnekte "güvenilir değil" der); veriden üretilen ve
  istenirse dil modeliyle paragraf hâline getirilen firma özeti; modele
  yalnızca CÜMLE gönderen, süzgeç üretip sorguyu uygulamaya çalıştıran doğal
  dilde sorgu (tanıdık kalıplar model olmadan da çözülür); açma/kapama,
  gönderilen-gönderilmeyen listesi ve kullanım defteriyle `/ai` ayar ekranı.
  KVKK metni `2026-08-4`e çıkarıldı. **Yol haritasının 21 fazı tamamlandı.**
- **v1.23.0** — **Kampanya zinciri ve rapor PDF'i.** Kampanya seçimi artık
  seçili firmaya ve satırın ürününe göre CANLI süzülüyor: sunucuda bir kez
  süzülmüş liste, ilk çizimde firma ve ürün boş olduğu için kapsamlı her
  kampanyayı eliyordu (ortağın "kampanya hiç gözükmüyor" bulgusunun sebebi).
  Kampanya alanı artık boşken de çiziliyor ve SEBEBİNİ yazıyor. Teklif
  kalemleri ilk kez ürün kataloğuna ve fiyat motoruna bağlandı (`urunId`,
  `kampanyaId`, `indirimTutari`); kampanya indirimi teklif belgesinde ve
  çıktısında ayrı satır olarak görünüyor, tekliften siparişe geçerken ürün ve
  kampanya taşınıyor. Sunucu tarafında kampanya doğrulaması tarih, kota, firma
  ve ürün kapsamının TAMAMINI denetliyor. Rapor ekranlarına "Yazdır / PDF
  Kaydet" düğmesi ve baskıya özel künye (kuruluş adı, dönem, çıktı tarihi).
- **v1.27.3** — Ziyaret ekranına paketin stok kapasitesi ("stoktan 3 paket —
  sınır: X ürünü, 6 adet") ve firmayı kapsayan kampanyalar kalan haklarıyla
  eklendi. Kapasite en dar kaleme bağlıdır; stok takibi olmayan kalem kısıt
  getirmez. Kampanyada ürün/paket kapsamı bu ekranda süzgeç değil bilgidir.
- **v1.27.2** — Paketten oluşturulan sipariş ₺0 kaydediliyordu: v1.27.0'da
  paket grubundaki birim fiyat girdisine `name` konmamıştı ve alan forma hiç
  gönderilmiyordu (önizleme doğru görünüyordu, hata yalnızca gönderimdeydi).
  Alan bağlandı; sınıfı kapatan bir test (action'ın okuduğu her alan formda
  `name` ile bulunmalı) ve kaydedip sonuca bakan bir tarayıcı kontrolü eklendi.
- **v1.27.1** — Kampanyayla sipariş oluşturulduğunda kampanya ekranında
  hiçbir şeyin kımıldamaması giderildi. Tanı gerçek tarayıcıyla konuldu:
  oluşturma kampanyayı satıra yazıyor ama kota ONAYDA düşüyor (Faz 15
  kararı, doğru). Kural korundu; onay bekleyen haklar kampanya kartında
  "(+N onay bekliyor)" olarak ayrıca gösteriliyor ve sipariş formu kotanın
  ne zaman düşeceğini yazıyor.
- **v1.27.0** — **Paket bir bütündür.** "Paket fiyatı 1000 TL" kampanyası
  iki ürünlü bir pakette 2000 TL'ye çıkıyordu: v1.25.0 paketi satırlara açtı
  ama fiyatı da satır satır hesaplıyordu. Artık paket formda TEK KUTUDUR —
  paket adedi ("4 paket"), tek kampanya seçimi ve içindeki ürünlerin listesi;
  fiyat paket düzeyinde hesaplanıp satırlara pay edilir. Kota da paket sayar
  (1 paket = 1 hak). Satırlar yine ayrı ayrı kaydedilir, stok ve ürün raporu
  bozulmaz. `paketAdedi` alanı eklendi; teklif tarafı da aynı kuralla çalışır.
- **v1.26.1** — **Kampanya paket kapsamı, ziyaret konumu, paket görünürlüğü.**
  Kampanya kapsamındaki `paketIdler` toplanıyor ve saklanıyor ama kararı veren
  fonksiyonda HİÇ OKUNMUYORDU; paketten açılan satırlara kampanya
  uygulanmıyor, bu yüzden onayda kota da düşmüyordu (ortağın "kampanya
  tanımından düşmüyor" bulgusunun kök sebebi). Ziyaret başlatma tek adıma
  indi: "Ziyareti Başlat" önce konumu alır, sonra kaydı açar; ayrı "konum al"
  düğmesi kalktı ve sürekli takip olmadığı sözü test edilir hâle geldi.
  Firmaya açık paketler artık firma kartının Satış sekmesinde ve açık ziyaret
  sırasında ziyaret ekranında görünüyor.
- **v1.26.0** — **Modal davranışı ve Ayarlar bölümü.** Açılır pencereler
  artık ortada sabit duruyor (taşan içerik pencerenin içinde kaydırılıyor)
  ve içeriden başlayıp dışarıda biten bir sürükleme onları KAPATMIYOR —
  veri girerken metin seçmek artık formu kapatmıyor; kural `ModalKatman`'da
  tek yerde. Yönetim başlığındaki dokuz satır tek bir **Ayarlar** bölümüne
  indi (Kullanıcılar, Gruplar, Özel Alanlar, Satış Aşamaları, Otomasyon,
  E-posta, AI, Yedekler, İçe Aktar); e-posta ayarı Otomasyon ekranından
  çıkarılıp kardeş sekme oldu. Denetim Günlüğü ve KVKK bilinçli olarak
  dışarıda kaldı. Hiçbir rota değişmedi.
- **v1.25.1** — Kampanya kapsamındaki ürün/paket/firma seçimi `<select
  multiple>` olmaktan çıktı: seçim artık RENK değil onay kutusu İŞARETİ,
  üstte "3 / 114 seçili" sayacı ve "Tümünü seç / Temizle" düğmesi var, 8'den
  uzun listelerde Türkçe duyarsız arama çıkıyor. Ctrl basılı tutmadan
  tıklayınca önceki seçimlerin sessizce silinmesi sorunu ortadan kalktı.
  Sunucu tarafı değişmedi (`formData.getAll` aynı biçimde okur).
- **v1.25.0** — **Paket satışa bağlandı.** Ürün paketi Faz 14'ten beri
  tanımlanabiliyor ama hiçbir siparişe ya da teklife bağlanamıyordu; artık
  "Paketten kalem ekle" ile paket KALEMLERİNE açılıyor (her ürün kendi
  satırı — stok düşümü, kısmi sevkiyat ve ürün raporu bozulmuyor), birim
  fiyat paketten geliyor ve her satıra hangi paketten geldiği damgalanıyor.
  Damga sunucuda kapsamıyla doğrulanıyor, sipariş/teklif belgesinde görünüyor
  ve tekliften siparişe geçişte taşınıyor. `TeklifKalemi.paketId` eklendi;
  teklif revizyonunun ürün/kampanya bağlarını düşürdüğü (v1.23.0'dan kalan)
  eksik ve yedekte teklif kaleminin ticari çekirdekten önce geri yüklendiği
  sıra hatası da düzeltildi.
- **v1.24.0** — **Liquid glass tema.** Üst çubuk, sol menü, bölüm sekme
  çubuğu, mobil menü, komut paleti ve yan panel beş katmanlı cam yüzeye
  çevrildi (buzlu taban, gerçek kırılma, gövde rengi, parlama, ışıklı kenar);
  arka planda kırılmayı görünür kılan aurora ve ince ızgara; etkin menü
  öğelerinde kayan kapsül. Ön sürüm olarak çıkarıldı, ortağın geri
  bildirimiyle koyu temadaki imleç parlaması kaldırıldı ve onaylanarak prod'a
  alındı. Hiçbir işlev değişmedi; baskıda cam tamamen nötrdür.
- **v1.22.0** — **Menü konsolidasyonu.** Sol menüdeki ~25 öğe altı ana
  girişe indi: Genel Bakış, **CRM**, **Satış Yönetimi**, Takvim, Raporlar,
  SSS (Bilgi Bankası) + Yönetim. Bir bölüme tıklanınca kullanıcının
  GÖREBİLDİĞİ ilk ekran açılır ve o bölümün bütün ekranları sayfanın üstünde
  sekme çubuğu olarak durur. İçe Aktar, Yönetim'e alındı. **Hiçbir rota
  değişmedi** — kayıtlı görünümler, bildirim bağlantıları ve yer imleri
  çalışmaya devam eder.
- **v1.11.2** — Arayüz: sol menü sıkılaştırıldı (13px, dar dikey aralık) ve
  taşarsa kaydırılabilir; kanban sütunları daraltıldı (min 196px) ve sayfa
  dolgusuna taşarak tam genişliğe yayılır — beş sütunlu varsayılan hat 13"
  ekrana kaydırmasız sığar.
