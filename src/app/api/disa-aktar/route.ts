import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-db";
import { etkinIzinler } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { disaAktar, veriKumesiBul, BICIMLER, type Bicim } from "@/lib/disa-aktar";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Dışa aktarım uç noktası — Faz 9 / E1.
 *
 * OTURUM VE İZİN GEREKTİRİR. `/api` yolları `middleware.ts` eşleşmesinin
 * dışında olduğu için kontroller burada açıkça yapılır:
 *
 *   1. Oturum (`getTenantContext` — yoksa /login'e yönlendirir).
 *   2. Veri kümesinin kendi izni (ör. firmalar → `firma.goruntule`).
 *      Paketi kapalı bir modül `etkinIzinler()` içinde zaten düşürüldüğü
 *      için paket kısıtı burada da kendiliğinden geçerlidir.
 *   3. Veri kümesi TANIMLI olmalı; istemciden gelen rastgele bir ad
 *      çalıştırılamaz.
 *
 * Dışa aktarım denetim günlüğüne düşer: bir kullanıcının bütün müşteri
 * listesini indirmesi, sonradan görülebilmesi gereken bir olaydır.
 */
export async function GET(req: NextRequest) {
  const { db, session } = await getTenantContext();

  const sorgu = req.nextUrl.searchParams;
  const kumeAdi = sorgu.get("tur") ?? "";
  const kume = veriKumesiBul(kumeAdi);

  if (!kume) {
    return NextResponse.json({ hata: "Bilinmeyen veri kümesi" }, { status: 400 });
  }

  const izinler = await etkinIzinler();
  if (!izinler.has(kume.izin)) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 403 });
  }

  const bicimParam = sorgu.get("bicim") ?? "xlsx";
  const bicim: Bicim = BICIMLER.includes(bicimParam as Bicim)
    ? (bicimParam as Bicim)
    : "xlsx";

  // Listedeki süzgeçler aynen geçirilir — "ekranda gördüğümü indir".
  const filtre = {
    ara: sorgu.get("ara") ?? undefined,
    durum: sorgu.get("durum") ?? undefined,
    il: sorgu.get("il") ?? undefined,
    sektor: sorgu.get("sektor") ?? undefined,
    kaynak: sorgu.get("kaynak") ?? undefined,
    sorumlu: sorgu.get("sorumlu") ?? undefined,
    tur: sorgu.get("aktiviteTur") ?? undefined,
    atanan: sorgu.get("atanan") ?? undefined,
  };

  const sonuc = await disaAktar(db, kumeAdi, bicim, filtre, session.tenantAd);
  if (!sonuc) {
    return NextResponse.json({ hata: "Dışa aktarılamadı" }, { status: 400 });
  }

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firma", // denetimde "veri dışa aktarıldı" olayı olarak görünür
    varlikId: kumeAdi,
    ozet: `${kume.etiket} dışa aktarıldı (${sonuc.satir} satır, ${bicim.toUpperCase()})`,
    yeni: { veriKumesi: kumeAdi, bicim, satir: sonuc.satir, filtre },
  });

  return new NextResponse(sonuc.icerik as unknown as BodyInit, {
    headers: {
      "Content-Type": sonuc.mimeTuru,
      "Content-Disposition": `attachment; filename="${sonuc.dosyaAdi}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
