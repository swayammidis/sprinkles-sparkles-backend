import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { listAdminRequests } from "@/lib/services/admin-users";
import { PageHeader } from "@/components/admin/shared/page-header";
import { AdminRequestsManager } from "@/components/admin/requests/admin-requests-manager";

export const metadata: Metadata = { title: "Admin Requests" };

/** SUPER_ADMIN only. ADMIN users are redirected server-side by requireAdminPage. */
export default async function AdminRequestsPage() {
  await requireAdminPage("admins:manage");
  const requests = await listAdminRequests();

  return (
    <>
      <PageHeader
        title="Admin Requests"
        description="Review and approve new administrator registration requests for the Sprinkle & Sparkle store."
      />
      <AdminRequestsManager initialRequests={requests} />
    </>
  );
}
