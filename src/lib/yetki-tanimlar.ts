/**
 * Rol tabanlı yetkilendirme — TANIMLAR (Faz 4 / A6, A7).
 *
 * Bu dosya bilinçli olarak `server-only` DEĞİLDİR ve hiçbir şeye bağımlı
 * değildir: yalnızca izin anahtarları, roller ve matris. Böylece hem sunucu
 * kodu, hem istemci bileşenleri, hem de testler aynı tanımları kullanır.
 * Yetki KONTROLÜ için `src/lib/yetki.ts` kullanılır (o server-only'dir).
 *
 * Faz 1-3'te kiracı sınırı kuruldu: bir müşteri diğerinin verisini göremez.
 * Bu dosya bir sonraki soruyu yanıtlar: AYNI kiracı içinde kim neyi yapabilir?
 *
 * TEMEL KURAL: yetki kontrolü **her zaman sunucuda** yapılır. Arayüzde bir
 * düğmeyi gizlemek yalnızca kolaylıktır, koruma değildir — kullanıcı Server
 * Action'ı doğrudan çağırabilir.
 */

// ── İzin anahtarları ───────────────────────────────────────────────────────
// Biçim: "<modül>.<işlem>"
export const IZIN = {
  firmaGoruntule: "firma.goruntule",
  firmaOlustur: "firma.olustur",
  firmaDuzenle: "firma.duzenle",
  firmaSil: "firma.sil",

  yatirimGoruntule: "yatirim.goruntule",
  yatirimOlustur: "yatirim.olustur",
  yatirimDuzenle: "yatirim.duzenle",
  yatirimSil: "yatirim.sil",

  egitimGoruntule: "egitim.goruntule",
  egitimOlustur: "egitim.olustur",
  egitimDuzenle: "egitim.duzenle",
  egitimSil: "egitim.sil",

  hizmetGoruntule: "hizmet.goruntule",
  hizmetOlustur: "hizmet.olustur",
  hizmetDuzenle: "hizmet.duzenle",
  hizmetSil: "hizmet.sil",

  // Faz 6 — satış çekirdeği
  kisiGoruntule: "kisi.goruntule",
  kisiOlustur: "kisi.olustur",
  kisiDuzenle: "kisi.duzenle",
  kisiSil: "kisi.sil",

  firsatGoruntule: "firsat.goruntule",
  firsatOlustur: "firsat.olustur",
  firsatDuzenle: "firsat.duzenle",
  firsatSil: "firsat.sil",
  // Satış hattı aşamalarını tanımlama. Bilinçli olarak "firsat." ön ekiyle:
  // paket "firsat" modülünü kapattığında bu yetki de kendiliğinden düşer.
  asamaYonet: "firsat.asama",

  raporGoruntule: "rapor.goruntule",

  kullaniciYonet: "kullanici.yonet",
  grupYonet: "grup.yonet",
  denetimGoruntule: "denetim.goruntule",

  // Faz 5 (admin panel) burayı kullanacak
  kiraciYonet: "kiraci.yonet",
} as const;

export type Izin = (typeof IZIN)[keyof typeof IZIN];

export const TUM_IZINLER: Izin[] = Object.values(IZIN);

/** Arayüzde gösterilecek Türkçe etiketler (grup düzenleme ekranı için). */
export const IZIN_ETIKET: Record<string, string> = {
  "firma.goruntule": "Firmaları görüntüle",
  "firma.olustur": "Firma ekle",
  "firma.duzenle": "Firma düzenle",
  "firma.sil": "Firma sil",
  "yatirim.goruntule": "Yatırım desteklerini görüntüle",
  "yatirim.olustur": "Yatırım desteği ekle",
  "yatirim.duzenle": "Yatırım desteği düzenle",
  "yatirim.sil": "Yatırım desteği sil",
  "egitim.goruntule": "Eğitimleri görüntüle",
  "egitim.olustur": "Eğitim ekle",
  "egitim.duzenle": "Eğitim düzenle",
  "egitim.sil": "Eğitim sil",
  "hizmet.goruntule": "Hizmetleri görüntüle",
  "hizmet.olustur": "Hizmet ekle",
  "hizmet.duzenle": "Hizmet düzenle",
  "hizmet.sil": "Hizmet sil",
  "kisi.goruntule": "Kişileri görüntüle",
  "kisi.olustur": "Kişi ekle",
  "kisi.duzenle": "Kişi düzenle",
  "kisi.sil": "Kişi sil",
  "firsat.goruntule": "Fırsatları görüntüle",
  "firsat.olustur": "Fırsat ekle",
  "firsat.duzenle": "Fırsat düzenle",
  "firsat.sil": "Fırsat sil",
  "firsat.asama": "Satış hattı aşamalarını yönet",
  "rapor.goruntule": "Raporları görüntüle",
  "kullanici.yonet": "Kullanıcıları yönet",
  "grup.yonet": "Grupları yönet",
  "denetim.goruntule": "Denetim günlüğünü görüntüle",
  "kiraci.yonet": "Kiracıları yönet (platform)",
};

/** Grup düzenleme ekranında izinleri modüllere göre gruplamak için. */
export const IZIN_MODULLERI: { ad: string; izinler: Izin[] }[] = [
  { ad: "Firmalar", izinler: [IZIN.firmaGoruntule, IZIN.firmaOlustur, IZIN.firmaDuzenle, IZIN.firmaSil] },
  { ad: "Yatırım Destekleri", izinler: [IZIN.yatirimGoruntule, IZIN.yatirimOlustur, IZIN.yatirimDuzenle, IZIN.yatirimSil] },
  { ad: "Eğitimler", izinler: [IZIN.egitimGoruntule, IZIN.egitimOlustur, IZIN.egitimDuzenle, IZIN.egitimSil] },
  { ad: "Hizmetler", izinler: [IZIN.hizmetGoruntule, IZIN.hizmetOlustur, IZIN.hizmetDuzenle, IZIN.hizmetSil] },
  { ad: "Kişiler", izinler: [IZIN.kisiGoruntule, IZIN.kisiOlustur, IZIN.kisiDuzenle, IZIN.kisiSil] },
  { ad: "Fırsatlar", izinler: [IZIN.firsatGoruntule, IZIN.firsatOlustur, IZIN.firsatDuzenle, IZIN.firsatSil, IZIN.asamaYonet] },
  { ad: "Raporlar", izinler: [IZIN.raporGoruntule] },
  { ad: "Yönetim", izinler: [IZIN.kullaniciYonet, IZIN.grupYonet, IZIN.denetimGoruntule] },
];

// ── Roller ─────────────────────────────────────────────────────────────────
export const ROL = {
  platformAdmin: "platform_admin",
  tenantAdmin: "tenant_admin",
  uye: "uye",
  saltOkunur: "salt_okunur",
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];

export const ROL_ETIKET: Record<string, string> = {
  platform_admin: "Platform Yöneticisi",
  tenant_admin: "Kuruluş Yöneticisi",
  uye: "Üye",
  salt_okunur: "Salt Okunur",
};

const GORUNTULEME: Izin[] = [
  IZIN.firmaGoruntule,
  IZIN.yatirimGoruntule,
  IZIN.egitimGoruntule,
  IZIN.hizmetGoruntule,
  IZIN.kisiGoruntule,
  IZIN.firsatGoruntule,
  IZIN.raporGoruntule,
];

const IS_VERISI_TAM: Izin[] = [
  ...GORUNTULEME,
  IZIN.firmaOlustur, IZIN.firmaDuzenle, IZIN.firmaSil,
  IZIN.yatirimOlustur, IZIN.yatirimDuzenle, IZIN.yatirimSil,
  IZIN.egitimOlustur, IZIN.egitimDuzenle, IZIN.egitimSil,
  IZIN.hizmetOlustur, IZIN.hizmetDuzenle, IZIN.hizmetSil,
  IZIN.kisiOlustur, IZIN.kisiDuzenle, IZIN.kisiSil,
  IZIN.firsatOlustur, IZIN.firsatDuzenle, IZIN.firsatSil,
];

/**
 * Rol → izin matrisi.
 *
 * - `platform_admin` — platform sahibi. Kiracı yönetimi dahil her şey (Faz 5).
 * - `tenant_admin`   — kuruluş yöneticisi. Kendi kiracısında her şey; kullanıcı,
 *                      grup ve denetim günlüğü dahil.
 * - `uye`            — günlük kullanıcı. İş verisini görür, ekler, düzenler,
 *                      siler; yönetim ekranlarına erişemez.
 * - `salt_okunur`    — yalnızca görüntüleme.
 */
export const ROL_IZINLERI: Record<string, Izin[]> = {
  [ROL.platformAdmin]: TUM_IZINLER,
  [ROL.tenantAdmin]: [
    ...IS_VERISI_TAM,
    // Satış hattının biçimi kuruluş çapında bir karardır; her üye
    // değiştirebilseydi herkesin kanban'ı altından kayardı.
    IZIN.asamaYonet,
    IZIN.kullaniciYonet,
    IZIN.grupYonet,
    IZIN.denetimGoruntule,
  ],
  [ROL.uye]: IS_VERISI_TAM,
  [ROL.saltOkunur]: GORUNTULEME,
};

/**
 * Faz 4 öncesinden kalan rol adları. Eski `admin`/`user` değerleri taşınana
 * kadar (migration bunu yapar) burada karşılanır — böylece bir kullanıcı
 * yanlışlıkla yetkisiz kalmaz.
 */
const ESKI_ROL_ESLESMESI: Record<string, string> = {
  admin: ROL.tenantAdmin,
  user: ROL.uye,
};

export function rolNormalize(rol: string): string {
  return ESKI_ROL_ESLESMESI[rol] ?? rol;
}
