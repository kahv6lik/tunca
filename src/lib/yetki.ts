import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "./auth";
import { kiraciIstemcisi } from "./rls";
import { prisma } from "./db";
import { ROL_IZINLERI, rolNormalize, type Izin } from "./yetki-tanimlar";
import { kapaliModulIzinleri, modulKapaliMi } from "./kiraci-ayar";

/**
 * Rol tabanlı yetkilendirme — SUNUCU TARAFI (Faz 4 / A6, A7).
 *
 * Faz 1-3'te kiracı sınırı kuruldu: bir müşteri diğerinin verisini göremez.
 * Bu dosya bir sonraki soruyu yanıtlar: AYNI kiracı içinde kim neyi yapabilir?
 *
 * TEMEL KURAL: yetki kontrolü **her zaman sunucuda** yapılır. Arayüzde bir
 * düğmeyi gizlemek yalnızca kolaylıktır, koruma değildir — kullanıcı Server
 * Action'ı doğrudan çağırabilir.
 *
 * İzin anahtarları ve rol matrisi `yetki-tanimlar.ts` içindedir ve buradan
 * yeniden dışa aktarılır; çağıranlar tek bir yerden ithal edebilsin diye.
 */

export * from "./yetki-tanimlar";

// ── Etkin izinler ──────────────────────────────────────────────────────────

/**
 * Oturumdaki kullanıcının etkin izinleri:
 *
 *     (rol izinleri ∪ grup izinleri) ∖ paketi kapalı modüllerin izinleri
 *
 * Paket (Faz 5 / B4) yalnızca KISITLAR; hiçbir zaman izin eklemez. Kısıtın
 * burada uygulanması bilinçlidir: bütün sayfalar ve action'lar zaten
 * `yetkiGerektir` / `yetkiVarMi` üzerinden geçtiği için paket sınırı tek bir
 * yerde, otomatik olarak zorlanır.
 *
 * `cache()` ile istek başına bir kez hesaplanır — aynı sayfada onlarca kez
 * çağrılsa bile veritabanına tek sorgu gider.
 */
export const etkinIzinler = cache(async (): Promise<Set<string>> => {
  const session = await requireSession();
  const rol = rolNormalize(session.role);

  const izinler = new Set<string>(ROL_IZINLERI[rol] ?? []);

  // Grup izinleri — kiracı kapsamında okunur.
  const db = kiraciIstemcisi(session.tenantId, prisma);
  const uyelikler = await db.kullaniciGrup.findMany({
    where: { userId: session.userId },
    select: { grup: { select: { izinler: true } } },
  });
  for (const u of uyelikler) {
    for (const izin of u.grup.izinler) izinler.add(izin);
  }

  // Paket kısıtı
  const kapali = await kapaliModulIzinleri();
  if (kapali.size > 0) {
    for (const izin of [...izinler]) {
      if (modulKapaliMi(izin, kapali)) izinler.delete(izin);
    }
  }

  return izinler;
});

/** Yetki var mı? Arayüzde öğe gizlemek için kullanılır. */
export async function yetkiVarMi(izin: Izin): Promise<boolean> {
  return (await etkinIzinler()).has(izin);
}

/** Birden fazla izinden herhangi biri var mı? */
export async function herhangiYetkiVarMi(...izinler: Izin[]): Promise<boolean> {
  const etkin = await etkinIzinler();
  return izinler.some((i) => etkin.has(i));
}

/**
 * SAYFALAR için: yetki yoksa /yetkisiz sayfasına yönlendirir.
 *
 * Sayfanın veri okumasından ÖNCE çağrılmalıdır.
 */
export async function yetkiGerektir(izin: Izin): Promise<void> {
  if (!(await yetkiVarMi(izin))) {
    redirect(`/yetkisiz?izin=${encodeURIComponent(izin)}`);
  }
}

export class YetkiHatasi extends Error {
  constructor(public readonly izin: string) {
    super("Bu işlem için yetkiniz yok.");
    this.name = "YetkiHatasi";
  }
}

/**
 * SERVER ACTION'LAR için: yetki yoksa `YetkiHatasi` fırlatır.
 *
 * Action'lar hata mesajını kullanıcıya form durumu olarak döndürür; yönlendirme
 * yapmak form akışını bozardı.
 */
export async function yetkiZorunlu(izin: Izin): Promise<void> {
  if (!(await yetkiVarMi(izin))) {
    throw new YetkiHatasi(izin);
  }
}

/** Action'larda tekrarlayan try/catch'i sadeleştirir. */
export async function yetkiKontrolu(
  izin: Izin
): Promise<{ error?: string }> {
  if (!(await yetkiVarMi(izin))) {
    return { error: "Bu işlem için yetkiniz yok." };
  }
  return {};
}
