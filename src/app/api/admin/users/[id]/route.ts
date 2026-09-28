import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { deleteAdminUser, updateAdminUser } from "@/lib/services/admin-users";
import { adminUpdateSchema } from "@/lib/validations/auth";

type Params = { id: string };

/** Edit name, email and role. */
export const PATCH = adminRoute<Params>("admins:manage", async (req, { admin, params }) => {
  const input = adminUpdateSchema.parse((await readJson(req)) ?? {});
  return { user: await updateAdminUser(admin, params.id, input) };
});

export const DELETE = adminRoute<Params>("admins:manage", async (_req, { admin, params }) => {
  await deleteAdminUser(admin, params.id);
  return { ok: true };
});
