import { cookies } from "next/headers";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/sidebar/admin-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Server-side authentication for every /admin page (proxy.ts is only an optimistic pre-check).
  const admin = await requireAdminPage();
  const collapsed = (await cookies()).get("ss-sidebar")?.value === "1";

  return (
    <AdminShell admin={{ name: admin.name, email: admin.email, role: admin.role }} initialCollapsed={collapsed}>
      {children}
    </AdminShell>
  );
}
