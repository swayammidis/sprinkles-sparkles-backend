import "server-only";
import { randomBytes } from "node:crypto";
import { CredentialsSignin, type User } from "next-auth";
import { connectDB, DatabaseConfigError } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { AdminSession } from "@/models/AdminSession";
import { LoginAttempt } from "@/models/LoginAttempt";
import { loginSchema } from "@/lib/validations/auth";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { SESSION_MAX_AGE } from "@/lib/auth/auth.config";
import { isRole } from "@/lib/auth/permissions";
import { assertServerEnv } from "@/lib/env";

// Error codes surfaced to the login page. Messages are mapped in login/actions.ts.
export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}
export class InactiveAccountError extends CredentialsSignin {
  code = "account_inactive";
}
export class TooManyAttemptsError extends CredentialsSignin {
  code = "rate_limited";
}
export class ServiceUnavailableError extends CredentialsSignin {
  code = "service_unavailable";
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 25;

function clientIp(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

async function isRateLimited(emailKey: string, ipKey: string) {
  const rows = await LoginAttempt.find({ key: { $in: [emailKey, ipKey] }, expiresAt: { $gt: new Date() } })
    .select("key count")
    .lean();
  return rows.some(
    (r) => (r.key === emailKey && r.count >= MAX_FAILURES_PER_EMAIL) || (r.key === ipKey && r.count >= MAX_FAILURES_PER_IP),
  );
}

async function recordFailure(keys: string[]) {
  const expiresAt = new Date(Date.now() + WINDOW_MS);
  await Promise.all(
    keys.map((key) =>
      LoginAttempt.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true }),
    ),
  );
}

/**
 * Credentials check: validate → rate limit → find admin → compare hash →
 * check isActive → create a server-side session record.
 */
export async function authorizeAdmin(raw: Partial<Record<string, unknown>>, request: Request): Promise<User> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidCredentialsError();
  const { email, password } = parsed.data;
  const emailKey = `email:${email}`;
  const ipKey = `ip:${clientIp(request)}`;

  try {
    assertServerEnv();
    await connectDB();

    if (await isRateLimited(emailKey, ipKey)) throw new TooManyAttemptsError();

    const user = await AdminUser.findOne({ email }).select("+passwordHash name email role isActive");
    // Always run a bcrypt comparison, so unknown emails take as long as known ones.
    const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

    if (!user || !valid) {
      await recordFailure([emailKey, ipKey]);
      throw new InvalidCredentialsError();
    }
    // Only reported after a correct password, so it can't be used to enumerate accounts.
    if (!user.isActive) throw new InactiveAccountError();
    if (!isRole(user.role)) throw new InvalidCredentialsError();

    await LoginAttempt.deleteOne({ key: emailKey });

    const sid = randomBytes(32).toString("base64url");
    await AdminSession.create({
      sid,
      userId: user._id,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
      userAgent: request.headers.get("user-agent")?.slice(0, 300),
      ip: clientIp(request),
    });
    await AdminUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    // Never includes passwordHash.
    return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, sid };
  } catch (err) {
    if (err instanceof CredentialsSignin) throw err;
    // MongoDB down, network error, etc. Log it server-side and show a generic message.
    // Config errors are safe to log in full (they never contain values); driver errors log the name only.
    const configProblem = err instanceof DatabaseConfigError || (err instanceof Error && err.message.startsWith("Invalid server environment"));
    console.error("[auth] sign-in failed:", configProblem ? (err as Error).message : err instanceof Error ? err.name : "unknown error");
    throw new ServiceUnavailableError();
  }
}
