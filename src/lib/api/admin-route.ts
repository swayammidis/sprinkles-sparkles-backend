import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminFromHeaders, type CurrentAdmin } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { ApiError, toErrorResponse } from "@/lib/api/errors";

const NO_STORE = { "Cache-Control": "no-store" };
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Handler<P> = (
  req: NextRequest,
  ctx: { admin: CurrentAdmin; params: P },
) => Promise<Response | unknown>;

/**
 * Wrap an admin API route handler with:
 *  1. Session authentication (401)
 *  2. Role/permission authorization (403)
 *  3. CSRF protection for state-changing methods via Origin check (403)
 *  4. Uniform JSON error handling (Zod → 422, unique → 409, …)
 *
 * Handlers may return a Response, or any value which will be serialised as JSON.
 */
export function adminRoute<P = Record<string, never>>(permission: Permission, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);

      const admin = await getAdminFromHeaders(req.headers);
      if (!admin) throw new ApiError(401, "Authentication required");
      if (!hasPermission(admin.role, permission)) throw new ApiError(403, "You do not have permission to perform this action");

      const params = (await context?.params) ?? ({} as P);
      const result = await handler(req, { admin, params });
      if (result instanceof Response) {
        result.headers.set("Cache-Control", "no-store");
        return result;
      }
      return NextResponse.json(result ?? { ok: true }, { headers: NO_STORE });
    } catch (err) {
      return toErrorResponse(err, NO_STORE);
    }
  };
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(env().BETTER_AUTH_URL).origin, req.nextUrl.origin]);
  if (!origin || !allowed.has(origin)) {
    throw new ApiError(403, "Cross-origin request blocked");
  }
}

/** Parse a JSON body with a size guard. */
export async function readJson(req: NextRequest, maxBytes = 1_000_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ApiError(413, "Request body too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}
