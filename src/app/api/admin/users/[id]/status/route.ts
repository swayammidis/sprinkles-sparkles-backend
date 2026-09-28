import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { setAdminActive } from "@/lib/services/admin-users";
import { adminStatusSchema } from "@/lib/validations/auth";

/** Activate or deactivate an admin. Deactivation signs them out immediately. */
export const PATCH = adminRoute<{ id: string }>("admins:manage", async (req, { admin, params }) => {
  const { isActive } = adminStatusSchema.parse((await readJson(req)) ?? {});
  return { user: await setAdminActive(admin, params.id, isActive) };
});
