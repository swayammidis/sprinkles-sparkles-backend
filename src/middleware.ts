import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "ss_admin_session";

/**
 * Lightweight middleware gate. Requests without the session cookie are
 * redirected (pages) or rejected (API) early. This is NOT the security
 * boundary — every admin page and API route re-validates the session
 * against MongoDB via `requireAdminPage()` / `getCurrentAdmin()`.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);

  if (hasSession) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  // API routes: return 401 JSON
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  // Page routes: redirect to login
  const login = new URL("/login", req.nextUrl.origin);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
