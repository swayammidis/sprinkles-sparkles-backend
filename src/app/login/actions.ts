"use server";

import { redirect } from "next/navigation";
import { loginAdmin, type LoginErrorCode } from "@/lib/auth/login";
import { deleteSession } from "@/lib/auth/session";

export type LoginResult = {
  error?: string;
  code?: LoginErrorCode;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

/** Only internal /admin paths are allowed as post-login redirects (prevents open redirects). */
function safeRedirect(next: unknown): string {
  return typeof next === "string" && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith("//") ? next : "/admin";
}

/**
 * Server action for login. Uses custom MongoDB session system.
 * Sets the secure HTTP-only cookie and redirects on success.
 */
export async function loginAction(input: {
  email: unknown;
  password: unknown;
  next?: unknown;
}): Promise<LoginResult | void> {
  const result = await loginAdmin({ email: input.email, password: input.password });

  if (!result.ok) {
    return {
      error: result.error,
      code: result.code,
      fieldErrors: result.fieldErrors,
    };
  }

  // Redirect to destination
  redirect(safeRedirect(input.next));
}

/**
 * Server action for logout: deletes session from MongoDB and clears cookie.
 */
export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login?reason=signed_out");
}
