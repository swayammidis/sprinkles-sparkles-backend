import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getRegistrationStatus } from "@/lib/auth/setup";
import { LoginForm } from "@/components/admin/auth/login-form";
import { AuthShell } from "@/components/admin/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  expired: "Your session has expired. Please sign in again.",
  signed_out: "You have been signed out.",
  registered: "Admin account created successfully. Please sign in.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, reason } = await props.searchParams;

  // Already signed in: go straight to the dashboard. If the database is down, still show the form.
  if (await getCurrentAdmin().catch(() => null)) redirect("/admin");

  // The registration link only appears while first-admin setup is actually possible.
  const registrationOpen = (await getRegistrationStatus().catch(() => "restricted")) === "open";
  const notice = typeof reason === "string" ? NOTICES[reason] : undefined;

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your admin account to manage the store."
      footer={
        registrationOpen ? (
          <>
            Don&apos;t have an admin account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create Admin Account
            </Link>
          </>
        ) : (
          <span className="text-xs">Admin accounts are created by a Super Admin. Public registration is restricted.</span>
        )
      }
    >
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </AuthShell>
  );
}
