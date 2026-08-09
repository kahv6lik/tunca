"use server";

import { revalidatePath } from "next/cache";
import { getTenantContext, kayitOku, sahiplikDogrula, firmaSahipligiDogrula } from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { kiraciAyari } from "@/lib/kiraci-ayar";
import { dosyaYukle, dosyaDiskteSil, type EkBaglami } from "@/lib/dosya";

/**
 * Dosya eki işlemleri — Faz 17 / A1.
 *
 * Ekler tek bir action'dan geçer çünkü kural her varlıkta AYNIDIR: tür
 * doğrulaması, boyut sınırı, kiracı kotası ve denetim kaydı. Her ekran kendi
 * yükleme action'ını yazsaydı, bu dört kuralın biri er ya da geç unutulurdu.
 */

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

/** Ekin bağlandığı kaydın gerçekten bu kiracıya ait olduğunu doğrular. */
async function baglamiCoz(
  db: Awaited<ReturnType<typeof getTenantContext>>["db"],
  formData: FormData
): Promise<{ baglam: EkBaglami; yol: string } | { hata: string }> {
  const firmaId = String(formData.get("firmaId") ?? "").trim();
  const aktiviteId = String(formData.get("aktiviteId") ?? "").trim();
  const destekId = String(formData.get("destekId") ?? "").trim();
  const siparisId = String(formData.get("siparisId") ?? "").trim();
  const teklifId = String(formData.get("teklifId") ?? "").trim();

  if (firmaId) {
    await firmaSahipligiDogrula(db, firmaId);
    return { baglam: { firmaId }, yol: `/firmalar/${firmaId}` };
  }
  if (aktiviteId) {
    await sahiplikDogrula(db, "aktivite", aktiviteId);
    return { baglam: { aktiviteId }, yol: "/aktiviteler" };
  }
  if (destekId) {
    await sahiplikDogrula(db, "destekKaydi", destekId);
    return { baglam: { destekId }, yol: `/destek/${destekId}` };
  }
  if (siparisId) {
    await sahiplikDogrula(db, "siparis", siparisId);
    return { baglam: { siparisId }, yol: `/siparisler/${siparisId}` };
  }
  if (teklifId) {
    await sahiplikDogrula(db, "teklif", teklifId);
    return { baglam: { teklifId }, yol: `/teklifler/${teklifId}` };
  }
  return { hata: "Ekin bağlanacağı kayıt belirtilmedi." };
}

export async function ekYukle(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.dosyaYukle))) return { error: YETKISIZ };

  const dosya = formData.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { error: "Dosya seçilmedi." };
  }

  const { db, tenantId, session } = await getTenantContext();
  const cozum = await baglamiCoz(db, formData);
  if ("hata" in cozum) return { error: cozum.hata };

  const ayar = await kiraciAyari();
  const icerik = new Uint8Array(await dosya.arrayBuffer());

  const sonuc = await dosyaYukle(
    db,
    tenantId,
    cozum.baglam,
    {
      ad: dosya.name,
      icerik,
      yukleyenId: session.userId,
      yukleyenEmail: session.email,
    },
    ayar.dosyaKotaMb
  );

  if (!sonuc.ok) return { error: sonuc.hata };

  await denetimYaz({
    islem: "olustur",
    varlik: "Dosya",
    varlikId: sonuc.id,
    ozet: dosya.name,
    yeni: { ad: dosya.name, boyut: icerik.byteLength, ...cozum.baglam },
  });

  revalidatePath(cozum.yol);
  return { ok: true };
}

/**
 * Eki siler.
 *
 * ÖNCE veritabanı satırı, SONRA disk: ters sırada bir hata, listede duran ama
 * indirilemeyen bir ek bırakırdı. Diskte kalan artık dosya ise görünmez ve
 * zararsızdır.
 */
export async function ekSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.dosyaSil))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const kayit = (await kayitOku(db, "dosya", id)) as
    | { ad: string; yol: string; firmaId: string | null; destekId: string | null;
        siparisId: string | null; teklifId: string | null }
    | null;
  if (!kayit) throw new Error("Ek bulunamadı.");

  await db.dosya.deleteMany({ where: { id } });
  await dosyaDiskteSil(kayit.yol);

  await denetimYaz({
    islem: "sil",
    varlik: "Dosya",
    varlikId: id,
    ozet: kayit.ad,
    eski: kayit,
  });

  if (kayit.firmaId) revalidatePath(`/firmalar/${kayit.firmaId}`);
  if (kayit.destekId) revalidatePath(`/destek/${kayit.destekId}`);
  if (kayit.siparisId) revalidatePath(`/siparisler/${kayit.siparisId}`);
  if (kayit.teklifId) revalidatePath(`/teklifler/${kayit.teklifId}`);
  revalidatePath("/aktiviteler");
}
