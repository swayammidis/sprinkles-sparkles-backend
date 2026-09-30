import { NextResponse, type NextRequest } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { fieldErrors, isSameOrigin, readJson } from "@/lib/api/request";
import { DuplicateEmailError, registerAdmin } from "@/lib/auth/setup";
import { DatabaseConfigError, DatabaseUnavailableError } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * POST /api/auth/register: create an admin account.
 * Server determines role and status:
 *  - First user: SUPER_ADMIN, status=APPROVED, isActive=true, session cookie set immediately.
 *  - Future users: ADMIN, status=PENDING, isActive=false.
 * Request body MUST NOT contain role, status, or isActive.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return json({ error: "Cross-origin request blocked." }, 403);

  try {
    const body = await readJson(req);
    const parsed = registerSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return json({ error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, 422);
    }

    const result = await registerAdmin(parsed.data);
    const message = result.isFirstAdmin
      ? "Admin account created successfully. You are the store administrator."
      : "Registration submitted. Your admin access request has been sent to the store administrator. You can sign in after your account is approved.";

    return json(
      {
        ok: true,
        isFirstAdmin: result.isFirstAdmin,
        message,
        admin: {
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
          status: result.admin.status,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return json(
        {
          error: "An account with this email already exists.",
          fieldErrors: { email: "An account with this email already exists." },
        },
        409,
      );
    }
    if (err instanceof DatabaseConfigError) {
      console.error("[register] DatabaseConfigError:", err.message);
      return json({ error: err.message }, 500);
    }
    if (err instanceof DatabaseUnavailableError) {
      return json({ error: "Service temporarily unavailable. Please try again." }, 503);
    }
    console.error("[register] failed:", err);
    return json({ error: err instanceof Error ? err.message : "Something went wrong. Please try again." }, 500);
  }
}
