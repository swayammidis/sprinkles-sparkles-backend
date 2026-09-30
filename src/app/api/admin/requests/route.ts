import { adminRoute } from "@/lib/api/admin-route";
import { listAdminRequests } from "@/lib/services/admin-users";

/**
 * GET /api/admin/requests
 * SUPER_ADMIN only ("admins:manage").
 * Lists all pending admin registration requests.
 */
export const GET = adminRoute("admins:manage", async () => {
  const requests = await listAdminRequests();
  return { requests, count: requests.length };
});
