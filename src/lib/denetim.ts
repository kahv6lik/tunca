import "server-only";
import { requireSession } from "./auth";
import { kiraciIstemcisi } from "./rls";
import { prisma } from "./db";

/**
 * Denetim günlüğü (Faz 4 / A8).
 *
 * Kim, ne zaman, hangi kaydı değiştirdi — eski ve yeni değerleriyle.
 *
 * TASARIM KARARI: kayıtlar uygulama üzerinden **değiştirilemez ve silinemez.**
 * Ekranda yalnızca listeleme vardır; günlüğü değiştiren bir kod yolu yoktur.
 * Bir günlük, sonradan düzenlenebiliyorsa güvenilir değildir.
 */

export type DenetimIslemi = "olustur" | "guncelle" | "sil";

export type DenetimVarligi =
  | "Firma"
  | "YatirimDestegi"
  | "Egitim"
  | "Hizmet"
  | "Grup"
  | "User";

export const VARLIK_ETIKET: Record<string, string> = {
  Firma: "Firma",
  YatirimDestegi: "Yatırım Desteği",
  Egitim: "Eğitim",
  Hizmet: "Hizmet",
  Grup: "Grup",
  User: "Kullanıcı",
};

export const ISLEM_ETIKET: Record<string, { label: string; className: string }> = {
  olustur: { label: "Oluşturdu", className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25" },
  guncelle: { label: "Güncelledi", className: "bg-sky-500/15 text-sky-400 ring-sky-500/25" },
  sil: { label: "Sildi", className: "bg-rose-500/15 text-rose-400 ring-rose-500/25" },
};

/** Günlüğe yazılmayacak alanlar (gürültü veya hassas). */
const GIZLENEN_ALANLAR = new Set(["password", "tenantId", "createdAt", "updatedAt"]);

function temizle(veri: unknown): Record<string, unknown> | undefined {
  if (!veri || typeof veri !== "object") return undefined;
  const sonuc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(veri as Record<string, unknown>)) {
    if (GIZLENEN_ALANLAR.has(k)) continue;
    sonuc[k] = v instanceof Date ? v.toISOString() : v;
  }
  return Object.keys(sonuc).length ? sonuc : undefined;
}

/**
 * Yalnızca gerçekten değişen alanları döndürür. Bir güncellemede 12 alanın
 * 11'i aynıysa günlükte 11 gereksiz satır olmasın diye.
 */
function farklar(
  eski: Record<string, unknown> | undefined,
  yeni: Record<string, unknown> | undefined
): { eski?: Record<string, unknown>; yeni?: Record<string, unknown> } {
  if (!eski || !yeni) return { eski, yeni };
  const e: Record<string, unknown> = {};
  const y: Record<string, unknown> = {};
  for (const anahtar of new Set([...Object.keys(eski), ...Object.keys(yeni)])) {
    if (JSON.stringify(eski[anahtar]) !== JSON.stringify(yeni[anahtar])) {
      e[anahtar] = eski[anahtar];
      y[anahtar] = yeni[anahtar];
    }
  }
  return {
    eski: Object.keys(e).length ? e : undefined,
    yeni: Object.keys(y).length ? y : undefined,
  };
}

/**
 * Denetim kaydı yazar.
 *
 * Günlüğe yazma başarısız olursa asıl işlem GERİ ALINMAZ — kullanıcının işi
 * bir loglama hatası yüzünden kaybolmamalı. Hata sunucu günlüğüne düşer.
 */
export async function denetimYaz(opts: {
  islem: DenetimIslemi;
  varlik: DenetimVarligi;
  varlikId: string;
  ozet?: string;
  eski?: unknown;
  yeni?: unknown;
}): Promise<void> {
  try {
    const session = await requireSession();
    const db = kiraciIstemcisi(session.tenantId, prisma);

    const temizEski = temizle(opts.eski);
    const temizYeni = temizle(opts.yeni);
    const { eski, yeni } =
      opts.islem === "guncelle" ? farklar(temizEski, temizYeni) : { eski: temizEski, yeni: temizYeni };

    await db.denetimKaydi.create({
      data: {
        tenantId: session.tenantId,
        kullaniciId: session.userId,
        kullaniciEmail: session.email,
        islem: opts.islem,
        varlik: opts.varlik,
        varlikId: opts.varlikId,
        ozet: opts.ozet,
        eski: eski as never,
        yeni: yeni as never,
      },
    });
  } catch (e) {
    console.error("Denetim kaydı yazılamadı:", e);
  }
}
