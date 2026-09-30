import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { AuthShell } from "@/components/admin/auth/auth-shell";
import { RegisterForm } from "@/components/admin/auth/register-form";

export const metadata: Metadata = { title: "Register Admin Account" };

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

  return (
    <AuthShell
      title="Create Account"
      subtitle="Register for access to the Sprinkle & Sparkle admin panel."
      footer={signInFooter}
    >
      <RegisterForm />
    </AuthShell>
  );
}
