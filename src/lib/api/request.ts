import "server-only";
import type { NextRequest } from "next/server";
import type { ZodError } from "zod";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/** CSRF check for state-changing requests: the browser-sent Origin must be this app. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !!origin && origin === req.nextUrl.origin;
}

/** Parse a JSON body with a size cap. Returns undefined on invalid JSON. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** First message per field, e.g. { email: "Please enter a valid email address." }. */
export function fieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
