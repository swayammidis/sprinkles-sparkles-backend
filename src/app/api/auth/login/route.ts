import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/api/request";
import { loginAdmin } from "@/lib/auth/login";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/login
 * Custom credentials login endpoint.
 * Sets secure HTTP-only cookie on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await readJson(req)) as { email?: unknown; password?: unknown } | null;
    const result = await loginAdmin(
      { email: body?.email, password: body?.password },
      req,
    );

    if (!result.ok) {
      const status =
        result.code === "pending_approval" ||
        result.code === "account_rejected" ||
        result.code === "account_inactive"
          ? 403
          : result.code === "rate_limited"
            ? 429
            : result.code === "service_unavailable"
              ? 503
              : 401;

      return NextResponse.json(
        { ok: false, code: result.code, error: result.error, fieldErrors: result.fieldErrors },
        { status, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { ok: true, code: result.code, user: result.user },
      { status: 200, headers: NO_STORE },
    );
  } catch (err) {
    console.error("[api/auth/login] unhandled error:", err);
    return NextResponse.json(
      { ok: false, code: "service_unavailable", error: "Sign-in is temporarily unavailable. Please try again shortly." },
      { status: 500, headers: NO_STORE },
    );
  }
}
