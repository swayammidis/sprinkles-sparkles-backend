import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { hasPermission, isRole, type Permission, type Role } from "@/lib/auth/permissions";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Resolve the signed-in admin from request headers.
 * Session and user (incl. role/active) are read from the database on every call,
 * so role changes and deactivation take effect immediately.
 */
export async function getAdminFromHeaders(h: Headers): Promise<CurrentAdmin | null> {
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: unknown; active?: unknown };
  if (user.active !== true || !isRole(user.role)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Per-request memoised admin lookup for Server Components. */
export const getCurrentAdmin = cache(async () => getAdminFromHeaders(await headers()));

/** Use in admin pages/layouts. Redirects when not signed in or not permitted. */
export async function requireAdminPage(permission?: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (permission && !hasPermission(admin.role, permission)) redirect("/admin?forbidden=1");
  return admin;
}
