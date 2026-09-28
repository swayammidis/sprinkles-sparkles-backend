import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getStoreSettings } from "@/lib/services/settings";
import { formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/admin/shared/page-header";
import { ThemeToggle } from "@/components/admin/header/theme-toggle";
import { StoreSettingsForm } from "@/components/admin/settings/store-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdminPage("settings:manage");
  const settings = await getStoreSettings();

  return (
    <>
      <PageHeader title="Settings" description="Your store details and admin preferences." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <StoreSettingsForm initial={settings} />
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">Signed in as</p>
            <p className="mt-1">{admin.name}</p>
            <p className="break-all text-muted-foreground">{admin.email}</p>
            <p className="mt-1 text-muted-foreground">
              {ROLE_LABELS[admin.role]} · last sign-in {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : "—"}
            </p>
            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <span className="text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
          {[
            { href: "/admin/users", icon: Users, title: "Admin Users", text: "Add team members and manage their access" },
            { href: "/admin/settings/security", icon: ShieldCheck, title: "Security", text: "Sessions, sign-in protection and registration" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-turquoise-soft text-brand-turquoise">
                <l.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{l.title}</span>
                <span className="block text-xs text-muted-foreground">{l.text}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </aside>
      </div>
    </>
  );
}
