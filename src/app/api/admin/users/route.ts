import { adminRoute, readJson } from "@/lib/api/admin-route";
import { createAdminUser, listAdminUsers } from "@/lib/services/admin-users";
import { adminUserCreateSchema } from "@/lib/validations/admin-user";

export const GET = adminRoute("admins:manage", async () => ({ items: await listAdminUsers() }));

export const POST = adminRoute("admins:manage", async (req) => {
  const input = adminUserCreateSchema.parse(await readJson(req));
  return Response.json({ item: await createAdminUser(input) }, { status: 201 });
});
