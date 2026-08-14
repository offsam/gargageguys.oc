import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/owner",
  "/employees",
  "/sheet",
  "/stock",
  "/dispatch",
  "/finance",
  "/field",
  "/crm",
  "/clients",
  "/serm",
  "/ads",
  "/reviews",
];

/**
 * Lightweight gate only. Full auth + role routing happens in page loaders.
 * Avoids Edge incompatibilities from Supabase SSR / Node builtins.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.getAll().some((c) => c.name.includes("auth-token") || c.name.includes("sb-"));

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/owner/:path*",
    "/employees/:path*",
    "/sheet/:path*",
    "/stock/:path*",
    "/dispatch/:path*",
    "/finance/:path*",
    "/field/:path*",
    "/crm/:path*",
    "/clients/:path*",
    "/serm/:path*",
    "/ads/:path*",
    "/reviews/:path*",
  ],
};
