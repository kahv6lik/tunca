import { NextRequest, NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenant-db";
import { etkinIzinler } from "@/lib/yetki";
import { formatPara, formatTarih } from "@/lib/format";
import { DURUM_ETIKET } from "@/lib/constants";
import { aramaTuru, type OzetYanit, type OzetSatiri } from "@/lib/arama-tanimlar";

export const dynamic = "force-dynamic";

/**
 * Kayıt özeti ucu — Faz 20 / U2.
 *
 * Yan panelin veri kaynağı. Panel, listenin üstünde açılan ÖZET'tir; tam
 * detay sayfasının yerini almaz (yanıtta `rota` ile "tam sayfada aç"
 * bağlantısı taşınır).
 *
 * KURALLAR (arama ucundakiyle aynı):
 *   1. İzni olmayan tür hiç sorgulanmaz.
 *   2. Sorgu kiracı katmanından geçer.
 *
 * Biçimlendirme SUNUCUDA yapılır: panel türden bağımsız, düz bir
 * etiket/değer listesi çizer. Yeni bir tür eklemek buraya bir `case`
 * eklemektir; panelin kendisi değişmez.
 */

function durumEtiketi(durum: string): string {
  return DURUM_ETIKET[durum]?.label ?? durum;
}

/** Boş/anlamsız satırları eler — panelde "—" dolu bir liste istemiyoruz. */
function satirlar(
  ham: (readonly [string, string | number | null | undefined])[]
): OzetSatiri[] {
  return ham
    .filter(([, deger]) => deger !== null && deger !== undefined && deger !== "")
    .map(([etiket, deger]) => ({ etiket, deger: String(deger) }));
}

export async function GET(req: NextRequest) {
  const tur = req.nextUrl.searchParams.get("tur") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const tanim = aramaTuru(tur);

  if (!tanim || !id) {
    return NextResponse.json({ hata: "Geçersiz istek" }, { status: 400 });
  }

  const izinler = await etkinIzinler();
  if (!izinler.has(tanim.izin)) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 403 });
  }

  const db = await getTenantDb();
  const rota = `${tanim.rota}/${id}`;

  const yanit = await (async (): Promise<OzetYanit | null> => {
    switch (tur) {
      case "firma": {
        const k = await db.firma.findFirst({
          where: { id },
          include: {
            _count: { select: { kisiler: true, firsatlar: true, teklifler: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: k.ad,
          durum: k.durum,
          rota,
          satirlar: satirlar([
            ["Firma no", k.firmaNo],
            ["Sektör", k.sektor],
            ["İl / ilçe", [k.il, k.ilce].filter(Boolean).join(" / ")],
            ["Telefon", k.telefon],
            ["E-posta", k.email],
            ["Vergi no", k.vergiNo],
            ["Kontak", k._count.kisiler],
            ["Fırsat", k._count.firsatlar],
            ["Teklif", k._count.teklifler],
          ]),
        };
      }

      case "kisi": {
        const k = await db.kisi.findFirst({
          where: { id },
          include: { firma: { select: { ad: true } } },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: k.ad,
          durum: null,
          rota: `/firmalar/${k.firmaId}`,
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Unvan", k.unvan],
            ["Departman", k.departman],
            ["Telefon", k.telefon],
            ["E-posta", k.email],
            ["Birincil kontak", k.birincil ? "Evet" : null],
          ]),
        };
      }

      case "firsat": {
        const k = await db.firsat.findFirst({
          where: { id },
          include: {
            firma: { select: { ad: true } },
            asama: { select: { ad: true } },
            kisi: { select: { ad: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: k.baslik,
          durum: k.durum,
          rota: "/firsatlar",
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Aşama", k.asama.ad],
            ["Tutar", formatPara(k.tutar, k.paraBirimi)],
            ["Olasılık", `%${k.olasilik}`],
            [
              "Beklenen ciro",
              formatPara((k.tutar * k.olasilik) / 100, k.paraBirimi),
            ],
            ["Kapanış", k.kapanisTarihi ? formatTarih(k.kapanisTarihi) : null],
            ["Muhatap", k.kisi?.ad],
          ]),
        };
      }

      case "teklif": {
        const k = await db.teklif.findFirst({
          where: { id },
          include: {
            firma: { select: { ad: true } },
            _count: { select: { kalemler: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: `${k.no} — ${k.baslik}`,
          durum: k.durum,
          rota,
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Revizyon", k.revizyonNo],
            ["Kalem", k._count.kalemler],
            ["Ara toplam", formatPara(k.araToplam, k.paraBirimi)],
            ["Toplam", formatPara(k.toplam, k.paraBirimi)],
            [
              "Geçerlilik",
              k.gecerlilikTarihi ? formatTarih(k.gecerlilikTarihi) : null,
            ],
          ]),
        };
      }

      case "siparis": {
        const k = await db.siparis.findFirst({
          where: { id },
          include: {
            firma: { select: { ad: true } },
            _count: { select: { kalemler: true, sevkiyatlar: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: k.no,
          durum: k.durum,
          rota,
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Kalem", k._count.kalemler],
            ["Toplam", formatPara(k.toplam, k.paraBirimi)],
            ["Onay", k.onayTarihi ? formatTarih(k.onayTarihi) : null],
            ["Sevkiyat", k._count.sevkiyatlar || null],
            ["Ret sebebi", k.redSebebi],
          ]),
        };
      }

      case "proje": {
        const k = await db.proje.findFirst({
          where: { id },
          include: {
            firma: { select: { ad: true } },
            _count: { select: { teklifler: true, siparisler: true, destekler: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: `${k.kod} — ${k.ad}`,
          durum: k.durum,
          rota,
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Başlangıç", k.baslangic ? formatTarih(k.baslangic) : null],
            ["Bitiş", k.bitis ? formatTarih(k.bitis) : null],
            ["Bütçe", k.butce ? formatPara(k.butce, k.paraBirimi) : null],
            ["Teklif", k._count.teklifler || null],
            ["Sipariş", k._count.siparisler || null],
            ["Destek", k._count.destekler || null],
          ]),
        };
      }

      case "destek": {
        const k = await db.destekKaydi.findFirst({
          where: { id },
          include: {
            firma: { select: { ad: true } },
            _count: { select: { islemler: true } },
          },
        });
        if (!k) return null;
        return {
          tur,
          id,
          baslik: `${k.no} — ${k.baslik}`,
          durum: k.durum,
          rota,
          satirlar: satirlar([
            ["Firma", k.firma.ad],
            ["Öncelik", durumEtiketi(k.oncelik)],
            ["Kanal", durumEtiketi(k.kanal)],
            ["Açılış", formatTarih(k.createdAt)],
            ["Çözüm", k.cozumTarihi ? formatTarih(k.cozumTarihi) : null],
            ["İşlem", k._count.islemler || null],
          ]),
        };
      }

      default:
        return null;
    }
  })();

  if (!yanit) {
    return NextResponse.json({ hata: "Kayıt bulunamadı" }, { status: 404 });
  }

  return NextResponse.json(yanit, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
