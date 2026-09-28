import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { listAdminUsers } from "@/lib/services/admin-users";
import { PageHeader } from "@/components/admin/shared/page-header";
import { AdminUsersManager } from "@/components/admin/users/admin-users-manager";

export const metadata: Metadata = { title: "Admin Users" };

/** SUPER_ADMIN only. ADMINs are redirected server-side by requireAdminPage. */
export default async function AdminUsersPage() {
  const admin = await requireAdminPage("admins:manage");
  const users = await listAdminUsers();
  return (
    <>
      <PageHeader
        title="Admin Users"
        description="Super Admins manage everything, including admin accounts. Admins manage the catalog."
      />
      <AdminUsersManager users={users} currentUserId={admin.id} />
    </>
  );
}
