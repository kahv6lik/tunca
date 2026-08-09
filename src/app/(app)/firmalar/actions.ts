"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getTenantDb,
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { firmaLimitiAsildiMi } from "@/lib/kiraci-ayar";
import { alanlariGetir, formdanDegerler, degerleriKaydet } from "@/lib/ozel-alan";
import { sayacIstemcisi, siradakiFirmaNo } from "@/lib/firma-no-saf";
import { koordinatGecerliMi } from "@/lib/konum-saf";
import { adresMetni, adrestenKoordinat, geocodingAcikMi, yenidenGerekliMi } from "@/lib/geocode";

const firmaSchema = z.object({
  ad: z.string().trim().min(1, "Firma adı zorunludur."),
  vergiNo: z.string().trim().optional(),
  sektor: z.string().trim().optional(),
  il: z.string().trim().optional(),
  ilce: z.string().trim().optional(),
  yetkiliAd: z.string().trim().optional(),
  telefon: z.string().trim().optional(),
  email: z.string().trim().optional(),
  adres: z.string().trim().optional(),
  durum: z.enum(["aktif", "pasif"]).default("aktif"),
  notlar: z.string().trim().optional(),
  // Konum (Faz 17 / A3) — elle girilebilir; boş bırakılırsa anahtar
  // tanımlıysa adresten üretilir.
  enlem: z.string().trim().optional(),
  boylam: z.string().trim().optional(),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return firmaSchema.safeParse(raw);
}

type Konum = { enlem: number | null; boylam: number | null; konumKaynak: string | null; konumAdres: string | null };

/**
 * Formdan gelen koordinatı çözer; boşsa adresten üretmeyi dener.
 *
 * ELLE GİRİLEN KOORDİNAT ÜSTÜNDÜR: kullanıcı haritadan bakıp yazdıysa,
 * servisin bulduğu yaklaşık nokta onun üstüne yazılmamalıdır. Geocoding
 * yalnızca koordinat YOKKEN ve adres DEĞİŞTİĞİNDE çalışır (maliyet
 * koruması); anahtar tanımsızsa hiç çalışmaz ve kayıt yine de açılır.
 */
async function konumCoz(
  veri: { enlem?: string; boylam?: string; adres?: string; ilce?: string; il?: string },
  oncesi: { enlem: number | null; boylam: number | null; konumAdres: string | null } | null
): Promise<Konum> {
  const elle = {
    enlem: veri.enlem ? Number(String(veri.enlem).replace(",", ".")) : NaN,
    boylam: veri.boylam ? Number(String(veri.boylam).replace(",", ".")) : NaN,
  };
  if (koordinatGecerliMi(elle.enlem, elle.boylam)) {
    return {
      enlem: elle.enlem,
      boylam: elle.boylam,
      konumKaynak: "elle",
      konumAdres: adresMetni(veri),
    };
  }

  const adres = adresMetni(veri);
  const mevcut = oncesi ?? { enlem: null, boylam: null, konumAdres: null };

  if (geocodingAcikMi() && yenidenGerekliMi(mevcut, adres)) {
    const sonuc = await adrestenKoordinat(adres);
    if (sonuc.ok) {
      return {
        enlem: sonuc.enlem,
        boylam: sonuc.boylam,
        konumKaynak: "geocode",
        konumAdres: sonuc.adres,
      };
    }
    // Bulunamadıysa kayıt DÜŞMEZ: konum ikincil bir alandır.
  }

  return {
    enlem: mevcut.enlem,
    boylam: mevcut.boylam,
    konumKaynak: mevcut.enlem === null ? null : "geocode",
    konumAdres: mevcut.konumAdres,
  };
}

export async function createFirma(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firmaOlustur))) return { error: YETKISIZ };

  // Paket limiti (Faz 5 / B4) — kayıt oluşturmadan önce.
  const limitHatasi = await firmaLimitiAsildiMi();
  if (limitHatasi) return { error: limitHatasi };

  const { db, tenantId } = await getTenantContext();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  // Özel alanlar (Faz 11): kayıt yazılmadan ÖNCE doğrulanır.
  const alanlar = await alanlariGetir("firma");
  const ozel = formdanDegerler(alanlar, formData);
  if (!ozel.ok) return { error: ozel.hata };

  /**
   * Firma numarası (Faz 13 / H1) — oluşturma anında verilir ve bir daha
   * DEĞİŞMEZ: `updateFirma` şeması `firmaNo` alanını hiç tanımaz, yani
   * formdan gelse bile yok sayılır. Numara kullanıcıya söz verilen sabit
   * kimliktir; düzenlenebilir olsaydı iki firma aynı numarayı taşıyabilirdi.
   */
  const firmaNo = await siradakiFirmaNo(sayacIstemcisi(db), tenantId);
  const konum = await konumCoz(parsed.data, null);

  // tenantId, kiracı katmanı tarafından otomatik eklenir.
  const { enlem: _e, boylam: _b, ...alanlarVerisi } = parsed.data;
  const firma = await tenantOlustur(db, "firma", { ...alanlarVerisi, ...konum, firmaNo });
  await degerleriKaydet(db, "firma", firma.id, ozel.degerler);

  await denetimYaz({
    islem: "olustur",
    varlik: "Firma",
    varlikId: firma.id,
    ozet: `${firmaNo} — ${parsed.data.ad}`,
    yeni: { ...parsed.data, firmaNo, ozelAlanlar: Object.fromEntries(ozel.degerler) },
  });

  revalidatePath("/firmalar");
  redirect(`/firmalar/${firma.id}`);
}

export async function updateFirma(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.firmaDuzenle))) return { error: YETKISIZ };

  const db = await getTenantDb();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const alanlar = await alanlariGetir("firma");
  const ozel = formdanDegerler(alanlar, formData);
  if (!ozel.ok) return { error: ozel.hata };

  const oncesi = (await kayitOku(db, "firma", id)) as
    | { enlem: number | null; boylam: number | null; konumAdres: string | null }
    | null;
  const konum = await konumCoz(parsed.data, oncesi);
  const { enlem: _e, boylam: _b, ...alanlarVerisi } = parsed.data;

  // Kayıt bu kiracıya ait değilse 404 üretir (A3).
  await tenantGuncelle(db, "firma", id, { ...alanlarVerisi, ...konum });
  await degerleriKaydet(db, "firma", id, ozel.degerler);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Firma",
    varlikId: id,
    ozet: parsed.data.ad,
    eski: oncesi,
    yeni: { ...parsed.data, ozelAlanlar: Object.fromEntries(ozel.degerler) },
  });

  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${id}`);
  redirect(`/firmalar/${id}`);
}

export async function deleteFirma(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.firmaSil))) {
    throw new Error(YETKISIZ);
  }

  const db = await getTenantDb();
  const oncesi = await kayitOku(db, "firma", id);
  await tenantSil(db, "firma", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Firma",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidatePath("/firmalar");
  revalidatePath("/");
  revalidatePath("/raporlar");
  redirect("/firmalar");
}
