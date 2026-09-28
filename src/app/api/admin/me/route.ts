import { adminRoute } from "@/lib/api/admin-route";

/** The signed-in admin's profile. Fields are listed explicitly: no hash, no session id. */
export const GET = adminRoute("dashboard:view", async (_req, { admin }) => ({
  admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, lastLoginAt: admin.lastLoginAt },
}));
