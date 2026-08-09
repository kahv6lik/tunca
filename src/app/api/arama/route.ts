import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getTenantDb } from "@/lib/tenant-db";
import { etkinIzinler } from "@/lib/yetki";
import { metinArama } from "@/lib/arama";
import { firmaNoMu } from "@/lib/firma-no-saf";
import {
  ARAMA_TURLERI,
  EN_AZ_TERIM,
  TUR_BASINA_SONUC,
  type AramaSonucu,
} from "@/lib/arama-tanimlar";

export const dynamic = "force-dynamic";

/**
 * Genel arama ucu — Faz 20 / U1.
 *
 * Komut paletinin veri kaynağı. İKİ KURAL:
 *
 *   1. İZNİ OLMAYAN MODÜL HİÇ SORGULANMAZ (timeline ve pano kartlarındaki
 *      aynı kural). Kullanıcının göremediği bir kayıt arama sonucunda
 *      belirirse, gizlenen menü hiçbir işe yaramamış olur.
 *   2. Sorgular kiracı katmanından geçer; arama kiracı sınırını aşamaz.
 *
 * Arama TÜRKÇE DUYARSIZDIR (`metinArama`, Faz 13 / H2): "ısparta" yazan
 * "ISPARTA"yı bulur.
 */
export async function GET(req: NextRequest) {
  const terim = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (terim.length < EN_AZ_TERIM) {
    return NextResponse.json({ sonuclar: [] });
  }

  const izinler = await etkinIzinler();
  const db = await getTenantDb();
  const acik = ARAMA_TURLERI.filter((t) => izinler.has(t.izin));

  const isteler = acik.map(async (t): Promise<AramaSonucu[]> => {
    switch (t.tur) {
      case "firma": {
        const kayitlar = await db.firma.findMany({
          where: {
            OR: [
              // Firma numarası yazıldıysa tam eşleşme (Faz 13 / H1).
              ...(firmaNoMu(terim) ? [{ firmaNo: terim.toUpperCase() }] : []),
              ...metinArama<Prisma.FirmaWhereInput>(terim, ["ad", "vergiNo", "il"]),
            ],
          },
          orderBy: { ad: "asc" },
          take: TUR_BASINA_SONUC,
          select: { id: true, ad: true, firmaNo: true, il: true },
        });
        return kayitlar.map((k) => ({
          tur: "firma",
          id: k.id,
          baslik: k.ad,
          alt: [k.firmaNo, k.il].filter(Boolean).join(" · ") || null,
          panel: true,
        }));
      }

      case "kisi": {
        const kayitlar = await db.kisi.findMany({
          where: { OR: metinArama<Prisma.KisiWhereInput>(terim, ["ad", "email", "unvan", "firma.ad"]) },
          orderBy: { ad: "asc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "kisi",
          id: k.id,
          baslik: k.ad,
          alt: [k.firma.ad, k.unvan].filter(Boolean).join(" · ") || null,
          panel: false,
        }));
      }

      case "firsat": {
        const kayitlar = await db.firsat.findMany({
          where: { OR: metinArama<Prisma.FirsatWhereInput>(terim, ["baslik", "firma.ad"]) },
          orderBy: { createdAt: "desc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "firsat",
          id: k.id,
          baslik: k.baslik,
          alt: k.firma.ad,
          panel: true,
        }));
      }

      case "teklif": {
        const kayitlar = await db.teklif.findMany({
          where: { OR: metinArama<Prisma.TeklifWhereInput>(terim, ["no", "baslik", "firma.ad"]) },
          orderBy: { createdAt: "desc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "teklif",
          id: k.id,
          baslik: `${k.no} — ${k.baslik}`,
          alt: k.firma.ad,
          panel: true,
        }));
      }

      case "siparis": {
        const kayitlar = await db.siparis.findMany({
          where: { OR: metinArama<Prisma.SiparisWhereInput>(terim, ["no", "firma.ad"]) },
          orderBy: { createdAt: "desc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "siparis",
          id: k.id,
          baslik: k.no,
          alt: k.firma.ad,
          panel: true,
        }));
      }

      case "proje": {
        const kayitlar = await db.proje.findMany({
          where: { OR: metinArama<Prisma.ProjeWhereInput>(terim, ["kod", "ad", "firma.ad"]) },
          orderBy: { kod: "asc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "proje",
          id: k.id,
          baslik: `${k.kod} — ${k.ad}`,
          alt: k.firma.ad,
          panel: false,
        }));
      }

      case "destek": {
        const kayitlar = await db.destekKaydi.findMany({
          where: { OR: metinArama<Prisma.DestekKaydiWhereInput>(terim, ["no", "baslik", "firma.ad"]) },
          orderBy: { createdAt: "desc" },
          take: TUR_BASINA_SONUC,
          include: { firma: { select: { ad: true } } },
        });
        return kayitlar.map((k) => ({
          tur: "destek",
          id: k.id,
          baslik: `${k.no} — ${k.baslik}`,
          alt: k.firma.ad,
          panel: true,
        }));
      }

      default:
        return [];
    }
  });

  const sonuclar = (await Promise.all(isteler)).flat();
  return NextResponse.json(
    { sonuclar },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
