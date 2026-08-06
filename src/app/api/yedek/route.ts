import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-db";
import { yetkiVarMi, IZIN } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";

export const dynamic = "force-dynamic";

/**
 * Yedek indirme — Faz 10 / E7.
 *
 * Dosya gzip'li JSON olarak iner (uzantı `.json.gz`); geri yükleme ekranı
 * hem bu biçimi hem açılmış düz JSON'u kabul eder.
 *
 * `yedek.yonet` izni gerekir: dosya kuruluşun bütün iş verisini içerir.
 * Sorgu kiracı katmanından geçtiği için başka kiracının yedeği, id'si
 * bilinse bile indirilemez.
 */
export async function GET(req: NextRequest) {
  const { db, session } = await getTenantContext();

  if (!(await yetkiVarMi(IZIN.yedekYonet))) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const yedek = await db.yedek.findFirst({ where: { id } });
  if (!yedek) {
    return NextResponse.json({ hata: "Yedek bulunamadı" }, { status: 404 });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firma", // denetimde "yedek indirildi" olayı
    varlikId: yedek.id,
    ozet: `Yedek indirildi (${yedek.kayitSayisi} kayıt)`,
    yeni: { yedekId: yedek.id, tur: yedek.tur },
  });

  const tarih = yedek.createdAt.toISOString().slice(0, 10);
  const ad = `gezegen-yedek-${session.tenantSlug}-${tarih}.json.gz`;

  return new NextResponse(Buffer.from(yedek.icerik) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${ad}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
