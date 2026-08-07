"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { kimlikIstemcisi } from "@/lib/rls";
import {
  ipSinirlandiMi,
  denemeKaydet,
  hesapKilidi,
  basarisizDenemeIsle,
  basariliGirisIsle,
  oturumAc,
} from "@/lib/giris-guvenlik";
import { ikinciAsamaBileti, ikinciAsamaCoz } from "@/lib/iki-faktor";
import { totpDogrula, yedekKodNormalize } from "@/lib/guvenlik-totp";
import { coz } from "@/lib/sifreleme";
import bcrypt from "bcryptjs";

export type LoginState = {
  error?: string;
  kiraciSor?: boolean;
  /**
   * İkinci aşama bileti (Faz 12 / F2). Doluysa arayüz TOTP kodu ister;
   * bilet kısa ömürlü, imzalı ve tek bir kullanıcıya bağlıdır — şifre
   * ekranından geçildiğinin kanıtıdır, oturum değildir.
   */
  ikiFaktor?: string;
};

// Kiracıların birbirinin varlığını öğrenmesini engellemek için tüm başarısız
// denemelerde aynı mesaj döner.
const GENEL_HATA = "E-posta veya şifre hatalı.";

/** İstek başlıkları — hız sınırlama ve oturum kaydı için. */
async function istekBilgisi(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  // Nginx arkasında gerçek istemci adresi X-Forwarded-For'un İLK değeridir.
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, ua: h.get("user-agent") };
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const kiraciKodu = String(formData.get("kiraci") ?? "").trim().toLowerCase();

  if (!email || !password) {
    return { error: "E-posta ve şifre gereklidir." };
  }

  const { ip, ua } = await istekBilgisi();

  // F4 — IP bazlı hız sınırı: hesap aranmadan önce. Sözlük saldırısı,
  // hesabın var olup olmamasından bağımsız olarak durdurulmalıdır.
  const ipEngeli = await ipSinirlandiMi(ip);
  if (ipEngeli.engel) return { error: ipEngeli.mesaj };

  // Kiracılar ötesi okuma yapabilen TEK yer burasıdır ve bilinçlidir: kimlik
  // doğrulanmadan önce henüz bir kiracı bağlamı yoktur, kiracı zaten bu
  // sorgunun sonucunda belirlenir. Oturum açıldıktan sonraki her erişim
  // `src/lib/tenant-db.ts` üzerinden gider.
  //
  // `kimlikIstemcisi` RLS'te yalnızca User ve Tenant tablolarında SALT OKUMA
  // izni veren bağlamı açar; bu bağlamda hiçbir yazma yapılamaz ve iş verisi
  // (firma, yatırım, eğitim, hizmet) görünmez.
  //
  // Aynı e-posta farklı kiracılarda bulunabilir; adaylar arasından şifresi
  // doğrulanan ve kiracısı aktif olan hesap seçilir.
  const db = kimlikIstemcisi();
  const adaylar = await db.user.findMany({
    where: {
      email,
      ...(kiraciKodu ? { tenant: { slug: kiraciKodu } } : {}),
    },
    include: { tenant: true },
  });

  const eslesenler: typeof adaylar = [];
  for (const aday of adaylar) {
    if (await verifyPassword(password, aday.password)) {
      eslesenler.push(aday);
    }
  }

  if (eslesenler.length === 0) {
    await denemeKaydet(email, ip, false, "sifre");
    // Hesap varsa sayacı artır — ama yanıt her durumda aynı kalır.
    for (const aday of adaylar) {
      await basarisizDenemeIsle(aday.id, aday.basarisizGiris);
    }
    return { error: GENEL_HATA };
  }

  // Birden fazla kiracıda aynı e-posta + şifre: kiracı kodu istenir.
  if (eslesenler.length > 1) {
    return {
      error: "Birden fazla hesap bulundu. Lütfen kiracı kodunuzu girin.",
      kiraciSor: true,
    };
  }

  const user = eslesenler[0];

  // F4 — hesap kilidi. Şifre DOĞRU olsa bile kilitliyse girilemez; aksi halde
  // kilit, doğru şifreyi bulan saldırganı durdurmazdı.
  const kilit = hesapKilidi(user.kilitBitis);
  if (kilit.engel) {
    await denemeKaydet(email, ip, false, "kilit");
    return { error: kilit.mesaj };
  }

  // Pasifleştirilen kullanıcı giriş yapamaz (Faz 5 / B2). Verisi ve geçmişi
  // silinmediği için hesabı yeniden açıldığında her şey yerinde kalır.
  if (user.durum !== "aktif") {
    await denemeKaydet(email, ip, false, "pasif");
    return {
      error: "Hesabınız devre dışı bırakılmış. Yöneticinizle görüşün.",
    };
  }

  if (user.tenant.durum !== "aktif") {
    await denemeKaydet(email, ip, false, "pasif");
    return {
      error:
        "Hesabınızın bağlı olduğu kuruluşun erişimi durdurulmuş. Yöneticinizle görüşün.",
    };
  }

  // F2 — iki faktör açıksa oturum HENÜZ açılmaz; ikinci aşama bileti verilir.
  if (user.ikiFaktorAktif && user.ikiFaktorSir) {
    return { ikiFaktor: await ikinciAsamaBileti(user.id) };
  }

  return girisiTamamla(user, ip, ua);
}

/** Oturumu açar ve panele yönlendirir. İki aşamanın da ortak son adımı. */
async function girisiTamamla(
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    tenant: { slug: string; ad: string; oturumOmruGun: number };
  },
  ip: string | null,
  ua: string | null
): Promise<never> {
  await basariliGirisIsle(user.id);
  await denemeKaydet(user.email, ip, true);

  const omurGun = user.tenant.oturumOmruGun > 0 ? user.tenant.oturumOmruGun : 7;
  const jti = await oturumAc({
    tenantId: user.tenantId,
    userId: user.id,
    ua,
    ip,
    omurGun,
  });

  await createSession(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      jti,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantAd: user.tenant.ad,
    },
    omurGun * 86_400
  );

  redirect("/");
}

/**
 * İkinci aşama: TOTP kodu ya da yedek kod (Faz 12 / F2).
 *
 * Bilet, şifre aşamasının geçildiğinin imzalı kanıtıdır ve 5 dakika yaşar.
 * Kodun kendisi kullanıcıya değil, bilete bağlı olarak doğrulanır — istemci
 * hangi hesabın doğrulandığını seçemez.
 */
export async function ikiFaktorAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const bilet = String(formData.get("bilet") ?? "");
  const kod = String(formData.get("kod") ?? "").trim();

  const userId = await ikinciAsamaCoz(bilet);
  if (!userId) {
    return { error: "Doğrulama süresi doldu. Lütfen yeniden giriş yapın." };
  }

  const { ip, ua } = await istekBilgisi();

  const db = kimlikIstemcisi();
  const user = await db.user.findFirst({ where: { id: userId }, include: { tenant: true } });
  if (!user || user.durum !== "aktif" || user.tenant.durum !== "aktif") {
    return { error: "Doğrulama başarısız. Lütfen yeniden giriş yapın." };
  }

  const kilit = hesapKilidi(user.kilitBitis);
  if (kilit.engel) return { error: kilit.mesaj, ikiFaktor: bilet };

  const sir = coz(user.ikiFaktorSir);
  const totpGecerli = sir ? totpDogrula(sir, kod) : false;

  // Yedek kod: telefonu kaybeden kullanıcının tek çıkışı. Tek kullanımlıktır
  // ve doğrulanınca listeden düşer.
  let yedekGecerli = false;
  if (!totpGecerli && kod.length >= 8) {
    const normal = yedekKodNormalize(kod);
    for (const ozet of user.yedekKodlar) {
      if (await bcrypt.compare(normal, ozet)) {
        yedekGecerli = true;
        const { yedekKoduTuket } = await import("@/lib/iki-faktor");
        await yedekKoduTuket(user.id, ozet);
        break;
      }
    }
  }

  if (!totpGecerli && !yedekGecerli) {
    await denemeKaydet(user.email, ip, false, "2fa");
    await basarisizDenemeIsle(user.id, user.basarisizGiris);
    return { error: "Doğrulama kodu hatalı.", ikiFaktor: bilet };
  }

  return girisiTamamla(user, ip, ua);
}
