import "server-only";
import { z } from "zod";
import { readMongoUri } from "@/lib/db";

/**
 * Server environment, validated on first use.
 * None of these use the NEXT_PUBLIC_ prefix, so Next.js never inlines them into browser bundles.
 */
const authSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (generate with: npx auth secret)"),
});

let validated = false;

export function assertServerEnv() {
  if (validated) return;
  const parsed = authSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  readMongoUri(); // format/placeholder check (the value is never logged)
  validated = true;
}

// ---------------------------------------------------------------------------
// Optional settings (sensible defaults for local development)
// ---------------------------------------------------------------------------

const optionalSchema = z.object({
  /** Comma-separated customer-website origins allowed to call /api/public/* from a browser. */
  STOREFRONT_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  /** "local" (files in ./storage, served at /media/*) or "s3" (AWS S3, Cloudflare R2, MinIO…). */
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PUBLIC_BASE_URL: z.string().default(""),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(25).default(8),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default(""),
  S3_BUCKET: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
});

type OptionalEnv = z.infer<typeof optionalSchema>;
let cached: OptionalEnv | undefined;

export function env(): OptionalEnv {
  return (cached ??= optionalSchema.parse(process.env));
}
