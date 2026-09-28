import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DatabaseUnavailableError } from "@/lib/db";

/**
 * Read-only storefront endpoints: GET only, no cookies, CORS limited to
 * STOREFRONT_ORIGINS, short CDN caching. Responses are { data } or { error }.
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

export function publicRoute<P = Record<string, never>>(handler: (req: NextRequest, params: P) => Promise<unknown | null>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    const cors = corsHeaders(req);
    try {
      const data = await handler(req, (await context?.params) ?? ({} as P));
      if (data === null) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { ...cors, "Cache-Control": "public, s-maxage=30" } });
      return NextResponse.json({ data }, { headers: { ...cors, "Cache-Control": CACHE } });
    } catch (err) {
      if (err instanceof DatabaseUnavailableError) {
        return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503, headers: cors });
      }
      console.error("[public-api] error:", err instanceof Error ? err.name : "unknown");
      return NextResponse.json({ error: "Something went wrong" }, { status: 500, headers: cors });
    }
  };
}

export const publicOptions = (req: NextRequest) => new Response(null, { status: 204, headers: corsHeaders(req) });

export const searchParamsObject = (req: NextRequest) => Object.fromEntries(req.nextUrl.searchParams.entries());
