import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { createAdminUser, listAdminUsers } from "@/lib/services/admin-users";
import { adminCreateSchema } from "@/lib/validations/auth";

/** SUPER_ADMIN only ("admins:manage"). */
export const GET = adminRoute("admins:manage", async () => ({ users: await listAdminUsers() }));

export const POST = adminRoute("admins:manage", async (req, { admin }) => {
  const input = adminCreateSchema.parse((await readJson(req)) ?? {});
  const user = await createAdminUser(admin, input);
  return Response.json({ user }, { status: 201 });
});

