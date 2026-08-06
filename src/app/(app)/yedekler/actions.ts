"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import {
  yedekOlustur,
  yedekAc,
  dosyadanIcerik,
  geriYukle,
  yedekIstemcisi,
} from "@/lib/yedek";

/**
 * Yedekleme işlemleri — Faz 10 / E7.
 *
 * Hepsi `yedek.yonet` iznine bağlıdır (varsayılan: kuruluş yöneticisi).
 * Yedek dosyası kuruluşun BÜTÜN iş verisini içerir; sıradan bir kullanıcının
 * onu indirebilmesi, bütün listeleri tek dosyada sızdırmak olurdu.
 */

export type YedekState = {
  error?: string;
  ok?: boolean;
  bilgi?: string;
  eklenen?: number;
  detay?: Record<string, number>;
};

const YETKISIZ = "Bu işlem için yetkiniz yok.";

export async function simdiYedekAl(): Promise<void> {
  if (!(await yetkiVarMi(IZIN.yedekYonet))) throw new Error(YETKISIZ);

  const { db, session } = await getTenantContext();
  const ozet = await yedekOlustur(yedekIstemcisi(db), session.tenantId, "elle", session.email);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firma", // denetimde "yedek alındı" olayı
    varlikId: ozet.id,
    ozet: `Yedek alındı (${ozet.kayitSayisi} kayıt, ${Math.round(ozet.boyut / 1024)} KB)`,
    yeni: { kayitSayisi: ozet.kayitSayisi, boyut: ozet.boyut },
  });

  revalidatePath("/yedekler");
}

export async function yedekSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.yedekYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  await db.yedek.deleteMany({ where: { id } });
  revalidatePath("/yedekler");
}

/**
 * Dosyadan yedek yükler — HENÜZ GERİ YÜKLEMEZ.
 *
 * Dosya doğrulanıp "yükleme" türünde bir Yedek kaydı olarak saklanır;
 * listede içeriği (kaç kayıt) görünür ve geri yükleme oradan, ayrı bir
 * onayla tetiklenir. İki adım bilinçlidir: veri yazan işlem, dosya seçme
 * ânından ayrılmalıdır.
 */
export async function dosyadanYukle(
  _prev: YedekState,
  formData: FormData
): Promise<YedekState> {
  if (!(await yetkiVarMi(IZIN.yedekYonet))) return { error: YETKISIZ };

  const dosya = formData.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { error: "Bir yedek dosyası seçin." };
  }
  if (dosya.size > 50 * 1024 * 1024) {
    return { error: "Dosya 50 MB'tan büyük olamaz." };
  }

  const icerik = dosyadanIcerik(Buffer.from(await dosya.arrayBuffer()));
  if (!icerik) {
    return {
      error:
        "Dosya tanınmadı. Yalnızca bu uygulamanın ürettiği yedek dosyaları yüklenebilir.",
    };
  }

  const { db, session } = await getTenantContext();
  const ozet = await yedekOlustur(
    yedekIstemcisi(db),
    session.tenantId,
    "yukleme",
    session.email,
    icerik
  );

  revalidatePath("/yedekler");
  return {
    ok: true,
    bilgi: `Dosya yüklendi (${ozet.kayitSayisi} kayıt). Listeden "Geri Yükle" ile uygulayın.`,
  };
}

/**
 * Saklanan bir yedeği geri yükler.
 *
 * EKLEYİCİDİR: yalnızca var olmayan kayıtlar eklenir, mevcutlara dokunulmaz.
 * İki kez çalıştırmak zararsızdır.
 */
export async function yedegiGeriYukle(
  id: string,
  _prev: YedekState,
  formData: FormData
): Promise<YedekState> {
  if (!(await yetkiVarMi(IZIN.yedekYonet))) return { error: YETKISIZ };

  if (String(formData.get("onay") ?? "") !== "1") {
    return { error: "Geri yüklemeyi onaylamanız gerekir." };
  }

  const { db, session } = await getTenantContext();
  const yedek = await db.yedek.findFirst({ where: { id } });
  if (!yedek) return { error: "Yedek bulunamadı." };

  const icerik = yedekAc(Buffer.from(yedek.icerik));
  if (!icerik) return { error: "Yedek içeriği açılamadı (bozuk olabilir)." };

  const sonuc = await geriYukle(yedekIstemcisi(db), session.tenantId, icerik);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firma", // denetimde "yedekten geri yükleme" olayı
    varlikId: id,
    ozet: `Yedekten geri yüklendi: ${sonuc.toplamEklenen} kayıt eklendi`,
    yeni: sonuc.eklenen,
  });

  revalidatePath("/yedekler");
  revalidatePath("/firmalar");
  revalidatePath("/");

  return {
    ok: true,
    eklenen: sonuc.toplamEklenen,
    detay: sonuc.eklenen,
    bilgi:
      sonuc.toplamEklenen === 0
        ? "Eklenecek yeni kayıt yoktu — yedekteki her şey zaten mevcut."
        : `${sonuc.toplamEklenen} kayıt geri yüklendi (mevcut kayıtlara dokunulmadı).`,
  };
}
