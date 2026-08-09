import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-db";
import { yetkiVarMi, IZIN } from "@/lib/yetki";
import { dosyaOku, turBul } from "@/lib/dosya";

export const dynamic = "force-dynamic";

/**
 * Dosya eki indirme / gösterme — Faz 17 / A1.
 *
 * Sorgu KİRACI KATMANINDAN geçer: başka bir kiracının eki, id'si bilinse bile
 * bulunamaz (404). Dosyalar diskte kiracı klasörlerinde durur ama tek koruma
 * bu değildir — yol asla istemciden gelmez, veritabanı satırından okunur.
 *
 * `Content-Disposition`: görseller `inline` (önizleme için), diğer türler
 * `attachment`. Belgeyi tarayıcıda açmaya çalışmak, tür doğrulamasını
 * atlatabilecek içerikler için gereksiz bir risktir.
 *
 * `X-Content-Type-Options: nosniff` zorunludur: tarayıcı içeriğe bakıp kendi
 * tür kararını verirse, sunucudaki beyaz listenin bir anlamı kalmaz.
 */
export async function GET(req: NextRequest) {
  const { db } = await getTenantContext();

  if (!(await yetkiVarMi(IZIN.dosyaGoruntule))) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const kayit = await db.dosya.findFirst({ where: { id } });
  if (!kayit) {
    return NextResponse.json({ hata: "Dosya bulunamadı" }, { status: 404 });
  }

  let icerik: Buffer;
  try {
    icerik = await dosyaOku(kayit.yol);
  } catch {
    // Satır var ama disk yok: konteyner volume'süz kurulmuş olabilir.
    // Sessizce boş dönmek yerine açık bir hata verilir.
    return NextResponse.json({ hata: "Dosya depoda bulunamadı" }, { status: 410 });
  }

  const gorsel = turBul(kayit.mimeTuru)?.gorsel ?? false;
  const yerlesim = gorsel ? "inline" : "attachment";
  const ad = encodeURIComponent(kayit.ad);

  return new NextResponse(icerik as unknown as BodyInit, {
    headers: {
      "Content-Type": kayit.mimeTuru,
      "Content-Disposition": `${yerlesim}; filename*=UTF-8''${ad}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
