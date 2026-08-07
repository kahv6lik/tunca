import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-db";
import { denetimYaz } from "@/lib/denetim";
import { KVKK_SURUM } from "@/lib/kvkk-tanimlar";

export const dynamic = "force-dynamic";

/**
 * "Verilerimi indir" — KVKK m. 11 bilgi talebi (Faz 12 / F7).
 *
 * KENDİ verisidir: her kayıt `session.userId` ile sınırlanır, ek izin
 * aranmaz. Şifre özeti, 2FA sırrı ve yedek kod özetleri bilinçli olarak
 * DIŞARIDA bırakılır — bunlar kullanıcı hakkında bilgi değil, kimlik
 * doğrulama sırlarıdır ve dosyaya konmaları riski artırır, hakkı genişletmez.
 */
export async function GET() {
  const { db, session } = await getTenantContext();

  const [kullanici, oturumlar, denetim] = await Promise.all([
    db.user.findFirst({
      where: { id: session.userId },
      select: {
        id: true, email: true, name: true, role: true, durum: true,
        createdAt: true, sifreGuncellendi: true, ikiFaktorAktif: true,
        kvkkOnayTarihi: true, kvkkSurum: true,
      },
    }),
    db.oturum.findMany({
      where: { userId: session.userId },
      select: { cihaz: true, ip: true, sonGorulme: true, sonKullanma: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.denetimKaydi.findMany({
      where: { kullaniciId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        islem: true, varlik: true, varlikId: true, ozet: true, createdAt: true,
      },
    }),
  ]);

  const icerik = {
    bicim: 1,
    olusturma: new Date().toISOString(),
    kuruluş: session.tenantAd,
    aydinlatmaSurumu: KVKK_SURUM,
    aciklama:
      "Bu dosya hesabınıza ait kişisel verilerin bir kopyasıdır. Şifre özeti ve " +
      "iki faktörlü doğrulama sırları, kimlik doğrulama sırrı oldukları için " +
      "bilinçli olarak dahil edilmemiştir.",
    hesap: kullanici,
    acikOturumlar: oturumlar,
    islemGecmisi: denetim,
  };

  await denetimYaz({
    islem: "guncelle",
    varlik: "User",
    varlikId: session.userId,
    ozet: "KVKK veri kopyası indirildi",
  });

  const tarih = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(icerik, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kvkk-verilerim-${tarih}.json"`,
    },
  });
}
