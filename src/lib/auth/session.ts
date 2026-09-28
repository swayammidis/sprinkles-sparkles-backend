import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { AdminSession } from "@/models/AdminSession";
import { hasPermission, isRole, type Permission, type Role } from "@/lib/auth/permissions";
import { assertServerEnv } from "@/lib/env";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  /** Current session id. Server-side only; never send it to the client. */
  sessionId: string;
};

/**
 * The single server-side source of truth for "who is signed in".
 * The JWT only identifies the session. On every call we confirm in MongoDB that:
 *  - the session record still exists and hasn't expired (so logout and revocation work), and
 *  - the admin still exists and is active, using the current role from the database, not the token.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await auth(); // reads request cookies, so callers always render dynamically
  const userId = session?.user?.id;
  if (!userId || !session.sid || !isValidObjectId(userId)) return null;

  assertServerEnv();
  await connectDB();
  const [sessionRecord, user] = await Promise.all([
    AdminSession.exists({ sid: session.sid, userId, expiresAt: { $gt: new Date() } }),
    AdminUser.findById(userId).select("name email role isActive lastLoginAt").lean(),
  ]);
  if (!sessionRecord || !user || !user.isActive || !isRole(user.role)) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    sessionId: session.sid,
  };
});

async function hasSessionCookie() {
  const jar = await cookies();
  return jar.has("authjs.session-token") || jar.has("__Secure-authjs.session-token");
}

/** Use at the top of every admin page. Redirects to /login when there's no valid session. */
export async function requireAdminPage(permission?: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect((await hasSessionCookie()) ? "/login?reason=expired" : "/login");
  if (permission && !hasPermission(admin.role, permission)) redirect("/admin?forbidden=1");
  return admin;
}
