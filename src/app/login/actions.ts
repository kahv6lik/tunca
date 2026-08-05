"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { kimlikIstemcisi } from "@/lib/rls";

export type LoginState = { error?: string; kiraciSor?: boolean };

// Kiracıların birbirinin varlığını öğrenmesini engellemek için tüm başarısız
// denemelerde aynı mesaj döner.
const GENEL_HATA = "E-posta veya şifre hatalı.";

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

  if (user.tenant.durum !== "aktif") {
    return {
      error:
        "Hesabınızın bağlı olduğu kuruluşun erişimi durdurulmuş. Yöneticinizle görüşün.",
    };
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenant.slug,
    tenantAd: user.tenant.ad,
  });

  redirect("/");
}
