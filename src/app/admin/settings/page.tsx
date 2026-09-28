import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/permissions";
import { listAdminUsers } from "@/lib/services/admin-users";
import { PageHeader } from "@/components/admin/shared/page-header";
import { FormSection } from "@/components/admin/products/field";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { ChangePasswordForm } from "@/components/admin/settings/change-password-form";
import { AdminUsers } from "@/components/admin/settings/admin-users";
import { ThemeToggle } from "@/components/admin/header/theme-toggle";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdminPage("dashboard:view");
  const canManageAdmins = hasPermission(admin.role, "admins:manage");
  const users = canManageAdmins ? await listAdminUsers() : [];

  return (
    <>
      <PageHeader title="Settings" description="Your account and admin access." />
      <div className="max-w-4xl space-y-6">
        <FormSection title="Your account">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{admin.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <StatusBadge tone="turquoise">{ROLE_LABELS[admin.role]}</StatusBadge>
              </dd>
            </div>
          </dl>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </FormSection>

        <FormSection title="Change password">
          <ChangePasswordForm />
        </FormSection>

        {canManageAdmins && (
          <FormSection
            title="Admin users"
            description="Super Admins can do everything. Admins manage the catalog and media. Role changes and deactivation sign the user out immediately."
          >
            <AdminUsers users={users} currentUserId={admin.id} />
          </FormSection>
        )}
      </div>
    </>
  );
}
