import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/shared/login-form";
import { Logo } from "@/components/admin/shared/logo";
import { ThemeToggle } from "@/components/admin/header/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

/** Only allow internal redirect targets (prevents open-redirects via ?next=). */
function safeNext(next: string | string[] | undefined) {
  const v = Array.isArray(next) ? next[0] : next;
  return v && v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const target = safeNext(next);
  if (await getCurrentAdmin()) redirect(target);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-secondary/50 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your admin account to manage the catalog.</p>
          <LoginForm next={target} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Admin accounts are created by a Super Admin. Public sign-up is disabled.
        </p>
      </div>
    </main>
  );
}
