import { adminRoute } from "@/lib/api/admin-route";
import { rejectAdminRequest } from "@/lib/services/admin-users";

type Params = { id: string };

/**
 * POST /api/admin/requests/[id]/reject
 * SUPER_ADMIN only ("admins:manage").
 * Rejects a pending admin request, setting status=REJECTED, isActive=false, and revoking any sessions.
 */
export const POST = adminRoute<Params>("admins:manage", async (_req, { admin, params }) => {
  const user = await rejectAdminRequest(admin, params.id);
  return { ok: true, user };
});
