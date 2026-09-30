import { NextResponse } from "next/server";
import { connectDB, sanitizeDbError, readMongoUri } from "@/lib/db";

/**
 * GET /api/health
 * Lightweight diagnostic endpoint. Returns DB connectivity status.
 * Never exposes credentials — only connection state and sanitized errors.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      MONGODB_URI_SET: !!process.env.MONGODB_URI,
      MONGODB_URI_LENGTH: process.env.MONGODB_URI?.length ?? 0,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Step 1: Can we parse the URI?
  try {
    const uri = readMongoUri();
    // Redact the URI but show the host for debugging
    const hostMatch = uri.match(/@([^/?]+)/);
    result.uriHost = hostMatch ? hostMatch[1] : "unknown";
    result.uriValid = true;
  } catch (err) {
    result.uriValid = false;
    result.uriError = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(result, { status: 500 });
  }

  // Step 2: Can we connect?
  try {
    await connectDB();
    result.db = "connected";
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    result.db = "failed";
    result.dbError = sanitizeDbError(err);
    return NextResponse.json(result, { status: 503 });
  }
}
