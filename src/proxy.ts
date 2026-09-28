import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Optimistic gate. Requests without a valid session JWT are rejected here, early.
 * This isn't the security boundary on its own: every admin page (requireAdminPage)
 * and API route (adminRoute) re-validates the session and the admin's status in MongoDB.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const login = new URL("/login", req.nextUrl.origin);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
