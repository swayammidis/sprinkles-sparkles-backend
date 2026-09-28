import { Logo } from "@/components/admin/shared/logo";
import { ThemeToggle } from "@/components/admin/header/theme-toggle";

/** Shared frame for /login and /register: brand, theme toggle, card. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[28rem] rounded-full bg-brand-pink/10 blur-3xl dark:bg-brand-pink/15" />
        <div className="absolute -right-32 -bottom-40 size-[28rem] rounded-full bg-brand-turquoise/10 blur-3xl dark:bg-brand-turquoise/15" />
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}
