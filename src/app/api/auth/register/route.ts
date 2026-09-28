import { NextResponse, type NextRequest } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import { fieldErrors, isSameOrigin, readJson } from "@/lib/api/request";
import { DuplicateEmailError, getRegistrationStatus, registerFirstAdmin, RegistrationClosedError } from "@/lib/auth/setup";
import { DatabaseUnavailableError } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const RESTRICTED = "Admin registration is currently restricted.";

/**
 * POST /api/auth/register: create the FIRST admin (always SUPER_ADMIN).
 * It only works while no admin exists; after that it is permanently closed.
 * Takes precedence over the Auth.js catch-all at /api/auth/[...nextauth].
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return json({ error: "Cross-origin request blocked." }, 403);

  try {
    if ((await getRegistrationStatus()) === "restricted") return json({ error: RESTRICTED }, 403);

    const body = await readJson(req);
    const parsed = registerSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return json({ error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, 422);
    }

    const admin = await registerFirstAdmin(parsed.data);
    // Safe response: no hash, no internal fields.
    return json({ ok: true, admin: { name: admin.name, email: admin.email, role: admin.role } }, 201);
  } catch (err) {
    if (err instanceof RegistrationClosedError) return json({ error: RESTRICTED }, 403);
    if (err instanceof DuplicateEmailError) {
      return json({ error: "An account with this email already exists.", fieldErrors: { email: "An account with this email already exists." } }, 409);
    }
    if (err instanceof DatabaseUnavailableError) return json({ error: "Service temporarily unavailable. Please try again." }, 503);
    console.error("[register] failed:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
