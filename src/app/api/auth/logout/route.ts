import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/logout
 * Custom logout endpoint: deletes session from MongoDB and clears HTTP-only cookie.
 */
export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
