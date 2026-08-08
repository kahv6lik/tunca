import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-db";
import { etkinIzinler, yetkiVarMi, IZIN } from "@/lib/yetki";
import { takvimOgeleri, icsUret } from "@/lib/takvim";
import { turleriCoz } from "@/lib/takvim-tanimlar";

export const dynamic = "force-dynamic";

/**
 * Takvim dışa aktarımı (Faz 8 / D4).
 *
 * OTURUM GEREKTİRİR. Bilinçli olarak "gizli bağlantılı herkese açık akış"
 * (token'lı feed) yapılmadı: öyle bir bağlantı sızdığında müşteri
 * verisi kimlik doğrulaması olmadan okunabilir hâle gelirdi. Kullanıcı
 * dosyayı indirir ve takvim uygulamasına elle ekler.
 *
 * `/api` yolları `middleware.ts` eşleşmesinin dışındadır; bu yüzden oturum
 * kontrolü burada `getTenantContext` ile açıkça yapılır.
 */
export async function GET(req: NextRequest) {
  const { db, session } = await getTenantContext();

  if (!(await yetkiVarMi(IZIN.takvimGoruntule))) {
    return NextResponse.json({ hata: "Yetkisiz" }, { status: 403 });
  }

  const izinler = await etkinIzinler();

  const ay = req.nextUrl.searchParams.get("ay");
  const parcalar = ay?.match(/^(\d{4})-(\d{2})$/);
  const bugun = new Date();
  const yil = parcalar ? Number(parcalar[1]) : bugun.getFullYear();
  const ayNo = parcalar ? Number(parcalar[2]) - 1 : bugun.getMonth();

  // Dışa aktarımda tek ay yerine geniş bir pencere verilir: takvim
  // uygulamasına ekleyen kişi geçmişi ve önümüzdeki dönemi de görmek ister.
  const baslangic = new Date(yil, ayNo - 1, 1);
  const bitis = new Date(yil, ayNo + 3, 0, 23, 59, 59, 999);

  const herkes = req.nextUrl.searchParams.get("kim") === "herkes";
  const ogeler = await takvimOgeleri(
    db,
    izinler,
    baslangic,
    bitis,
    herkes ? undefined : session.userId,
    // Ekrandaki kategori süzgeci dosyaya da yansır (Faz 13 / H8): kullanıcı
    // "yalnızca görevlerim" görünümünü indirdiğinde onu bekler.
    turleriCoz(req.nextUrl.searchParams.get("tur"))
  );

  const ics = icsUret(ogeler, `Gezegen CRM — ${session.tenantAd}`);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="gezegen-crm-${yil}-${String(
        ayNo + 1
      ).padStart(2, "0")}.ics"`,
      // Takvim dosyası kişiye özeldir; ara katmanlarda önbelleğe alınmamalı.
      "Cache-Control": "private, no-store",
    },
  });
}
