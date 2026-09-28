"use client";

import Link from "next/link";
import { RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/admin/shared/logo";

/**
 * App-level error boundary. It sits at the root, so it also catches errors thrown in
 * the admin layout (for example MongoDB being unreachable while checking the session).
 * `error.message` is never rendered, and Next.js strips server error details in
 * production, so no database details reach the browser.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-8">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ServerCrash className="size-5" />
          </span>
          <h1 className="font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The service may be temporarily unavailable. Please try again in a moment.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={reset}>
              <RefreshCw /> Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
