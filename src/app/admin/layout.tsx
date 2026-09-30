import { cookies } from "next/headers";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/sidebar/admin-shell";
import { getPendingRequestsCount } from "@/lib/services/admin-users";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side authentication for every /admin page (middleware.ts is only an optimistic cookie pre-check).
  const admin = await requireAdminPage();
  const collapsed = (await cookies()).get("ss-sidebar")?.value === "1";
  const pendingRequestsCount = admin.role === "SUPER_ADMIN" ? await getPendingRequestsCount() : 0;

  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
      initialCollapsed={collapsed}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AdminShell>
  );
}
