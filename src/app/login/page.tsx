import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/auth/login-form";
import { AuthShell } from "@/components/admin/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  expired: "Your session has expired. Please sign in again.",
  signed_out: "You have been signed out.",
  registered: "Account registered successfully. Please sign in.",
  super_admin_created: "Welcome to Sprinkle & Sparkle! Your administrator account has been created. Please sign in.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, reason } = await props.searchParams;

  // Already signed in: go straight to the dashboard. If the database is down, still show the form.
  if (await getCurrentAdmin().catch(() => null)) redirect("/admin");

  const notice = typeof reason === "string" ? NOTICES[reason] : undefined;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your admin account to manage the store."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create Account
          </Link>
        </>
      }
    >
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </AuthShell>
  );
}
