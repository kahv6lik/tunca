import "server-only";
import type { TenantClient } from "@/lib/tenant-db";
import {
  gunFarki,
  skorHesapla,
  skorTabani,
  type AcikIs,
  type GecmisIs,
  type Skor,
  type SkorTabani,
} from "@/lib/skor-saf";

/**
 * Skorlama veri katmanı — Faz 21 / G1.
 *
 * Hesabın kendisi `skor-saf.ts` içindedir ve testler onu veritabanı olmadan
 * sınar; burada yalnızca kiracının geçmişi okunur.
 *
 * DIŞ ÇAĞRI YOKTUR. Skor kiracının kendi verisinden çıkar; bu yüzden
 * `Tenant.aiAcik` kapalı olsa bile skor çalışır — kapatılan şey veriyi
 * DIŞARI göndermektir, kendi verisinden hesap yapmak değil.
 */

/** Skorlamanın dayandığı geçmiş penceresi (gün). */
const GECMIS_GUN = 730;

/**
 * Kiracının kapanmış fırsatlarından skor tabanını kurar.
 *
 * Pencere iki yıldır: daha eski işler bugünkü fiyat, ekip ve ürün gerçeğini
 * yansıtmaz; sınırsız geçmiş, değişen bir kuruluşta skoru geçmişe demirler.
 */
export async function tabanGetir(db: TenantClient): Promise<SkorTabani> {
  const esik = new Date(Date.now() - GECMIS_GUN * 86_400_000);

  const kapanmis = await db.firsat.findMany({
    where: {
      durum: { in: ["kazanildi", "kaybedildi"] },
      updatedAt: { gte: esik },
    },
    select: {
      durum: true,
      tutar: true,
      firma: { select: { sektor: true } },
    },
  });

  const gecmis: GecmisIs[] = kapanmis.map((f) => ({
    kazanildi: f.durum === "kazanildi",
    sektor: f.firma?.sektor ?? null,
    tutar: f.tutar,
    // Fırsatın kendi kaynak alanı yok; kaynak aday (Lead) kaydında tutulur.
    // Kırılım örneği yetersiz kalırsa saf katman zaten o etkeni atlar.
    kaynak: null,
  }));

  return skorTabani(gecmis);
}

/** Bir fırsatın skoru — çağıran, listedeki her satır için taban'ı yeniden kurmaz. */
export function firsatSkoru(
  firsat: {
    tutar: number;
    asama: { olasilik: number } | null;
    firma: { sektor: string | null } | null;
    aktiviteler: { createdAt: Date }[];
  },
  taban: SkorTabani,
  simdi = new Date()
): Skor {
  const sonTemas = firsat.aktiviteler.reduce<Date | null>(
    (en, a) => (en === null || a.createdAt > en ? a.createdAt : en),
    null
  );

  const is: AcikIs = {
    sektor: firsat.firma?.sektor ?? null,
    tutar: firsat.tutar,
    kaynak: null,
    asamaOlasilik: firsat.asama?.olasilik ?? 0,
    sonTemasGun: sonTemas ? gunFarki(simdi, sonTemas) : null,
    aktiviteSayisi: firsat.aktiviteler.length,
  };

  return skorHesapla(is, taban);
}

/**
 * Aday (lead) skor tabanı — Faz 21 / G1.
 *
 * Fırsattan AYRI bir taban kullanılır çünkü soru farklıdır: fırsatta
 * "kazanır mıyız", adayda "gerçek bir işe dönüşür mü". İkisini tek havuzda
 * toplamak, iki farklı olasılığı tek rakama karıştırırdı.
 *
 * Sektör ve kaynak kırılımları adayın KENDİ alanlarından gelir; dönüşen
 * aday silinmediği için (Faz 7 kararı) geçmiş eksiksizdir.
 */
export async function adayTabaniGetir(db: TenantClient): Promise<SkorTabani> {
  const esik = new Date(Date.now() - GECMIS_GUN * 86_400_000);

  const kapanmis = await db.lead.findMany({
    where: {
      durum: { in: ["donusturuldu", "elendi"] },
      updatedAt: { gte: esik },
    },
    select: { durum: true, sektor: true, kaynak: true },
  });

  const gecmis: GecmisIs[] = kapanmis.map((l) => ({
    kazanildi: l.durum === "donusturuldu",
    sektor: l.sektor,
    tutar: 0,
    kaynak: l.kaynak,
  }));

  return skorTabani(gecmis);
}

/**
 * Bir adayın skoru.
 *
 * Adayda aşama yoktur; onun yerine DURUM bir ilerleme göstergesidir
 * (yeni → iletişim → nitelikli). Bu eşleme kullanıcının süreç bilgisinin
 * fırsattaki aşama olasılığına karşılık gelen hâlidir.
 */
const ADAY_DURUM_OLASILIK: Record<string, number> = {
  yeni: 20,
  iletisim: 40,
  nitelikli: 65,
};

export function adaySkoru(
  lead: {
    durum: string;
    sektor: string | null;
    kaynak: string | null;
    createdAt: Date;
  },
  taban: SkorTabani,
  simdi = new Date()
): Skor {
  // Adayda aktivite bağı zorunlu değildir; "temas" yerine kaydın YAŞI
  // kullanılır — bekleyen aday soğur.
  const yasGun = gunFarki(simdi, lead.createdAt);

  const is: AcikIs = {
    sektor: lead.sektor,
    tutar: 0,
    kaynak: lead.kaynak,
    asamaOlasilik: ADAY_DURUM_OLASILIK[lead.durum] ?? 20,
    sonTemasGun: yasGun,
    aktiviteSayisi: 1,
  };

  return skorHesapla(is, taban);
}
