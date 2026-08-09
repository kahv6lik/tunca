// Uygulama genelinde kullanılan durum ve tür sabitleri

export const FIRMA_DURUM = ["aktif", "pasif"] as const;

// Firma formunda hazır gelen sektörler ("Diğer" seçilirse elle yazılır)
export const SEKTORLER = [
  "Tekstil",
  "Gıda",
  "Otomotiv",
  "Otomotiv Yan Sanayi",
  "Makine",
  "İnşaat",
  "Kimya",
  "Elektronik",
  "Mobilya",
  "Lojistik ve Taşımacılık",
  "Turizm",
  "Tarım ve Hayvancılık",
  "Enerji",
  "Sağlık",
  "Yazılım ve Bilişim",
  "Metal ve Metalurji",
  "Plastik ve Kauçuk",
  "Ambalaj",
  "Kozmetik",
  "Savunma Sanayi",
  "Eğitim",
  "Perakende",
  "Madencilik",
  "Tekstil ve Konfeksiyon",
] as const;

export const DIGER_SEKTOR = "Diğer";

export const YATIRIM_DURUM = [
  "basvuruldu",
  "onaylandi",
  "reddedildi",
  "tamamlandi",
] as const;

export const YATIRIM_TUR = ["Hibe", "Teşvik", "Kredi", "Diğer"] as const;

export const EGITIM_DURUM = ["planlandi", "tamamlandi", "iptal"] as const;

export const HIZMET_DURUM = ["devam", "tamamlandi", "iptal"] as const;

export const HIZMET_TUR = [
  "Danışmanlık",
  "Denetim",
  "Raporlama",
  "Eğitim",
  "Diğer",
] as const;

export const PARA_BIRIMI = ["TRY", "USD", "EUR"] as const;

// Fırsat sonucu (Faz 6). Aşamadan AYRIDIR: aşama hattaki yeri, durum sonucu
// anlatır. Kapanan fırsat son aşamasında kalır ama kanban'ın açık
// sütunlarından düşer.
export const FIRSAT_DURUM = ["acik", "kazanildi", "kaybedildi"] as const;

/**
 * Aktivite türleri (Faz 7 / C4).
 *
 * Not ile görev arasındaki fark ayrı bir tablo değil, `sonTarih` alanının
 * dolu olmasıdır; tür yalnızca "ne yapıldı/yapılacak" bilgisini taşır.
 */
export const AKTIVITE_TUR = [
  { deger: "arama", etiket: "Arama" },
  { deger: "toplanti", etiket: "Toplantı" },
  { deger: "eposta", etiket: "E-posta" },
  { deger: "not", etiket: "Not" },
  { deger: "gorev", etiket: "Görev" },
] as const;

export const AKTIVITE_TUR_DEGERLERI = AKTIVITE_TUR.map((t) => t.deger);

// Aday (Lead) durumları (Faz 7 / C5)
export const LEAD_DURUM = [
  "yeni",
  "iletisim",
  "nitelikli",
  "donusturuldu",
  "elendi",
] as const;

// Aday kaynakları — serbest metin de girilebilir
export const LEAD_KAYNAKLARI = [
  "Web sitesi",
  "Fuar",
  "Referans",
  "Telefon",
  "Sosyal medya",
  "E-posta kampanyası",
  "Diğer",
] as const;

// Teklif durumları (Faz 7 / C7)
export const TEKLIF_DURUM = [
  "taslak",
  "gonderildi",
  "kabul",
  "red",
  "revizyon",
] as const;

export const TEKLIF_BIRIMLERI = ["adet", "saat", "gün", "ay", "paket", "kalem"] as const;

// Kanban sütunları için hazır renkler (aşama düzenleme ekranında seçilir).
export const ASAMA_RENKLERI = [
  "#6366f1", "#0ea5e9", "#f59e0b", "#a855f7", "#10b981", "#ef4444", "#64748b",
] as const;

// Durum → Türkçe etiket + renk (dark uyumlu translucent ring rozetleri)
export const DURUM_ETIKET: Record<string, { label: string; className: string }> = {
  // firma
  aktif: { label: "Aktif", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  pasif: { label: "Pasif", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  // yatırım
  basvuruldu: { label: "Başvuruldu", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  onaylandi: { label: "Onaylandı", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  reddedildi: { label: "Reddedildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  // ortak
  tamamlandi: { label: "Tamamlandı", className: "bg-teal-500/15 text-teal-400 ring-teal-500/25" },
  // eğitim
  planlandi: { label: "Planlandı", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  iptal: { label: "İptal", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  // hizmet
  devam: { label: "Devam Ediyor", className: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25" },
  // kiracı (Faz 5 / admin panel)
  askida: { label: "Askıda", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  // fırsat (Faz 6)
  acik: { label: "Açık", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  kazanildi: { label: "Kazanıldı", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  kaybedildi: { label: "Kaybedildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  // aday / lead (Faz 7)
  yeni: { label: "Yeni", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  iletisim: { label: "İletişimde", className: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25" },
  nitelikli: { label: "Nitelikli", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  donusturuldu: { label: "Dönüştürüldü", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  elendi: { label: "Elendi", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  // teklif (Faz 7)
  taslak: { label: "Taslak", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  gonderildi: { label: "Gönderildi", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  kabul: { label: "Kabul Edildi", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  red: { label: "Reddedildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
  revizyon: { label: "Revize Edildi", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  // kampanya (Faz 14)
  duraklatildi: { label: "Duraklatıldı", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  sonaerdi: { label: "Sona Erdi", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  // sipariş ve sevkiyat (Faz 15)
  // NOT: "onaylandi" ve "reddedildi" zaten yatırım desteğinden geliyor;
  // etiketleri sipariş için de doğru, ikinci kez tanımlanmıyor.
  onaybekliyor: { label: "Onay Bekliyor", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  hazirlaniyor: { label: "Hazırlanıyor", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  // proje ve destek (Faz 16) — "planlandi" zaten eğitimden geliyor, tekrar
  // tanımlanmıyor.
  beklemede: { label: "Beklemede", className: "bg-amber-500/15 text-amber-400 ring-amber-500/25" },
  islemde: { label: "İşlemde", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  cozuldu: { label: "Çözüldü", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  kapandi: { label: "Kapandı", className: "bg-slate-500/15 text-slate-400 ring-slate-500/25" },
  sevkedildi: { label: "Sevk Edildi", className: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25" },
  teslim: { label: "Teslim Edildi", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
};

// ── Ticari çekirdek (Faz 14) ───────────────────────────────────────────────

export const URUN_DURUM = ["aktif", "pasif"] as const;

export const URUN_BIRIMLERI = [
  "adet", "kg", "litre", "metre", "m²", "m³", "paket", "kutu", "koli",
  "saat", "gün", "ay", "yıl", "hizmet",
] as const;

/**
 * Kampanya tipleri.
 *
 * Liste SABİTTİR: her tip fiyat motorunda ayrı bir hesap dalıdır
 * (`fiyat-saf.ts`), yani kullanıcının serbestçe tip eklemesi hesaplanamayan
 * bir kampanya üretirdi.
 */
export const KAMPANYA_TIP = [
  { deger: "yuzde", etiket: "Yüzde İndirim", aciklama: "Tutarın %X'i düşülür" },
  { deger: "tutar", etiket: "Tutar İndirimi", aciklama: "Sabit tutar düşülür" },
  { deger: "alnodem", etiket: "X Alana Y Bedava", aciklama: "N alana M ödeme" },
  { deger: "paketfiyat", etiket: "Paket Fiyatı", aciklama: "Sabit kampanya fiyatı" },
] as const;

export type KampanyaTipi = (typeof KAMPANYA_TIP)[number]["deger"];

export const KAMPANYA_DURUM = ["taslak", "aktif", "duraklatildi", "sonaerdi"] as const;

/**
 * Stok hareket türleri ve YÖNLERİ.
 *
 * Yön burada tanımlıdır çünkü işaretin kararı tek bir yerde olmalıdır:
 * "çıkış" bir yerde +, başka yerde − yazılırsa bakiye sessizce bozulur.
 * `sayim` ve `duzeltme` iki yönlü olabilir (fark kadar yazılır).
 */
export const STOK_HAREKET_TUR = [
  { deger: "giris", etiket: "Giriş (mal kabul)", yon: 1 },
  { deger: "cikis", etiket: "Çıkış (sevkiyat)", yon: -1 },
  { deger: "iade", etiket: "İade (girişe)", yon: 1 },
  { deger: "fire", etiket: "Fire / zayi", yon: -1 },
  { deger: "sayim", etiket: "Sayım düzeltmesi", yon: 0 },
  { deger: "duzeltme", etiket: "Elle düzeltme", yon: 0 },
] as const;

export type StokHareketTuru = (typeof STOK_HAREKET_TUR)[number]["deger"];

// ── Sipariş ve sevkiyat (Faz 15) ───────────────────────────────────────────

/**
 * Sipariş durumları.
 *
 * `onaybekliyor` VARSAYILANDIR: satış personelinin girdiği her sipariş
 * yöneticinin önüne düşer. "taslak" yalnızca kullanıcının kendi hazırlığıdır
 * ve onay kuyruğuna girmez.
 */
export const SIPARIS_DURUM = [
  "taslak",
  "onaybekliyor",
  "onaylandi",
  "reddedildi",
  "iptal",
] as const;

export type SiparisDurumu = (typeof SIPARIS_DURUM)[number];

/** Sevkiyat durumları — yalnızca ONAYLANMIŞ siparişten doğar. */
export const SEVKIYAT_DURUM = [
  "hazirlaniyor",
  "sevkedildi",
  "teslim",
  "iptal",
] as const;

export type SevkiyatDurumu = (typeof SEVKIYAT_DURUM)[number];

// ── Proje, destek ve SSS (Faz 16) ──────────────────────────────────────────

export const PROJE_DURUM = [
  "planlandi",
  "devam",
  "beklemede",
  "tamamlandi",
  "iptal",
] as const;

/**
 * Destek kaydının GELİŞ KANALI.
 *
 * Sabit listedir: kanal kırılımı raporunun anlamlı olması için serbest metin
 * olamaz — "Telefon", "telefon", "Tel" üç ayrı kanal gibi sayılırdı.
 */
export const DESTEK_KANAL = [
  { deger: "telefon", etiket: "Telefon" },
  { deger: "eposta", etiket: "E-posta" },
  { deger: "web", etiket: "Web formu" },
  { deger: "saha", etiket: "Saha ziyareti" },
  { deger: "sosyal", etiket: "Sosyal medya" },
  { deger: "whatsapp", etiket: "WhatsApp" },
  { deger: "diger", etiket: "Diğer" },
] as const;

export type DestekKanali = (typeof DESTEK_KANAL)[number]["deger"];

export const DESTEK_ONCELIK = [
  { deger: "dusuk", etiket: "Düşük", sira: 0 },
  { deger: "orta", etiket: "Orta", sira: 1 },
  { deger: "yuksek", etiket: "Yüksek", sira: 2 },
  { deger: "kritik", etiket: "Kritik", sira: 3 },
] as const;

export type DestekOnceligi = (typeof DESTEK_ONCELIK)[number]["deger"];

/**
 * Destek kaydı durumları.
 *
 * "cozuldu" ile "kapandi" bilinçli olarak AYRIDIR: çözüm anı süre hesabının
 * dayanağıdır, kapanış ise müşteri onayından sonra gelir. İkisini
 * birleştirmek "ne kadar sürede çözdük" sorusunu yanıtsız bırakırdı.
 */
export const DESTEK_DURUM = ["acik", "islemde", "beklemede", "cozuldu", "kapandi"] as const;

export type DestekDurumu = (typeof DESTEK_DURUM)[number];

// Kiracı (kuruluş) durumları — admin panelde kullanılır
export const KIRACI_DURUM = ["aktif", "askida", "pasif"] as const;

/**
 * Paket modülleri (Faz 5 / B4).
 *
 * Bir pakette listelenmeyen modül, o kiracının arayüzünde görünmez ve sayfası
 * açılmaz. Paketi olmayan kiracıda kısıtlama uygulanmaz (tüm modüller açıktır)
 * — böylece paket tanımlanmadan da sistem çalışır.
 */
export const PAKET_MODULLERI = [
  { deger: "firma", etiket: "Firmalar", izin: "firma.goruntule" },
  { deger: "yatirim", etiket: "Yatırım Destekleri", izin: "yatirim.goruntule" },
  { deger: "egitim", etiket: "Eğitimler", izin: "egitim.goruntule" },
  { deger: "hizmet", etiket: "Hizmetler", izin: "hizmet.goruntule" },
  { deger: "kisi", etiket: "Kişiler", izin: "kisi.goruntule" },
  { deger: "firsat", etiket: "Fırsatlar", izin: "firsat.goruntule" },
  { deger: "aktivite", etiket: "Aktiviteler", izin: "aktivite.goruntule" },
  { deger: "lead", etiket: "Adaylar (Lead)", izin: "lead.goruntule" },
  { deger: "teklif", etiket: "Teklifler", izin: "teklif.goruntule" },
  { deger: "takvim", etiket: "Takvim", izin: "takvim.goruntule" },
  { deger: "otomasyon", etiket: "İş Akışı Otomasyonu", izin: "otomasyon.goruntule" },
  { deger: "rapor", etiket: "Raporlar", izin: "rapor.goruntule" },
  { deger: "ozelalan", etiket: "Özel Alanlar", izin: "ozelalan.yonet" },
  // Faz 14 — ticari çekirdek. "stok" ayrı bir modüldür: hizmet satan bir
  // kuruluş katalogu kullanır ama stok tutmaz.
  { deger: "urun", etiket: "Ürünler ve Paketler", izin: "urun.goruntule" },
  { deger: "kampanya", etiket: "Kampanyalar", izin: "kampanya.goruntule" },
  { deger: "stok", etiket: "Stok Takibi", izin: "stok.goruntule" },
  // Faz 15 — sipariş ve sevkiyat. Sevkiyat ayrıdır: hizmet satan bir kuruluş
  // sipariş alır ama kargo göndermez.
  { deger: "siparis", etiket: "Siparişler", izin: "siparis.goruntule" },
  { deger: "sevkiyat", etiket: "Sevkiyat", izin: "sevkiyat.goruntule" },
  // Faz 16 — proje, destek kaydı ve bilgi bankası
  { deger: "proje", etiket: "Projeler", izin: "proje.goruntule" },
  { deger: "destek", etiket: "Destek Kayıtları", izin: "destek.goruntule" },
  { deger: "sss", etiket: "SSS / Bilgi Bankası", izin: "sss.goruntule" },
] as const;

export type PaketModulu = (typeof PAKET_MODULLERI)[number]["deger"];

/**
 * Bir izin anahtarı ("firma.olustur"), paketi kapalı bir modüle mi ait?
 *
 * İzin anahtarları "<modül>.<işlem>" biçiminde olduğu için modül adı ön ekten
 * okunur. Paket modülüyle eşleşmeyen ön ekler (ör. "kullanici", "kiraci")
 * hiçbir zaman kapatılmaz — paket iş verisi modüllerini kısıtlar, yönetim
 * yetkilerini değil.
 */
export function modulKapaliMi(izin: string, kapaliModuller: Set<string>): boolean {
  return kapaliModuller.has(izin.split(".")[0]);
}

export function durumBadge(durum: string) {
  return (
    DURUM_ETIKET[durum] ?? {
      label: durum,
      className: "bg-gray-100 text-gray-700",
    }
  );
}

/**
 * Departmanlar (v1.12.1) — kişi kaydındaki `departman` alanının seçenekleri.
 *
 * SABİT bir listedir ve kullanıcı elle değer giremez. Gerekçe: departman
 * raporlanabilir bir alandır ("hangi departmanla daha çok konuşuyoruz?");
 * serbest metin olsaydı "Satın Alma", "satinalma", "Satınalma Dept." aynı
 * şeyin üç ayrı değeri olur ve gruplama anlamsızlaşırdı. Unvan alanı serbest
 * kalır — kişinin kendi tanımı oradadır.
 *
 * Listeye eklemek güvenlidir; ÇIKARMAK değildir: eski kayıtlarda kalan değer
 * listede bulunmazsa arayüzde gösterilmeye devam eder ama seçilemez hâle
 * gelir (SecimKutusu bunu kendisi ele alır).
 */
export const DEPARTMANLAR = [
  "Yönetim Kurulu",
  "Genel Müdürlük",
  "Satış",
  "Pazarlama",
  "İş Geliştirme",
  "Müşteri İlişkileri",
  "Satın Alma",
  "Tedarik Zinciri",
  "Lojistik",
  "Depo",
  "Üretim",
  "Planlama",
  "Kalite Güvence",
  "Kalite Kontrol",
  "Ar-Ge",
  "Ür-Ge",
  "Mühendislik",
  "Bakım Onarım",
  "Bilgi Teknolojileri",
  "Yazılım Geliştirme",
  "Finans",
  "Muhasebe",
  "Bütçe ve Raporlama",
  "İnsan Kaynakları",
  "Eğitim ve Gelişim",
  "Hukuk",
  "İdari İşler",
  "İş Sağlığı ve Güvenliği",
  "Çevre ve Sürdürülebilirlik",
  "Dış Ticaret",
  "İhracat",
  "İthalat",
  "Proje Yönetimi",
  "Teknik Servis",
  "Halkla İlişkiler",
  "Kurumsal İletişim",
  "Risk ve Uyum",
  "İç Denetim",
  "Yatırım ve Teşvik",
  "Diğer",
] as const;

export type Departman = (typeof DEPARTMANLAR)[number];
