import { adminRoute, readJson } from "@/lib/api/admin-route";
import { updateAdminUser } from "@/lib/services/admin-users";
import { adminUserUpdateSchema } from "@/lib/validations/admin-user";

export const PATCH = adminRoute<{ id: string }>("admins:manage", async (req, { admin, params }) => {
  const patch = adminUserUpdateSchema.parse(await readJson(req));
  return { item: await updateAdminUser(admin.id, params.id, patch) };
});
