// Bearer-token gate for the admin surface.
//
// Set ADMIN_TOKEN in env. Browser sets a cookie via /admin/login? Out of
// scope for MVP — for now, pass the token as `?token=` or `Authorization:
// Bearer …` on the first hit and the middleware sets a cookie for the
// rest of the session.

import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = "alx_admin";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie === expected) return true;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  const query = req.nextUrl.searchParams.get("token");
  if (query === expected) return true;
  return false;
}

export function middleware(req: NextRequest): NextResponse {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const expected = process.env.ADMIN_TOKEN!;
  const res = NextResponse.next();
  // Refresh the cookie so subsequent navigations don't need the token.
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
