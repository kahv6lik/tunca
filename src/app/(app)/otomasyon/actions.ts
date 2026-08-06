"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getTenantContext,
  tenantOlustur,
  tenantGuncelle,
  tenantSil,
  kayitOku,
} from "@/lib/tenant-db";
import { IZIN, yetkiVarMi } from "@/lib/yetki";
import { denetimYaz } from "@/lib/denetim";
import { sifrele, coz } from "@/lib/sifreleme";
import { testGonder } from "@/lib/eposta";
import { kuraliCalistir } from "@/lib/is-akisi";

/**
 * E-posta ayarları — Faz 8 / D1 + D3.
 *
 * Parolalar şifreli saklanır (`src/lib/sifreleme.ts`) ve arayüze ASLA geri
 * gönderilmez; form boş bırakılırsa mevcut parola korunur. Bir ayar ekranının
 * parolayı geri yazması, ekranı açan herkesin parolayı okuyabilmesi demektir.
 */

const schema = z.object({
  smtpHost: z.string().trim().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpGuvenli: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  smtpKullanici: z.string().trim().optional(),
  smtpParola: z.string().optional(),
  gonderenAd: z.string().trim().optional(),
  gonderenAdres: z.string().trim().optional(),

  imapHost: z.string().trim().optional(),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapKullanici: z.string().trim().optional(),
  imapParola: z.string().optional(),
  imapKlasor: z.string().trim().default("INBOX"),

  aktif: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
});

export type FormState = { error?: string; ok?: boolean; bilgi?: string };

const YETKISIZ = "Bu işlem için yetkiniz yok.";

export async function epostaAyariKaydet(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.epostaAyarYonet))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  const d = parsed.data;

  if (d.aktif && !d.smtpHost) {
    return { error: "Gönderimi açmak için SMTP sunucusu zorunludur." };
  }

  const mevcut = await db.epostaAyari.findFirst({});

  // Parola alanı BOŞSA mevcut değer korunur — kullanıcı her kaydedişte
  // parolayı yeniden yazmak zorunda kalmasın.
  const smtpParola = d.smtpParola
    ? sifrele(d.smtpParola)
    : (mevcut?.smtpParola ?? null);
  const imapParola = d.imapParola
    ? sifrele(d.imapParola)
    : (mevcut?.imapParola ?? null);

  const veri = {
    smtpHost: d.smtpHost || null,
    smtpPort: d.smtpPort,
    smtpGuvenli: d.smtpGuvenli,
    smtpKullanici: d.smtpKullanici || null,
    smtpParola,
    gonderenAd: d.gonderenAd || null,
    gonderenAdres: d.gonderenAdres || null,
    imapHost: d.imapHost || null,
    imapPort: d.imapPort,
    imapKullanici: d.imapKullanici || null,
    imapParola,
    imapKlasor: d.imapKlasor || "INBOX",
    aktif: d.aktif,
  };

  if (mevcut) {
    await db.epostaAyari.updateMany({ where: { tenantId: session.tenantId }, data: veri });
  } else {
    await db.epostaAyari.create({ data: { tenantId: session.tenantId, ...veri } });
  }

  // Denetim günlüğüne parolalar YAZILMAZ; yalnızca neyin değiştiği.
  await denetimYaz({
    islem: mevcut ? "guncelle" : "olustur",
    varlik: "EpostaAyari",
    varlikId: session.tenantId,
    ozet: d.aktif ? "E-posta gönderimi açık" : "E-posta gönderimi kapalı",
    yeni: {
      smtpHost: veri.smtpHost,
      smtpPort: veri.smtpPort,
      gonderenAdres: veri.gonderenAdres,
      imapHost: veri.imapHost,
      aktif: veri.aktif,
    },
  });

  revalidatePath("/otomasyon/eposta");
  return { ok: true, bilgi: "Ayarlar kaydedildi." };
}

/**
 * Ayarları deneme postasıyla sınar.
 *
 * Kaydedilmiş ayarla test edilir (formdaki değerlerle değil): amaç
 * "kaydettiğim ayar çalışıyor mu?" sorusunu yanıtlamaktır.
 */
export async function epostaTest(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.epostaAyarYonet))) return { error: YETKISIZ };

  const { db, session } = await getTenantContext();
  const alici = String(formData.get("alici") ?? "").trim() || session.email;

  const ayar = await db.epostaAyari.findFirst({});
  if (!ayar?.smtpHost) {
    return { error: "Önce SMTP sunucusunu kaydedin." };
  }

  const sonuc = await testGonder(
    {
      host: ayar.smtpHost,
      port: ayar.smtpPort,
      guvenli: ayar.smtpGuvenli,
      kullanici: ayar.smtpKullanici,
      parola: coz(ayar.smtpParola),
      gonderenAd: ayar.gonderenAd,
      gonderenAdres: ayar.gonderenAdres,
    },
    alici
  );

  if (!sonuc.ok) {
    return { error: `Gönderilemedi: ${sonuc.hata}` };
  }
  return { ok: true, bilgi: `Deneme iletisi ${alici} adresine gönderildi.` };
}

// ── İş akışı kuralları (D2) ────────────────────────────────────────────────

const kuralSchema = z.object({
  ad: z.string().trim().min(1, "Kural adı zorunludur."),
  aciklama: z.string().trim().optional(),
  tetikleyici: z.string().trim().min(1, "Tetikleyici seçin."),
  gun: z.coerce.number().int().min(0).max(365).default(3),
  aktif: z.enum(["0", "1"]).default("1").transform((v) => v === "1"),
  eylemBildirim: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  eylemGorev: z.enum(["0", "1"]).default("0").transform((v) => v === "1"),
  eylemBaslik: z.string().trim().optional(),
  eylemMesaj: z.string().trim().optional(),
  gorevGun: z.coerce.number().int().min(0).max(90).default(1),
});

function eylemleriKur(d: z.infer<typeof kuralSchema>) {
  const eylemler: Record<string, unknown>[] = [];
  if (d.eylemBildirim) {
    eylemler.push({ tur: "bildirim", baslik: d.eylemBaslik || undefined, mesaj: d.eylemMesaj || undefined });
  }
  if (d.eylemGorev) {
    eylemler.push({
      tur: "gorev",
      baslik: d.eylemBaslik || undefined,
      mesaj: d.eylemMesaj || undefined,
      gun: d.gorevGun,
    });
  }
  return eylemler;
}

export async function kuralKaydet(
  id: string | null,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await yetkiVarMi(IZIN.otomasyonYonet))) return { error: YETKISIZ };

  const { db } = await getTenantContext();
  const parsed = kuralSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri." };
  }
  const d = parsed.data;

  const eylemler = eylemleriKur(d);
  if (eylemler.length === 0) {
    return { error: "En az bir eylem seçin (bildirim ya da görev)." };
  }

  const cakisma = await db.isAkisi.findFirst({
    where: { ad: d.ad, ...(id ? { NOT: { id } } : {}) },
  });
  if (cakisma) return { error: "Bu adda bir kural zaten var." };

  const veri = {
    ad: d.ad,
    aciklama: d.aciklama || null,
    tetikleyici: d.tetikleyici,
    kosullar: { gun: d.gun },
    eylemler,
    aktif: d.aktif,
  };

  if (id) {
    await tenantGuncelle(db, "isAkisi", id, veri);
  } else {
    await tenantOlustur(db, "isAkisi", veri);
  }

  await denetimYaz({
    islem: id ? "guncelle" : "olustur",
    varlik: "IsAkisi",
    varlikId: id ?? d.ad,
    ozet: d.ad,
    yeni: veri,
  });

  revalidatePath("/otomasyon");
  return { ok: true };
}

export async function kuralSil(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.otomasyonYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const oncesi = await kayitOku(db, "isAkisi", id);
  await tenantSil(db, "isAkisi", id);

  await denetimYaz({
    islem: "sil",
    varlik: "IsAkisi",
    varlikId: id,
    ozet: (oncesi?.ad as string) ?? undefined,
    eski: oncesi,
  });

  revalidatePath("/otomasyon");
}

export async function kuralDurumDegistir(id: string, aktif: boolean): Promise<void> {
  if (!(await yetkiVarMi(IZIN.otomasyonYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  await tenantGuncelle(db, "isAkisi", id, { aktif });

  await denetimYaz({
    islem: "guncelle",
    varlik: "IsAkisi",
    varlikId: id,
    ozet: aktif ? "Kural açıldı" : "Kural durduruldu",
    yeni: { aktif },
  });

  revalidatePath("/otomasyon");
}

/**
 * Kuralı elle çalıştırır.
 *
 * Zamanlanmış çalıştırmayı beklemeden denemek için. Aynı hedefe iki kez
 * bildirim gitmez; motor daha önce işlenmiş hedefleri atlar.
 */
export async function kuraliSimdiCalistir(id: string): Promise<void> {
  if (!(await yetkiVarMi(IZIN.otomasyonYonet))) throw new Error(YETKISIZ);

  const { db } = await getTenantContext();
  const kural = await db.isAkisi.findFirst({ where: { id } });
  if (!kural) return;

  await kuraliCalistir(db, {
    id: kural.id,
    ad: kural.ad,
    tetikleyici: kural.tetikleyici,
    kosullar: kural.kosullar,
    eylemler: kural.eylemler,
  });

  revalidatePath("/otomasyon");
  revalidatePath("/bildirimler");
}
