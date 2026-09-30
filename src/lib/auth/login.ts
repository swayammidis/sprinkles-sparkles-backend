import "server-only";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { LoginAttempt } from "@/models/LoginAttempt";
import { loginSchema } from "@/lib/validations/auth";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { isRole, type Role } from "@/lib/auth/permissions";
import { createSession } from "@/lib/auth/session";

export type LoginErrorCode =
  | "invalid_credentials"
  | "pending_approval"
  | "account_rejected"
  | "account_inactive"
  | "rate_limited"
  | "service_unavailable";

export type LoginResult =
  | {
      ok: true;
      code: "success";
      user: {
        id: string;
        name: string;
        email: string;
        role: Role;
        status: string;
      };
    }
  | {
      ok: false;
      code: LoginErrorCode;
      error: string;
      fieldErrors?: Partial<Record<"email" | "password", string>>;
    };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 25;

function clientIp(request?: Request): string {
  if (!request) return "unknown";
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

async function isRateLimited(emailKey: string, ipKey: string): Promise<boolean> {
  const rows = await LoginAttempt.find({ key: { $in: [emailKey, ipKey] }, expiresAt: { $gt: new Date() } })
    .select("key count")
    .lean();
  return rows.some(
    (r) => (r.key === emailKey && r.count >= MAX_FAILURES_PER_EMAIL) || (r.key === ipKey && r.count >= MAX_FAILURES_PER_IP),
  );
}

async function recordFailure(keys: string[]): Promise<void> {
  const expiresAt = new Date(Date.now() + WINDOW_MS);
  await Promise.all(
    keys.map((key) =>
      LoginAttempt.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true }),
    ),
  );
}

/**
 * Custom credentials verification and session creation:
 * 1. Validate email and password.
 * 2. Check rate limit.
 * 3. Find admin user.
 * 4. Verify bcrypt password hash.
 * 5. Verify status (PENDING, REJECTED, APPROVED) and isActive.
 * 6. Create custom MongoDB session and set HTTP-only cookie.
 */
export async function loginAdmin(
  input: { email: unknown; password: unknown },
  req?: Request,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({ email: input.email, password: input.password });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      code: "invalid_credentials",
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const emailKey = `email:${normalizedEmail}`;
  const ipKey = `ip:${clientIp(req)}`;

  try {
    await connectDB();

    if (await isRateLimited(emailKey, ipKey)) {
      return {
        ok: false,
        code: "rate_limited",
        error: "Too many failed attempts. Please wait 15 minutes and try again.",
      };
    }

    const user = await AdminUser.findOne({ email: normalizedEmail }).select("+passwordHash name email role status isActive");
    // Always run bcrypt comparison to prevent user enumeration through timing
    const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

    if (!user || !valid) {
      await recordFailure([emailKey, ipKey]);
      return {
        ok: false,
        code: "invalid_credentials",
        error: "Invalid email or password.",
      };
    }

    const userStatus = user.status ?? "APPROVED";

    if (userStatus === "PENDING") {
      return {
        ok: false,
        code: "pending_approval",
        error: "Your admin access request is waiting for approval.",
      };
    }

    if (userStatus === "REJECTED") {
      return {
        ok: false,
        code: "account_rejected",
        error: "Your admin access request was not approved. Please contact the store administrator.",
      };
    }

    if (userStatus !== "APPROVED" || !user.isActive) {
      return {
        ok: false,
        code: "account_inactive",
        error: "Your account is currently inactive.",
      };
    }

    if (!isRole(user.role)) {
      return {
        ok: false,
        code: "invalid_credentials",
        error: "Invalid email or password.",
      };
    }

    // Login successful: reset rate limits
    await LoginAttempt.deleteOne({ key: emailKey });

    // Create custom session in MongoDB and set HTTP-only cookie
    await createSession(user._id, req);
    await AdminUser.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return {
      ok: true,
      code: "success",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: userStatus,
      },
    };
  } catch (err) {
    console.error("[auth] login error:", err);
    return {
      ok: false,
      code: "service_unavailable",
      error: "Sign-in is temporarily unavailable. Please try again shortly.",
    };
  }
}
