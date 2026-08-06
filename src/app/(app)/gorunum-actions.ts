"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext, tenantOlustur } from "@/lib/tenant-db";
import { rolNormalize, ROL } from "@/lib/yetki-tanimlar";
import { sorguTemizle, GORUNUM_LISTELERI } from "@/lib/gorunum";

/**
 * Kayıtlı görünüm işlemleri — Faz 10 / E4.
 *
 * Ayrı bir izin anahtarı yoktur: görünüm kişisel bir kolaylıktır ve veri
 * YAZMAZ (yalnızca URL üretir). Yetki kuralları içeride uygulanır:
 * silme/değiştirme sahibine ya da kuruluş yöneticisine aittir.
 */

export type GorunumState = { error?: string; ok?: boolean };

const schema = z.object({
  liste: z.enum(GORUNUM_LISTELERI),
  ad: z.string().trim().min(1, "Görünüm adı zorunludur.").max(60),
  sorgu: z.string().max(2000),
  paylasilan: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  varsayilan: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
});

export async function gorunumKaydet(
  _prev: GorunumState,
  formData: FormData
): Promise<GorunumState> {
  const { db, session } = await getTenantContext();

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  const d = parsed.data;

  const sorgu = sorguTemizle(d.sorgu);
  if (!sorgu) {
    return { error: "Kaydedilecek bir filtre yok — önce listeyi süzün." };
  }

  const cakisma = await db.kayitliGorunum.findFirst({
    where: { kullaniciId: session.userId, liste: d.liste, ad: d.ad },
  });
  if (cakisma) return { error: "Bu adda bir görünümünüz zaten var." };

  // Kullanıcı başına liste sınırı: sınırsız birikinti hem menüyü hem
  // sorguyu şişirir.
  const sayi = await db.kayitliGorunum.count({
    where: { kullaniciId: session.userId, liste: d.liste },
  });
  if (sayi >= 20) return { error: "Bir listede en fazla 20 görünüm kaydedebilirsiniz." };

  // Yeni görünüm varsayılan yapılacaksa eskisinin işareti kalkar.
  if (d.varsayilan) {
    await db.kayitliGorunum.updateMany({
      where: { kullaniciId: session.userId, liste: d.liste, varsayilan: true },
      data: { varsayilan: false },
    });
  }

  await tenantOlustur(db, "kayitliGorunum", {
    kullaniciId: session.userId,
    liste: d.liste,
    ad: d.ad,
    sorgu,
    paylasilan: d.paylasilan,
    varsayilan: d.varsayilan,
  });

  revalidatePath(`/${d.liste}`);
  return { ok: true };
}

/** Sahiplik: görünümün sahibi ya da kuruluş yöneticisi. */
async function yetkiliMi(
  db: Awaited<ReturnType<typeof getTenantContext>>["db"],
  session: Awaited<ReturnType<typeof getTenantContext>>["session"],
  id: string
) {
  const gorunum = await db.kayitliGorunum.findFirst({ where: { id } });
  if (!gorunum) return null;

  const yonetici = rolNormalize(session.role) === ROL.tenantAdmin ||
    rolNormalize(session.role) === ROL.platformAdmin;
  if (gorunum.kullaniciId !== session.userId && !yonetici) return null;

  return gorunum;
}

export async function gorunumSil(id: string): Promise<void> {
  const { db, session } = await getTenantContext();

  const gorunum = await yetkiliMi(db, session, id);
  if (!gorunum) return;

  await db.kayitliGorunum.deleteMany({ where: { id } });
  revalidatePath(`/${gorunum.liste}`);
}

/**
 * Varsayılanı değiştirir. Varsayılan KİŞİSELDİR ve yalnızca kendi görünümüne
 * atanabilir — paylaşılan bir görünümü varsayılan yapmak isteyen kullanıcı
 * onu kopyalayarak kaydeder (böylece sahibi görünümü değiştirince kimsenin
 * varsayılanı habersiz değişmez).
 */
export async function gorunumVarsayilan(id: string, ac: boolean): Promise<void> {
  const { db, session } = await getTenantContext();

  const gorunum = await db.kayitliGorunum.findFirst({
    where: { id, kullaniciId: session.userId },
  });
  if (!gorunum) return;

  if (ac) {
    await db.kayitliGorunum.updateMany({
      where: { kullaniciId: session.userId, liste: gorunum.liste, varsayilan: true },
      data: { varsayilan: false },
    });
  }

  await db.kayitliGorunum.updateMany({
    where: { id },
    data: { varsayilan: ac },
  });

  revalidatePath(`/${gorunum.liste}`);
}
