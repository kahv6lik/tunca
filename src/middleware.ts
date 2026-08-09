import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "gezegen_session";
// Giriş gerektirmeyen yollar. `/davet` bilinçlidir: davet edilen kişinin
// henüz hesabı yoktur, hesabı bu sayfada oluşturur (Faz 5 / B3).
// Şifre sıfırlama da giriş gerektirmez (Faz 12 / F1): kullanıcı zaten
// giremediği için buradadır.
// `/anket` (Faz 19 / N3) aynı gerekçenin en uç hâlidir: anketi dolduran kişi
// müşterinin çalışanıdır, uygulamanın kullanıcısı DEĞİLDİR ve hiç olmayacaktır.
const PUBLIC_PATHS = [
  "/login",
  "/davet",
  "/sifremi-unuttum",
  "/sifre-sifirla",
  "/anket",
];

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Kiracı bağlamı taşımayan oturum geçersiz sayılır (Faz 1 öncesi çerezler).
    return Boolean(payload.tenantId);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = await isValid(token);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Giriş yapmış kullanıcı login sayfasına gelirse panele yönlendir.
  // Davet sayfası dışarıda: oturumu açık biri de bir davet bağlantısına
  // tıklayabilir ve "geçersiz/kullanılmış" bilgisini görmeyi hak eder.
  if (pathname.startsWith("/login") && authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Korumalı sayfaya girişsiz erişim → login
  if (!isPublic && !authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Statik dosyalar ve API dışındaki tüm yolları koru
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
