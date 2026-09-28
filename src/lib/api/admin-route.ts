import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { DatabaseUnavailableError } from "@/lib/db";
import { fieldErrors, isSameOrigin } from "@/lib/api/request";

const NO_STORE = { "Cache-Control": "no-store" };
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Errors safe to show the user. Response shape: { error, fieldErrors? }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Turns MongoDB "E11000 duplicate key" errors into a message a store owner understands. */
function duplicateKeyError(err: unknown): { error: string; fieldErrors: Record<string, string> } | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e?.code !== 11000) return null;
  const key = Object.keys(e.keyPattern ?? {})[0] ?? "";
  const byKey: Record<string, [string, string]> = {
    sku: ["sku", "A product with this SKU already exists."],
    "variants.sku": ["variants", "One of the option SKUs is already used by another product."],
    slug: ["slug", "This URL name is already used. Please choose a different one."],
    email: ["email", "An account with this email already exists."],
  };
  const [field, message] = byKey[key] ?? ["form", "This already exists."];
  return { error: message, fieldErrors: { [field]: message } };
}

type Handler<P> = (req: NextRequest, ctx: { admin: CurrentAdmin; params: P }) => Promise<unknown>;

/**
 * Wraps every /api/admin/* handler with:
 *  1. Authentication checked against MongoDB (401)
 *  2. A role/permission check against the role stored in the database (403)
 *  3. CSRF protection for mutations: the Origin header must match this app (403)
 *  4. Safe errors: Zod → 422 with field messages; database and driver details are never sent
 */
export function adminRoute<P = Record<string, never>>(permission: Permission, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) throw new ApiError(403, "Cross-origin request blocked.");
      const admin = await getCurrentAdmin();
      if (!admin) throw new ApiError(401, "Authentication required.");
      if (!hasPermission(admin.role, permission)) throw new ApiError(403, "You do not have permission to perform this action.");

      const params = (await context?.params) ?? ({} as P);
      const result = await handler(req, { admin, params });
      if (result instanceof Response) {
        result.headers.set("Cache-Control", "no-store");
        return result;
      }
      return NextResponse.json(result ?? { ok: true }, { headers: NO_STORE });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message, ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}) },
          { status: err.status, headers: NO_STORE },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(err) },
          { status: 422, headers: NO_STORE },
        );
      }
      const dup = duplicateKeyError(err);
      if (dup) return NextResponse.json(dup, { status: 409, headers: NO_STORE });
      if (err instanceof Error && err.name === "CastError") {
        return NextResponse.json({ error: "That item could not be found." }, { status: 404, headers: NO_STORE });
      }
      if (err instanceof DatabaseUnavailableError) {
        return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503, headers: NO_STORE });
      }
      console.error("[api] unhandled error:", err instanceof Error ? err.name : "unknown");
      return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers: NO_STORE });
    }
  };
}
