"use server";

import { getTenantDb } from "@/lib/tenant-db";
import { etkinIzinler, yetkiGerektir, IZIN } from "@/lib/yetki";
import { aiCagir, aiDurumu } from "@/lib/ai";
import { aiKapaliSebebi, aiKullanilabilir } from "@/lib/ai-tanimlar";
import {
  jsonAyikla,
  sorguAdresi,
  sorguCoz,
  sorguDogrula,
  sorguSistemIstemi,
} from "@/lib/sorgu-saf";
import { ozetGirdisiKur } from "@/lib/firma-ozet";
import {
  OZET_SISTEM_ISTEMI,
  ozetIstemi,
  ozetSatirlari,
} from "@/lib/firma-ozet-saf";

/**
 * AI action'ları — Faz 21.
 *
 * Firma özetini AKICILAŞTIRMA isteği ayrı bir action'dır ve KULLANICININ
 * TIKLAMASIYLA çalışır. Sayfa açılışında kendiliğinden model çağırmak, her
 * firma görüntülemesini ücretli bir isteğe çevirirdi; veriden üretilen özet
 * zaten sayfada duruyor, model yalnızca istenirse devreye girer.
 */
export async function firmaOzetiAkicilastir(
  firmaId: string
): Promise<{ ok: boolean; metin: string }> {
  await yetkiGerektir(IZIN.aiKullan);

  const db = await getTenantDb();
  // Kiracı katmanı `where`e tenantId ekler: başka kiracının firma id'siyle
  // gelen istek kayıt bulamaz.
  const firma = await db.firma.findFirst({
    where: { id: firmaId },
    select: { id: true, ad: true, sektor: true, il: true },
  });
  if (!firma) return { ok: false, metin: "Firma bulunamadı." };

  const izinler = await etkinIzinler();
  const girdi = await ozetGirdisiKur(db, firma, izinler);
  const satirlar = ozetSatirlari(girdi);

  const sonuc = await aiCagir(
    "ozet",
    `Firma özeti · ${firma.ad}`,
    ozetIstemi(firma.ad, satirlar),
    { sistem: OZET_SISTEM_ISTEMI, enFazlaToken: 400 }
  );

  return sonuc.ok
    ? { ok: true, metin: sonuc.metin }
    : { ok: false, metin: sonuc.hata };
}

/**
 * Doğal dilde sorgu — Faz 21 / G3.
 *
 * İKİ YOL, TEK DOĞRULAMA:
 *   1. Önce kural tabanlı ayrıştırıcı denenir (anahtarsız da çalışır).
 *   2. Çözemezse ve AI açıksa modele sorulur — modele YALNIZCA cümle ve
 *      alan sözlüğü gider, hiçbir müşteri verisi gitmez.
 *
 * Her iki yolun çıktısı da `sorguDogrula`'dan geçer: tanımsız hedef
 * reddedilir, beyaz listede olmayan alan sessizce atılır. Sorguyu HER ZAMAN
 * uygulama çalıştırır; yani kiracı sınırı, RLS ve izinler yerinde kalır.
 */
export async function dogalDildeSorgu(
  cumle: string
): Promise<{ ok: boolean; adres?: string; aciklama?: string; hata?: string }> {
  await yetkiGerektir(IZIN.aiKullan);
  const izinler = await etkinIzinler();

  const temiz = cumle.trim();
  if (temiz.length < 3) return { ok: false, hata: "Sorgu çok kısa." };

  // 1) Kural tabanlı
  const kural = sorguCoz(temiz);
  if (kural) {
    const dogrulanmis = sorguDogrula(kural, izinler);
    if (dogrulanmis) {
      return {
        ok: true,
        adres: sorguAdresi(dogrulanmis.hedef, dogrulanmis.qs),
        aciklama: kural.aciklama,
      };
    }
  }

  // 2) Model — yalnızca açıksa.
  const durum = await aiDurumu();
  if (!aiKullanilabilir(durum)) {
    return {
      ok: false,
      hata:
        "Bu cümleyi anlayamadım. " +
        (aiKapaliSebebi(durum) ?? "") +
        " Süzgeçleri elle kullanabilirsiniz.",
    };
  }

  const sonuc = await aiCagir("sorgu", `Doğal dilde sorgu`, temiz, {
    sistem: sorguSistemIstemi(),
    enFazlaToken: 200,
  });
  if (!sonuc.ok) return { ok: false, hata: sonuc.hata };

  const ham = jsonAyikla(sonuc.metin);
  if (!ham) return { ok: false, hata: "Sorgu anlaşılamadı." };

  const dogrulanmis = sorguDogrula(ham, izinler);
  if (!dogrulanmis) {
    return { ok: false, hata: "Bu cümleyi bir listeye bağlayamadım." };
  }

  return {
    ok: true,
    adres: sorguAdresi(dogrulanmis.hedef, dogrulanmis.qs),
    aciklama: dogrulanmis.hedef.etiket,
  };
}
