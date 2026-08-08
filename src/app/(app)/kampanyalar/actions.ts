"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
  sahiplikDogrula,
  firmaSahipligiDogrula,
  type TenantClient,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { KAMPANYA_TIP, KAMPANYA_DURUM } from "@/lib/constants";
import { kodNormalize } from "@/lib/urun-tanimlar";
import { kampanyaIstemcisi, kampanyaKullan, kotaIade } from "@/lib/kampanya";

/**
 * Kampanya işlemleri — Faz 14 / T3, T4.
 *
 * Kampanya TANIMLAMAK fiyat politikasıdır (`kampanya.yonet`); kampanyayı
 * KULLANMAK satış işidir. İkisi ayrı izinlere bağlıdır — satış temsilcisi
 * kampanyayı uygulayabilmeli ama kendine %90 indirimli bir kampanya
 * tanımlayamamalıdır.
 */

const TIPLER = KAMPANYA_TIP.map((t) => t.deger) as [string, ...string[]];

const schema = z.object({
  kod: z.string().trim().min(1, "Kampanya kodu zorunludur.").max(40),
  ad: z.string().trim().min(1, "Kampanya adı zorunludur."),
  aciklama: z.string().trim().optional(),
  tip: z.enum(TIPLER),
  durum: z.enum(KAMPANYA_DURUM).default("taslak"),
  baslangic: z.string().min(1, "Başlangıç tarihi zorunludur."),
  bitis: z.string().min(1, "Bitiş tarihi zorunludur."),
  deger: z.coerce.number().min(0).default(0),
  alN: z.coerce.number().int().min(0).default(0),
  odeM: z.coerce.number().int().min(0).default(0),
  kota: z.coerce.number().int().min(0).default(0),
});

export type FormState = { error?: string; ok?: boolean };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

function revalidate() {
  revalidatePath("/kampanyalar");
}

/** Çoklu seçim alanlarını okur (`getAll`). */
function idler(formData: FormData, alan: string): string[] {
  return [...new Set(formData.getAll(alan).map((v) => String(v)).filter(Boolean))];
}

function ayristir(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }

  const baslangic = new Date(parsed.data.baslangic);
  // Bitiş GÜN SONUNA çekilir: "31 Ağustos"a kadar diyen kullanıcı o günü de
  // kapsamak ister (rapor tarih aralığındaki aynı tuzak, Faz 13 / H9).
  const bitisGunu = new Date(parsed.data.bitis);
  const bitis = new Date(
    bitisGunu.getFullYear(),
    bitisGunu.getMonth(),
    bitisGunu.getDate(),
    23, 59, 59, 999
  );

  if (Number.isNaN(baslangic.getTime()) || Number.isNaN(bitis.getTime())) {
    return { error: "Tarihler geçersiz." };
  }
  if (baslangic > bitis) {
    return { error: "Başlangıç tarihi bitişten sonra olamaz." };
  }

  const { tip, deger, alN, odeM } = parsed.data;

  // Tipe özgü doğrulama — hesaplanamayan bir kampanya kaydedilmemeli.
  if (tip === "yuzde" && (deger <= 0 || deger > 100)) {
    return { error: "Yüzde indirim 0 ile 100 arasında olmalıdır." };
  }
  if ((tip === "tutar" || tip === "paketfiyat") && deger <= 0) {
    return { error: "Tutar sıfırdan büyük olmalıdır." };
  }
  if (tip === "alnodem" && (alN <= 0 || odeM <= 0 || odeM >= alN)) {
    return { error: "\"X alana Y öde\" için X, Y'den büyük olmalıdır." };
  }

  return {
    data: {
      ...parsed.data,
      kod: kodNormalize(parsed.data.kod),
      baslangic,
      bitis,
    },
  };
}

/** Kapsam satırlarını (ürün/paket/firma) toplu yazar. */
async function kapsamYaz(
  db: TenantClient,
  kampanyaId: string,
  kapsam: { urunler: string[]; paketler: string[]; firmalar: string[] }
) {
  await db.kampanyaUrun.deleteMany({ where: { kampanyaId } });
  await db.kampanyaPaket.deleteMany({ where: { kampanyaId } });
  await db.kampanyaFirma.deleteMany({ where: { kampanyaId } });

  for (const urunId of kapsam.urunler) {
    await sahiplikDogrula(db, "urun", urunId);
    await tenantOlustur(db, "kampanyaUrun", { kampanyaId, urunId });
  }
  for (const paketId of kapsam.paketler) {
    await sahiplikDogrula(db, "paket", paketId);
    await tenantOlustur(db, "kampanyaPaket", { kampanyaId, paketId });
  }
  for (const firmaId of kapsam.firmalar) {
    await firmaSahipligiDogrula(db, firmaId);
    await tenantOlustur(db, "kampanyaFirma", { kampanyaId, firmaId });
  }
}

export async function kampanyaOlustur(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kampanyaYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { db } = await getTenantContext();
  const mevcut = await db.kampanya.findFirst({
    where: { kod: parsed.data.kod },
    select: { id: true },
  });
  if (mevcut) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const kampanya = await tenantOlustur(db, "kampanya", parsed.data);
  await kapsamYaz(db, kampanya.id, {
    urunler: idler(formData, "urunIdler"),
    paketler: idler(formData, "paketIdler"),
    firmalar: idler(formData, "firmaIdler"),
  });

  await denetimYaz({
    islem: "olustur",
    varlik: "Kampanya",
    varlikId: kampanya.id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

export async function kampanyaGuncelle(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.kampanyaYonet))) return { error: YETKISIZ };

  const parsed = ayristir(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { db } = await getTenantContext();
  const cakisan = await db.kampanya.findFirst({
    where: { kod: parsed.data.kod, id: { not: id } },
    select: { id: true },
  });
  if (cakisan) return { error: `"${parsed.data.kod}" kodu zaten kullanılıyor.` };

  const oncesi = await kayitOku(db, "kampanya", id);

  /**
   * `kullanilan` sayacı formdan ASLA yazılmaz — yalnızca `kotaDus`/`kotaIade`
   * onu değiştirir. Buradan yazılabilseydi, kota kontrolünün atomikliği
   * anlamsız olurdu: kullanıcı sayacı sıfırlayıp kotayı sınırsız kılabilirdi.
   */
  await tenantGuncelle(db, "kampanya", id, parsed.data);
  await kapsamYaz(db, id, {
    urunler: idler(formData, "urunIdler"),
    paketler: idler(formData, "paketIdler"),
    firmalar: idler(formData, "firmaIdler"),
  });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Kampanya",
    varlikId: id,
    ozet: `${parsed.data.kod} — ${parsed.data.ad}`,
    eski: oncesi,
    yeni: parsed.data,
  });

  revalidate();
  return { ok: true };
}

/** Durumu tek tıkla değiştirir (aktifleştir / duraklat). */
export async function kampanyaDurumDegistir(
  id: string,
  durum: string
): Promise<void> {
  if (!(await yetkiVarMi(IZIN.kampanyaYonet))) throw new Error(YETKISIZ);
  if (!(KAMPANYA_DURUM as readonly string[]).includes(durum)) {
    throw new Error("Geçersiz durum.");
  }

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "kampanya", id);
  await tenantGuncelle(db, "kampanya", id, { durum });

  await denetimYaz({
    islem: "guncelle",
    varlik: "Kampanya",
    varlikId: id,
    ozet: `${oncesi?.kod ?? ""} → ${durum}`,
    eski: { durum: oncesi?.durum },
    yeni: { durum },
  });

  revalidate();
}

export async function kampanyaSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.kampanyaYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "kampanya", id);

  /**
   * Kullanılmış kampanya SİLİNMEZ. Kullanım defteri, "hangi müşteriye ne
   * indirim verdik" sorusunun tek kaynağıdır; kampanyayı silmek onu cascade
   * ile götürür ve geçmiş satışların gerekçesi kaybolur. Doğru yol,
   * kampanyayı "sona erdi" durumuna almaktır.
   */
  const kullanim = await db.kampanyaKullanim.count({ where: { kampanyaId: id } });
  if (kullanim > 0) {
    throw new Error(
      `Bu kampanya ${kullanim} kez kullanılmış ve silinemez. ` +
        "Yeni satışlara kapatmak için durumunu \"Sona erdi\" yapın."
    );
  }

  await tenantSil(db, "kampanya", id);

  await denetimYaz({
    islem: "sil",
    varlik: "Kampanya",
    varlikId: id,
    ozet: `${oncesi?.kod ?? ""} — ${oncesi?.ad ?? ""}`,
    eski: oncesi,
  });

  revalidate();
}

/**
 * Kampanya kullanımını elle kaydeder (T4).
 *
 * Faz 15'te sipariş onayı bunu kendisi çağıracak; şimdilik satış temsilcisi
 * verdiği indirimi buradan işler. Kota düşümü atomiktir — aynı anda iki kişi
 * son adedi işleyemez.
 */
export async function kampanyaKullanimKaydet(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // Kullanmak satış işidir: TANIM izni değil, görüntüleme izni yeterlidir.
  if (!(await yetkiVarMi(IZIN.kampanyaGoruntule))) return { error: YETKISIZ };

  const kampanyaId = String(formData.get("kampanyaId") ?? "").trim();
  const firmaId = String(formData.get("firmaId") ?? "").trim();
  const adet = Number(formData.get("adet") ?? 1) || 0;
  const indirimTutari = Number(formData.get("indirimTutari") ?? 0) || 0;
  const referans = String(formData.get("referans") ?? "").trim() || null;

  if (!kampanyaId || !firmaId) return { error: "Kampanya ve firma seçin." };
  if (adet <= 0) return { error: "Adet sıfırdan büyük olmalıdır." };

  const { db, tenantId, session } = await getTenantContext();
  // Her ikisinin de bu kiracıya ait olduğu doğrulanır (A3).
  await sahiplikDogrula(db, "kampanya", kampanyaId);
  await firmaSahipligiDogrula(db, firmaId);

  const sonuc = await kampanyaKullan(kampanyaIstemcisi(db), tenantId, {
    kampanyaId,
    firmaId,
    adet,
    indirimTutari,
    referans,
    kullananId: session.userId,
  });

  if (!sonuc.ok) return { error: sonuc.hata };

  await denetimYaz({
    islem: "olustur",
    varlik: "Kampanya",
    varlikId: kampanyaId,
    ozet: `Kampanya kullanıldı — ${adet} adet`,
    yeni: { firmaId, adet, indirimTutari, referans },
  });

  revalidate();
  return { ok: true };
}

/** Kullanımı iptal eder ve kotayı iade eder. */
export async function kampanyaKullanimIptal(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.kampanyaYonet))) throw new Error(YETKISIZ);

  const { db, tenantId } = await getTenantContext();
  const kayit = (await kayitOku(db, "kampanyaKullanim", id)) as {
    kampanyaId: string;
    adet: number;
    iptal: boolean;
  } | null;

  if (!kayit) throw new Error("Kullanım kaydı bulunamadı.");
  if (kayit.iptal) return; // iki kez iptal, kotayı iki kez iade etmemeli

  // Kayıt SİLİNMEZ, işaretlenir: defterin bütünlüğü korunur.
  await tenantGuncelle(db, "kampanyaKullanim", id, { iptal: true });
  await kotaIade(kampanyaIstemcisi(db), tenantId, kayit.kampanyaId, kayit.adet);

  await denetimYaz({
    islem: "guncelle",
    varlik: "Kampanya",
    varlikId: kayit.kampanyaId,
    ozet: `Kullanım iptal edildi — ${kayit.adet} adet iade`,
    eski: { iptal: false },
    yeni: { iptal: true },
  });

  revalidate();
}
