"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/lib/auth/auth";
import { loginSchema } from "@/lib/validations/auth";

export type LoginResult = { error: string; fieldErrors?: Partial<Record<"email" | "password", string>> };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  account_inactive: "Your admin account is inactive. Please contact a SUPER_ADMIN.",
  rate_limited: "Too many failed attempts. Please wait 15 minutes and try again.",
  service_unavailable: "Sign-in is temporarily unavailable. Please try again shortly.",
};

/** Only internal /admin paths are allowed as post-login redirects (prevents open redirects). */
function safeRedirect(next: unknown) {
  return typeof next === "string" && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith("//") ? next : "/admin";
}

/**
 * Server-side login. Input is validated again here, whatever the client sent.
 * On success, signIn() throws a redirect, which Next.js turns into a navigation.
 */
export async function loginAction(input: { email: unknown; password: unknown; next?: unknown }): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({ email: input.email, password: input.password });
  if (!parsed.success) {
    const fieldErrors: LoginResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "email" || key === "password") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirect(input.next),
    });
  } catch (err) {
    if (err instanceof CredentialsSignin) return { error: MESSAGES[err.code] ?? MESSAGES.invalid_credentials };
    if (err instanceof AuthError) return { error: MESSAGES.service_unavailable };
    throw err; // the success redirect (NEXT_REDIRECT) must be re-thrown
  }
  return { error: MESSAGES.service_unavailable };
}

/** Clears the session cookie and deletes the server-side session record (see events.signOut). */
export async function logoutAction() {
  await signOut({ redirectTo: "/login?reason=signed_out" });
}
