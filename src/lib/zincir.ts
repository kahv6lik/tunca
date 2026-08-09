import "server-only";
import type { TenantClient } from "@/lib/tenant-db";
import {
  ZINCIR,
  type ZincirHalkasi,
  type ZincirTuru,
} from "@/lib/zincir-tanimlar";

/**
 * İlişkili kayıt zincirini kurar — Faz 20 / U4.
 *
 * Giriş noktası zincirin HERHANGİ bir halkasıdır; kurucu önce o kayıttan
 * geriye doğru (sipariş → teklif → fırsat), sonra ileriye doğru (→ sevkiyat)
 * yürür.
 *
 * İKİ KURAL — sayfanın geri kalanındakiyle aynı:
 *   1. İzni olmayan halka HİÇ sorgulanmaz; ekranda "yetkiniz yok" değil,
 *      sessizce boş görünür (zaten göremeyeceği bir kaydın varlığını
 *      duyurmanın anlamı yok).
 *   2. Bütün sorgular kiracı katmanından geçer.
 */
export async function zinciriKur(
  db: TenantClient,
  giris: { tur: ZincirTuru; id: string },
  izinler: Set<string>
): Promise<ZincirHalkasi[]> {
  let firsatId: string | null = null;
  let teklifId: string | null = null;
  let siparisId: string | null = null;

  const gorur = (tur: ZincirTuru) =>
    izinler.has(ZINCIR.find((z) => z.tur === tur)!.izin);

  // ── Geriye doğru: girilen halkadan zincirin başına ─────────────────────
  if (giris.tur === "sevkiyat") {
    const sevkiyat = gorur("sevkiyat")
      ? await db.sevkiyat.findFirst({
          where: { id: giris.id },
          select: { siparisId: true },
        })
      : null;
    siparisId = sevkiyat?.siparisId ?? null;
  } else if (giris.tur === "siparis") {
    siparisId = giris.id;
  } else if (giris.tur === "teklif") {
    teklifId = giris.id;
  } else {
    firsatId = giris.id;
  }

  if (siparisId && !teklifId && gorur("siparis")) {
    const siparis = await db.siparis.findFirst({
      where: { id: siparisId },
      select: { teklifId: true },
    });
    teklifId = siparis?.teklifId ?? null;
  }

  if (teklifId && !firsatId && gorur("teklif")) {
    const teklif = await db.teklif.findFirst({
      where: { id: teklifId },
      select: { firsatId: true },
    });
    firsatId = teklif?.firsatId ?? null;
  }

  // ── İleriye doğru: eksik halkaları tamamla ─────────────────────────────
  // Bir fırsattan birden çok teklif çıkabilir; zincir EN SON olanı gösterir
  // (revizyon zincirinin ucu da odur) ve sayıyı başlığa yazar.
  let teklifSayisi = 0;
  if (firsatId && !teklifId && gorur("teklif")) {
    const [sonTeklif, sayi] = await Promise.all([
      db.teklif.findFirst({
        where: { firsatId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      db.teklif.count({ where: { firsatId } }),
    ]);
    teklifId = sonTeklif?.id ?? null;
    teklifSayisi = sayi;
  }

  if (teklifId && !siparisId && gorur("siparis")) {
    const siparis = await db.siparis.findFirst({
      where: { teklifId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    siparisId = siparis?.id ?? null;
  }

  // ── Halkaların içeriğini oku ───────────────────────────────────────────
  const [firsat, teklif, siparis, sevkiyatlar] = await Promise.all([
    firsatId && gorur("firsat")
      ? db.firsat.findFirst({
          where: { id: firsatId },
          select: { id: true, baslik: true, durum: true },
        })
      : Promise.resolve(null),
    teklifId && gorur("teklif")
      ? db.teklif.findFirst({
          where: { id: teklifId },
          select: { id: true, no: true, durum: true, revizyonNo: true },
        })
      : Promise.resolve(null),
    siparisId && gorur("siparis")
      ? db.siparis.findFirst({
          where: { id: siparisId },
          select: { id: true, no: true, durum: true },
        })
      : Promise.resolve(null),
    siparisId && gorur("sevkiyat")
      ? db.sevkiyat.findMany({
          where: { siparisId },
          orderBy: { createdAt: "desc" },
          select: { id: true, no: true, durum: true },
        })
      : Promise.resolve([]),
  ]);

  const sevkiyat = sevkiyatlar[0] ?? null;

  return ZINCIR.map((adim): ZincirHalkasi => {
    const izinsiz = !gorur(adim.tur);
    switch (adim.tur) {
      case "firsat":
        return {
          tur: adim.tur,
          etiket: adim.etiket,
          baslik: firsat?.baslik ?? null,
          durum: firsat?.durum ?? null,
          adres: firsat ? "/firsatlar" : null,
          aktif: giris.tur === "firsat",
          izinsiz,
        };
      case "teklif":
        return {
          tur: adim.tur,
          etiket: adim.etiket,
          baslik: teklif
            ? teklif.revizyonNo > 1
              ? `${teklif.no} (R${teklif.revizyonNo})`
              : teklif.no
            : null,
          durum: teklif?.durum ?? null,
          adres: teklif ? `/teklifler/${teklif.id}` : null,
          aktif: giris.tur === "teklif",
          izinsiz,
        };
      case "siparis":
        return {
          tur: adim.tur,
          etiket: adim.etiket,
          baslik: siparis?.no ?? null,
          durum: siparis?.durum ?? null,
          adres: siparis ? `/siparisler/${siparis.id}` : null,
          aktif: giris.tur === "siparis",
          izinsiz,
        };
      default:
        return {
          tur: adim.tur,
          etiket: adim.etiket,
          baslik: sevkiyat
            ? sevkiyatlar.length > 1
              ? `${sevkiyat.no} (+${sevkiyatlar.length - 1})`
              : sevkiyat.no
            : null,
          durum: sevkiyat?.durum ?? null,
          adres: siparis ? `/sevkiyat?siparis=${siparis.id}` : null,
          aktif: giris.tur === "sevkiyat",
          izinsiz,
        };
    }
  }).map((h) =>
    // Fırsattan birden çok teklif çıktıysa bunu başlıkta söyle.
    h.tur === "teklif" && h.baslik && teklifSayisi > 1
      ? { ...h, baslik: `${h.baslik} (+${teklifSayisi - 1})` }
      : h
  );
}
