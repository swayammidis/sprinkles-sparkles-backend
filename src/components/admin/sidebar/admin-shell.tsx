"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Role } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/admin/shared/logo";
import { ThemeToggle } from "@/components/admin/header/theme-toggle";
import { UserMenu } from "@/components/admin/header/user-menu";
import { COMING_SOON_ITEMS, NAV_GROUPS, type NavGroup } from "@/components/admin/sidebar/nav-items";

type ShellProps = {
  admin: { name: string; email: string; role: Role };
  initialCollapsed: boolean;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Layout modes:
 *   "drawer": mobile/tablet sheet, always full labels
 *   "rail":   md–lg icon rail; full width on lg+ unless the user collapsed it
 */
function NavList({ role, mode, collapsed, onNavigate }: { role: Role; mode: "drawer" | "rail"; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups: NavGroup[] = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(role, i.permission)) })).filter((g) => g.items.length);
  const rail = mode === "rail";
  // In rail mode, labels are visible only on lg+ when not collapsed (still read by screen readers).
  const labelCls = rail ? (collapsed ? "sr-only" : "sr-only lg:not-sr-only lg:truncate") : "truncate";
  const itemLayout = rail ? (collapsed ? "justify-center px-0" : "justify-center px-0 lg:justify-start lg:px-2.5") : "px-3";
  const heading = (label: string) => (
    <div className={cn("mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase", rail && (collapsed ? "sr-only" : "sr-only lg:not-sr-only"))}>
      {label}
    </div>
  );

  const renderGroup = (g: NavGroup) => (
    <div key={g.label} role="group" aria-label={g.label} className="mt-4 first:mt-0">
      {heading(g.label)}
      <ul className="space-y-0.5">
        {g.items.map((item) => {
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:outline-none",
                active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                itemLayout,
              )}
            >
              <item.icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} aria-hidden />
              <span className={labelCls}>{item.label}</span>
            </Link>
          );
          return (
            <li key={item.href}>
              {rail ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className={collapsed ? undefined : "lg:hidden"}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const [main, ...rest] = groups;
  const system = rest.find((g) => g.label === "System");
  const others = rest.filter((g) => g.label !== "System");

  return (
    <nav className={cn("flex flex-col", rail ? "px-2 lg:px-3" : "px-3")} aria-label="Admin">
      {main && renderGroup(main)}
      {others.map(renderGroup)}
      <div role="group" aria-label="Store (coming soon)" className="mt-4">
        {heading("Store")}
        <ul className="space-y-0.5">
          {COMING_SOON_ITEMS.map((item) => (
            <li
              key={item.label}
              title={`${item.label}: coming soon`}
              className={cn("flex h-10 cursor-not-allowed items-center gap-3 rounded-lg text-sm text-sidebar-foreground/40", itemLayout)}
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              <span className={labelCls}>
                {item.label}
                <span className="sr-only"> (coming soon)</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "ml-auto rounded-full bg-sidebar-accent/70 px-1.5 py-px text-[10px] font-medium text-sidebar-foreground/60",
                  rail && (collapsed ? "hidden" : "hidden lg:inline"),
                )}
              >
                Soon
              </span>
            </li>
          ))}
        </ul>
      </div>
      {system && renderGroup(system)}
    </nav>
  );
}

export function AdminShell({ admin, initialCollapsed, children }: ShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `ss-sidebar=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Tablet (icon rail) + desktop (full, collapsible) sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none md:flex",
          collapsed ? "w-16" : "w-16 lg:w-60",
        )}
      >
        <div className={cn("flex h-14 items-center justify-center border-b border-sidebar-border", !collapsed && "lg:justify-start lg:px-4")}>
          <Link href="/admin" aria-label="Sprinkle & Sparkle admin dashboard" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo compact className={cn(!collapsed && "lg:hidden")} />
            {!collapsed && <Logo className="hidden lg:flex" />}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavList role={admin.role} mode="rail" collapsed={collapsed} />
        </div>
        <div className={cn("hidden border-t border-sidebar-border p-3 lg:flex", collapsed && "justify-center")}>
          <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={toggleCollapsed} className="text-muted-foreground" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] overflow-y-auto bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Logo />
          </div>
          <div className="py-4">
            <NavList role={admin.role} mode="drawer" collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/90 px-2 backdrop-blur sm:px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="size-10 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Link href="/admin" className="rounded-md md:hidden" aria-label="Dashboard">
            <Logo compact />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu admin={admin} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
