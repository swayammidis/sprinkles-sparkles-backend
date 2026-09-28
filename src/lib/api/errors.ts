import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`);
export const conflict = (message: string, details?: unknown) => new ApiError(409, message, details);
export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, details);

type ErrorBody = { error: { message: string; fieldErrors?: Record<string, string[]>; details?: unknown } };

/** Convert any thrown error into a safe JSON response. Never leaks stack traces or SQL. */
export function toErrorResponse(err: unknown, headers?: HeadersInit): NextResponse<ErrorBody> {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status, headers },
    );
  }
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_root";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return NextResponse.json(
      { error: { message: "Validation failed", fieldErrors } },
      { status: 422, headers },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      const fields = Array.isArray(target) ? target : [target];
      const fieldErrors: Record<string, string[]> = {};
      for (const f of fields) fieldErrors[f] = ["Already in use"];
      return NextResponse.json(
        { error: { message: `A record with this ${fields.join(", ") || "value"} already exists`, fieldErrors } },
        { status: 409, headers },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: { message: "Record not found" } }, { status: 404, headers });
    }
    if (err.code === "P2003") {
      return NextResponse.json(
        { error: { message: "Referenced record does not exist or is still in use" } },
        { status: 409, headers },
      );
    }
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500, headers });
}
