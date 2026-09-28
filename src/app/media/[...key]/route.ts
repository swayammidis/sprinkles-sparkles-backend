import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { LocalStorageProvider } from "@/lib/uploads/providers/local";
import { EXT_CONTENT_TYPES } from "@/lib/uploads/validate-image";

/**
 * Serves files stored by the local storage provider (development).
 * With S3/R2 the stored URLs point to the bucket/CDN and this route is unused.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/media/[...key]">) {
  if (env().STORAGE_PROVIDER !== "local") return new Response("Not found", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const ext = key.split(".").pop() ?? "";
  const contentType = EXT_CONTENT_TYPES[ext];
  if (!contentType) return new Response("Not found", { status: 404 });

  let data: Buffer | null = null;
  try {
    data = await LocalStorageProvider.read(key);
  } catch {
    data = null;
  }
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
