import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { toErrorResponse } from "@/lib/api/errors";

/**
 * Read-only storefront endpoints. GET only, no cookies/credentials,
 * CORS restricted to STOREFRONT_ORIGINS, short CDN caching.
 */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && env().STOREFRONT_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export function publicRoute<P = Record<string, never>>(
  handler: (req: NextRequest, params: P) => Promise<unknown | null>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const cors = corsHeaders(req);
    try {
      const params = (await context?.params) ?? ({} as P);
      const data = await handler(req, params);
      if (data === null) {
        return NextResponse.json({ error: { message: "Not found" } }, { status: 404, headers: { ...cors, "Cache-Control": "public, s-maxage=30" } });
      }
      return NextResponse.json({ data }, { headers: { ...cors, "Cache-Control": CACHE } });
    } catch (err) {
      return toErrorResponse(err, cors);
    }
  };
}

export function publicOptions(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function searchParamsObject(req: NextRequest) {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
