import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getRegistrationStatus, type RegistrationStatus } from "@/lib/auth/setup";
import { AuthShell } from "@/components/admin/auth/auth-shell";
import { RegisterForm } from "@/components/admin/auth/register-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Create Admin Account" };

const signInFooter = (
  <>
    Already have an account?{" "}
    <Link href="/login" className="font-medium text-primary hover:underline">
      Sign in
    </Link>
  </>
);

export default async function RegisterPage() {
  if (await getCurrentAdmin().catch(() => null)) redirect("/admin");

  let status: RegistrationStatus | "unavailable";
  try {
    status = await getRegistrationStatus();
  } catch {
    status = "unavailable";
  }

  if (status !== "open") {
    const message = {
      restricted: "Admin registration is currently restricted. New admin accounts are created by a Super Admin from Admin Users.",
      unavailable: "Registration is temporarily unavailable. Please try again shortly.",
    }[status];
    return (
      <AuthShell title="Registration restricted" subtitle="This is a private admin panel." footer={signInFooter}>
        <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand-turquoise" />
          <p>{message}</p>
        </div>
        <Button asChild className="mt-5 h-10 w-full" size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create Admin Account" subtitle="Set up your admin account to manage the store." footer={signInFooter}>
      <RegisterForm />
    </AuthShell>
  );
}
