import { adminRoute } from "@/lib/api/admin-route";
import { approveAdminRequest } from "@/lib/services/admin-users";

type Params = { id: string };

/**
 * POST /api/admin/requests/[id]/approve
 * SUPER_ADMIN only ("admins:manage").
 * Approves a pending admin request, setting status=APPROVED, isActive=true, and stamping approvedBy/approvedAt.
 */
export const POST = adminRoute<Params>("admins:manage", async (_req, { admin, params }) => {
  const user = await approveAdminRequest(admin, params.id);
  return { ok: true, user };
});
