import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { resetAdminPassword } from "@/lib/services/admin-users";
import { resetPasswordSchema } from "@/lib/validations/auth";

/** Replace an admin's password. The existing password is never read or returned. */
export const POST = adminRoute<{ id: string }>("admins:manage", async (req, { admin, params }) => {
  const { password } = resetPasswordSchema.parse((await readJson(req)) ?? {});
  await resetAdminPassword(admin, params.id, password);
  return { ok: true };
});
