import { NextResponse, type NextRequest } from "next/server";
import { redirectToLogin, updateSession } from "@/lib/supabase/middleware";

const PROTECTED = [
  "/owner",
  "/employees",
  "/partners",
  "/sheet",
  "/stock",
  "/services",
  "/dispatch",
  "/finance",
  "/field",
  "/crm",
  "/clients",
  "/serm",
  "/ads",
  "/reviews",
  "/schedule",
];

function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.toLowerCase() || "";
  // Keep auth cookies on one host — www and apex are otherwise separate sessions.
  if (host === "www.garageguysoc.com") {
    const url = request.nextUrl.clone();
    url.host = "garageguysoc.com";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const hostRedirect = canonicalHostRedirect(request);
  if (hostRedirect) return hostRedirect;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (!user) {
    return redirectToLogin(request, pathname);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/owner",
    "/owner/:path*",
    "/employees",
    "/employees/:path*",
    "/partners",
    "/partners/:path*",
    "/sheet",
    "/sheet/:path*",
    "/stock",
    "/stock/:path*",
    "/services",
    "/services/:path*",
    "/dispatch",
    "/dispatch/:path*",
    "/finance",
    "/finance/:path*",
    "/field",
    "/field/:path*",
    "/crm",
    "/crm/:path*",
    "/clients",
    "/clients/:path*",
    "/serm",
    "/serm/:path*",
    "/ads",
    "/ads/:path*",
    "/reviews",
    "/reviews/:path*",
    "/schedule",
    "/schedule/:path*",
  ],
};
