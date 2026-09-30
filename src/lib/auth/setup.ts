import "server-only";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { INITIAL_ADMIN_LOCK, SetupState } from "@/models/SetupState";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";


/**
 * Admin registration and first-user bootstrap logic.
 *
 * SCENARIO A — FIRST USER:
 * If there are ZERO approved SUPER_ADMIN users in MongoDB:
 * The first registered user atomically acquires the setup lock and becomes:
 *   role: SUPER_ADMIN
 *   status: APPROVED
 *   isActive: true
 *
 * SCENARIO B — ALL FUTURE USERS:
 * Once an approved SUPER_ADMIN exists:
 * New registrations are created as:
 *   role: ADMIN
 *   status: PENDING
 *   isActive: false
 * They cannot log in or access /admin until approved by a SUPER_ADMIN.
 *
 * All roles and statuses are strictly assigned by the server.
 */

export type RegistrationStatus = "open" | "restricted";

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  // Registration is always open now: first user gets SUPER_ADMIN, future users get PENDING ADMIN.
  await connectDB();
  return "open";
}

export class DuplicateEmailError extends Error {}
export class RegistrationClosedError extends Error {}

/**
 * Check if at least one approved SUPER_ADMIN exists in the database.
 * Also performs backwards-compatible migration for any legacy admin users without status.
 */
export async function hasApprovedSuperAdmin(): Promise<boolean> {
  await connectDB();
  // Ensure existing legacy admin records have status and isActive populated
  await AdminUser.updateMany(
    { status: { $exists: false } },
    { $set: { status: "APPROVED", isActive: true } },
  ).catch(() => {});

  const count = await AdminUser.countDocuments({
    role: "SUPER_ADMIN",
    status: "APPROVED",
    isActive: true,
  });
  return count > 0;
}

export type RegisteredAdminResult = {
  isFirstAdmin: boolean;
  admin: {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN";
    status: "APPROVED" | "PENDING";
  };
};

/**
 * Atomically registers a new admin.
 * If no SUPER_ADMIN exists, claims the atomic lock to create the initial SUPER_ADMIN.
 * If a SUPER_ADMIN already exists (or another request won the bootstrap lock), creates a PENDING ADMIN.
 */
export async function registerAdmin(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisteredAdminResult> {
  await connectDB();
  const normalizedEmail = input.email.toLowerCase().trim();

  // Pre-check for duplicate email before locking
  const emailExists = await AdminUser.exists({ email: normalizedEmail });
  if (emailExists) throw new DuplicateEmailError();

  const superAdminExists = await hasApprovedSuperAdmin();

  if (!superAdminExists) {
    // Attempt to acquire initial bootstrap lock
    let lockAcquired = false;
    try {
      await SetupState.create({ _id: INITIAL_ADMIN_LOCK });
      lockAcquired = true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        // Another concurrent request just took the lock; fallback to regular PENDING ADMIN registration below
        lockAcquired = false;
      } else {
        throw err;
      }
    }

    if (lockAcquired) {
      try {
        const user = await AdminUser.create({
          name: input.name.trim(),
          email: normalizedEmail,
          passwordHash: await hashPassword(input.password),
          role: "SUPER_ADMIN",
          status: "APPROVED",
          isActive: true,
          approvedAt: new Date(),
        });
        await SetupState.updateOne(
          { _id: INITIAL_ADMIN_LOCK },
          { $set: { adminId: user._id, completedAt: new Date() } },
        );
        // Automatically create session and set HTTP-only cookie for immediate dashboard access
        await createSession(user._id).catch((err) => {
          console.error("[setup] createSession error for first admin:", err);
        });
        return {
          isFirstAdmin: true,
          admin: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: "SUPER_ADMIN",
            status: "APPROVED",
          },
        };

      } catch (err) {
        // Release lock so another attempt can succeed
        await SetupState.deleteOne({ _id: INITIAL_ADMIN_LOCK, adminId: null }).catch(() => {});
        if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
        throw err;
      }
    }
  }

  // Future user registration: created as PENDING ADMIN
  try {
    const user = await AdminUser.create({
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(input.password),
      role: "ADMIN",
      status: "PENDING",
      isActive: false,
    });
    return {
      isFirstAdmin: false,
      admin: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: "ADMIN",
        status: "PENDING",
      },
    };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
    throw err;
  }
}

/** Keep backwards compatible export name */
export const registerFirstAdmin = registerAdmin;
