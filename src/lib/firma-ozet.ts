import "server-only";
import type { TenantClient } from "@/lib/tenant-db";
import { IZIN } from "@/lib/yetki";
import { OZET_KAYIT_SINIRI } from "@/lib/ai-tanimlar";
import {
  ozetSatirlari,
  type OzetGirdisi,
  type OzetSatiri,
} from "@/lib/firma-ozet-saf";
import { gunFarki } from "@/lib/skor-saf";

/**
 * Firma özetinin veri katmanı — Faz 21 / G2.
 *
 * İZİN SÜZGECİNDEN GEÇER (timeline, pano kartları ve firma dosyasındaki aynı
 * kural): izni olmayan modül HİÇ sorgulanmaz ve dolayısıyla özete de,
 * modele gönderilen metne de girmez. Özet, kullanıcının zaten göremediği
 * bir kaydı ona anlatan bir arka kapı olamaz.
 *
 * Kayıt sayısı sınırlıdır (`OZET_KAYIT_SINIRI`): özet bir liste değildir ve
 * modele yüzlerce satır göndermek hem masraflı hem de faydasızdır.
 */
export async function ozetGirdisiKur(
  db: TenantClient,
  firma: { id: string; ad: string; sektor: string | null; il: string | null },
  izinler: Set<string>,
  simdi = new Date()
): Promise<OzetGirdisi> {
  const [firsatlar, teklifler, siparisler, destekler, aktiviteler] =
    await Promise.all([
      izinler.has(IZIN.firsatGoruntule)
        ? db.firsat.findMany({
            where: { firmaId: firma.id },
            orderBy: { createdAt: "desc" },
            take: OZET_KAYIT_SINIRI,
            select: { baslik: true, durum: true, tutar: true },
          })
        : Promise.resolve([]),
      izinler.has(IZIN.teklifGoruntule)
        ? db.teklif.findMany({
            where: { firmaId: firma.id },
            orderBy: { createdAt: "desc" },
            take: OZET_KAYIT_SINIRI,
            select: { no: true, durum: true, toplam: true },
          })
        : Promise.resolve([]),
      izinler.has(IZIN.siparisGoruntule)
        ? db.siparis.findMany({
            where: { firmaId: firma.id },
            orderBy: { createdAt: "desc" },
            take: OZET_KAYIT_SINIRI,
            select: { no: true, durum: true, toplam: true },
          })
        : Promise.resolve([]),
      izinler.has(IZIN.destekGoruntule)
        ? db.destekKaydi.findMany({
            where: { firmaId: firma.id },
            orderBy: { createdAt: "desc" },
            take: OZET_KAYIT_SINIRI,
            select: { baslik: true, durum: true, oncelik: true },
          })
        : Promise.resolve([]),
      izinler.has(IZIN.aktiviteGoruntule)
        ? db.aktivite.findMany({
            where: { firmaId: firma.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { tur: true, baslik: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

  return {
    ad: firma.ad,
    sektor: firma.sektor,
    il: firma.il,
    firsatlar,
    teklifler,
    siparisler,
    destekler,
    sonAktiviteler: aktiviteler.map((a) => ({
      tur: a.tur,
      baslik: a.baslik,
      gunOnce: gunFarki(simdi, a.createdAt),
    })),
    paraBirimi: "TRY",
  };
}

/** Veriden üretilen satırlar — model olmadan da gösterilen hâli. */
export async function firmaOzetSatirlari(
  db: TenantClient,
  firma: { id: string; ad: string; sektor: string | null; il: string | null },
  izinler: Set<string>
): Promise<OzetSatiri[]> {
  return ozetSatirlari(await ozetGirdisiKur(db, firma, izinler));
}
