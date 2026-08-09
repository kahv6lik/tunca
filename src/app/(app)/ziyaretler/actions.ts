"use server";

import { revalidatePath } from "next/cache";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  kayitOku,
  firmaSahipligiDogrula,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { bildirimGonder } from "@/lib/bildirim";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { konumDogrula, sureDakika, sureMetniDakika } from "@/lib/konum-saf";

/**
 * Saha ziyareti — Faz 17 / A4, A5.
 *
 * SÜRE KULLANICIDAN İSTENMEZ: başlangıç ve bitiş damgalarından hesaplanır.
 * "Kaç dakika kaldınız" sorusu tahminle doldurulur ve rapor anlamsızlaşırdı.
 *
 * KONUM YALNIZCA BAŞLANGIÇTA alınır — sürekli takip YOKTUR. Bu, KVKK
 * aydınlatma metninin (v1.12.2) verdiği sözdür ve buradaki uygulamayı bağlar.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function sayiOku(formData: FormData, alan: string): number | null {
  const ham = String(formData.get(alan) ?? "").trim();
  if (!ham) return null;
  const deger = Number(ham.replace(",", "."));
  return Number.isFinite(deger) ? deger : null;
}

/**
 * Ziyareti açar ve konumu O ANDA doğrular.
 *
 * Doğrulama sonucu ziyaret satırına YAZILIR ve bir daha hesaplanmaz: kuruluş
 * yarıçapı sonradan değişse bile geçmiş ziyaretlerin kararı sabit kalmalıdır
 * (`yaricapM` alanı bu yüzden kayıtta durur).
 */
export async function ziyaretBaslat(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.ziyaretOlustur))) return { error: YETKISIZ };

  const firmaId = String(formData.get("firmaId") ?? "").trim();
  if (!firmaId) return { error: "Firma seçilmedi." };

  const { db, session } = await getTenantContext();
  await firmaSahipligiDogrula(db, firmaId);

  // Aynı anda iki açık ziyaret olmaz: personel tek yerde olabilir ve
  // kapatılmayan ziyaretler süre raporunu bozar.
  const acik = await db.ziyaret.findFirst({
    where: { kullaniciId: session.userId, bitis: null },
    select: { id: true },
  });
  if (acik) {
    return { error: "Açık bir ziyaretiniz var; önce onu bitirin." };
  }

  const firma = await db.firma.findFirst({
    where: { id: firmaId },
    select: { ad: true, enlem: true, boylam: true },
  });
  if (!firma) return { error: "Firma bulunamadı." };

  const ayar = await kiraciAyari();
  const sonuc = konumDogrula(
    firma,
    { enlem: sayiOku(formData, "enlem"), boylam: sayiOku(formData, "boylam") },
    ayar.ziyaretYaricapM
  );

  const ziyaret = await tenantOlustur(db, "ziyaret", {
    firmaId,
    kullaniciId: session.userId,
    enlem: sayiOku(formData, "enlem"),
    boylam: sayiOku(formData, "boylam"),
    mesafeM: sonuc.mesafeM,
    dogrulama: sonuc.durum,
    yaricapM: ayar.ziyaretYaricapM,
  });

  // Konum uyuşmuyorsa YÖNETİCİYE haber gider. "Alınamadı" durumu bildirilmez:
  // teknik bir aksaklık yöneticinin zilini çalmamalı (karar 4).
  if (sonuc.durum === "uzak") {
    const yoneticiler = await db.user.findMany({
      where: { durum: "aktif", role: { in: ["tenant_admin", "admin"] } },
      select: { id: true },
    });
    for (const y of yoneticiler) {
      if (y.id === session.userId) continue;
      await bildirimGonder(db, {
        kullaniciId: y.id,
        tur: "ziyaret.konum",
        baslik: `Ziyaret konumu doğrulanamadı: ${firma.ad}`,
        mesaj: `${session.email} — ${sonuc.aciklama}`,
        link: `/ziyaretler`,
      });
    }
  }

  await denetimYaz({
    islem: "olustur",
    varlik: "Ziyaret",
    varlikId: ziyaret.id,
    ozet: `${firma.ad} — ${sonuc.aciklama}`,
    yeni: { firmaId, dogrulama: sonuc.durum, mesafeM: sonuc.mesafeM },
  });

  revalidatePath("/ziyaretler");
  revalidatePath(`/firmalar/${firmaId}`);
  return { ok: true };
}

/**
 * Ziyareti bitirir: süreyi damgalar ve AKTİVİTE kaydı yazar.
 *
 * Aktivite yazılmasının sebebi firma zaman akışıdır: ziyaret ayrı bir tabloda
 * dursa da "bu müşteriyle ne oldu" sorusu tek akıştan yanıtlanmaya devam
 * etmeli (destek işlemlerindeki aynı karar, v1.16.0).
 */
export async function ziyaretBitir(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.ziyaretOlustur))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const ziyaret = (await kayitOku(db, "ziyaret", id)) as
    | {
        firmaId: string;
        kullaniciId: string;
        baslangic: Date;
        bitis: Date | null;
        dogrulama: string;
        mesafeM: number | null;
        yaricapM: number;
      }
    | null;
  if (!ziyaret) return { error: "Ziyaret bulunamadı." };
  if (ziyaret.bitis) return { error: "Bu ziyaret zaten bitirilmiş." };

  const firma = await db.firma.findFirst({
    where: { id: ziyaret.firmaId },
    select: { ad: true },
  });

  const bitis = new Date();
  const dakika = sureDakika(ziyaret.baslangic, bitis);
  const not = String(formData.get("not") ?? "").trim();

  /**
   * Konum kararı aktivite açıklamasına da düşer: kaydı sonradan okuyan kişi
   * ziyaretin doğrulanıp doğrulanmadığını görmek için ayrı bir ekrana
   * gitmek zorunda kalmamalı.
   */
  const konumNotu =
    ziyaret.dogrulama === "dogrulandi"
      ? `Konum doğrulandı${ziyaret.mesafeM !== null ? ` (${ziyaret.mesafeM} m)` : ""}.`
      : ziyaret.dogrulama === "uzak"
        ? `Konum uyuşmadı: firmadan ${ziyaret.mesafeM} m uzakta (izin verilen ${ziyaret.yaricapM} m).`
        : "Konum doğrulanamadı.";

  const aktivite = await tenantOlustur(db, "aktivite", {
    tur: "toplanti",
    baslik: `Saha ziyareti — ${firma?.ad ?? ""}`.trim(),
    aciklama: [`Süre: ${sureMetniDakika(dakika)}.`, konumNotu, not]
      .filter(Boolean)
      .join(" "),
    firmaId: ziyaret.firmaId,
    olusturanId: session.userId,
    olusturanEmail: session.email,
  });

  await tenantGuncelle(db, "ziyaret", id, {
    bitis,
    sureDakika: dakika,
    not: not || null,
    aktiviteId: aktivite.id,
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Ziyaret",
    varlikId: id,
    ozet: `${firma?.ad ?? ""} ziyareti bitti (${sureMetniDakika(dakika)})`,
    eski: { bitis: null },
    yeni: { bitis, sureDakika: dakika },
  });

  revalidatePath("/ziyaretler");
  revalidatePath(`/firmalar/${ziyaret.firmaId}`);
  revalidatePath("/aktiviteler");
  return { ok: true };
}
