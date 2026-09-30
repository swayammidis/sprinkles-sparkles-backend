import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { AdminSession } from "@/models/AdminSession";
import { hasPermission, isRole, type Permission, type Role } from "@/lib/auth/permissions";

export const SESSION_COOKIE_NAME = "ss_admin_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  lastLoginAt: string | null;
  /** Internal token hash for current session */
  tokenHash: string;
};

/**
 * Computes a SHA-256 hash of the raw session token.
 * Only this hash is stored in MongoDB.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function clientIp(request?: Request): string {
  if (!request) return "unknown";
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/**
 * Creates a cryptographically random session token, stores only its SHA-256 hash
 * in MongoDB, and sets a secure HTTP-only cookie.
 */
export async function createSession(
  adminUserId: string | Types.ObjectId,
  req?: Request,
): Promise<{ rawToken: string; expiresAt: Date; tokenHash: string }> {
  await connectDB();

  // Generate cryptographically secure random session token
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await AdminSession.create({
    adminUserId,
    tokenHash,
    expiresAt,
    lastUsedAt: new Date(),
    userAgent: req?.headers.get("user-agent")?.slice(0, 300),
    ip: clientIp(req),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { rawToken, expiresAt, tokenHash };
}

/**
 * Deletes the active session from MongoDB and clears the HTTP-only cookie.
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    try {
      await connectDB();
      const tokenHash = hashSessionToken(rawToken);
      await AdminSession.deleteOne({ tokenHash });
    } catch (err) {
      console.error("[auth] failed to delete session record:", err);
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Revokes all sessions for a given admin user (e.g. on role change, deactivation, password reset, or rejection).
 */
export async function revokeAllSessionsForUser(
  userId: string | Types.ObjectId,
  keepTokenHash?: string,
): Promise<void> {
  await connectDB();
  await AdminSession.deleteMany({
    adminUserId: userId,
    ...(keepTokenHash ? { tokenHash: { $ne: keepTokenHash } } : {}),
  });
}

/**
 * The single server-side source of truth for "who is signed in".
 * Validates the raw token from the HTTP-only cookie against the tokenHash in MongoDB.
 * Verifies that the session is unexpired, the user exists, is APPROVED, and is isActive.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken || typeof rawToken !== "string") return null;

  const tokenHash = hashSessionToken(rawToken);

  try {
    await connectDB();
    const session = await AdminSession.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session || !isValidObjectId(session.adminUserId)) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    const user = await AdminUser.findById(session.adminUserId)
      .select("name email role status isActive lastLoginAt")
      .lean();

    const userStatus = user?.status ?? "APPROVED";

    if (!user || !user.isActive || userStatus !== "APPROVED" || !isRole(user.role)) {
      // Invalidate invalid/inactive session
      await AdminSession.deleteOne({ tokenHash }).catch(() => {});
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    // Touch lastUsedAt asynchronously if older than 60s
    const now = Date.now();
    const lastUsed = session.lastUsedAt ? new Date(session.lastUsedAt).getTime() : 0;
    if (now - lastUsed > 60_000) {
      AdminSession.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
    }

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: userStatus,
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      tokenHash,
    };
  } catch (err) {
    console.error("[auth] getCurrentAdmin failed:", err);
    return null;
  }
});

async function hasSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(SESSION_COOKIE_NAME);
}

/**
 * Server-side guard for admin pages. Redirects to /login if unauthenticated.
 */
export async function requireAdminPage(permission?: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect((await hasSessionCookie()) ? "/login?reason=expired" : "/login");
  }
  if (permission && !hasPermission(admin.role, permission)) {
    redirect("/admin?forbidden=1");
  }
  return admin;
}

/** Alias for requireAdminPage */
export const requireAdmin = requireAdminPage;

/**
 * Server-side guard strictly for SUPER_ADMIN pages.
 */
export async function requireSuperAdmin(): Promise<CurrentAdmin> {
  return requireAdminPage("admins:manage");
}
