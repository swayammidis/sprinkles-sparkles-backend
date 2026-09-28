import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic gate only: rejects requests with no session cookie early.
 * The authoritative check (valid session, active user, role permission) runs
 * on the server in every admin layout/page (requireAdminPage) and every admin
 * API route (adminRoute). Never rely on this file alone.
 */
export function proxy(request: NextRequest) {
  const hasSession = !!getSessionCookie(request, { cookiePrefix: "ss-admin" });
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: { message: "Authentication required" } }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
