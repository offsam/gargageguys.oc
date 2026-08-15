import { NextResponse, type NextRequest } from "next/server";
import { redirectToLogin, updateSession } from "@/lib/supabase/middleware";

const PROTECTED = [
  "/owner",
  "/employees",
  "/partners",
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

export async function middleware(request: NextRequest) {
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
    "/owner/:path*",
    "/employees/:path*",
    "/partners/:path*",
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
