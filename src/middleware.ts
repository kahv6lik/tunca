import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "gezegen_session";
const PUBLIC_PATHS = ["/login"];

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

  // Giriş yapmış kullanıcı login sayfasına gelirse panele yönlendir
  if (isPublic && authed) {
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
