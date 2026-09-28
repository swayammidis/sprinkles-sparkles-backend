import "server-only";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { INITIAL_ADMIN_LOCK, SetupState } from "@/models/SetupState";
import { hashPassword } from "@/lib/auth/password";

/**
 * First-admin registration.
 *
 * Public registration is only possible while BOTH of these hold:
 *   - the database has no admin users
 *   - the one-time setup lock hasn't been taken
 * The first (and only) account created this way is always SUPER_ADMIN. Every
 * later account is created by a signed-in SUPER_ADMIN.
 *
 * No setup code is required, so whoever registers first becomes SUPER_ADMIN:
 * create the first admin before the site is publicly reachable.
 */

export type RegistrationStatus = "open" | "restricted";

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  await connectDB();
  const [admins, lock] = await Promise.all([
    AdminUser.countDocuments({}, { limit: 1 }),
    SetupState.exists({ _id: INITIAL_ADMIN_LOCK }),
  ]);
  return admins === 0 && !lock ? "open" : "restricted";
}

export class RegistrationClosedError extends Error {}
export class DuplicateEmailError extends Error {}

/**
 * Atomically claims the one-time setup lock, then creates the SUPER_ADMIN.
 * If creation fails, the lock is released so setup can be retried.
 */
export async function registerFirstAdmin(input: { name: string; email: string; password: string }) {
  await connectDB();
  if ((await AdminUser.countDocuments({}, { limit: 1 })) > 0) throw new RegistrationClosedError();

  try {
    await SetupState.create({ _id: INITIAL_ADMIN_LOCK });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new RegistrationClosedError();
    throw err;
  }

  try {
    const user = await AdminUser.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "SUPER_ADMIN", // always decided by the server, never by the request
      isActive: true,
    });
    await SetupState.updateOne({ _id: INITIAL_ADMIN_LOCK }, { $set: { adminId: user._id, completedAt: new Date() } });
    return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
  } catch (err) {
    await SetupState.deleteOne({ _id: INITIAL_ADMIN_LOCK, adminId: null }).catch(() => {});
    if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
    throw err;
  }
}
