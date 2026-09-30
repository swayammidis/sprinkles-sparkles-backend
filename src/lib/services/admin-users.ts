import "server-only";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { AdminUser, type AdminStatus } from "@/models/AdminUser";
import { AdminSession } from "@/models/AdminSession";
import { hashPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/api/admin-route";
import { revokeAllSessionsForUser, type CurrentAdmin } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/permissions";

/** Safe shape sent to the admin UI. Never includes the password hash. */
export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AdminStatus;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
};

const SAFE_FIELDS = "name email role status isActive lastLoginAt createdAt approvedAt approvedBy rejectedAt rejectedBy";

type LeanAdmin = {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  status?: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  approvedAt?: Date | null;
  approvedBy?: unknown;
  rejectedAt?: Date | null;
  rejectedBy?: unknown;
};

function toRow(u: LeanAdmin): AdminUserRow {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role as Role,
    status: (u.status as AdminStatus) ?? "APPROVED",
    isActive: Boolean(u.isActive),
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date(0).toISOString(),
    approvedAt: u.approvedAt ? new Date(u.approvedAt).toISOString() : null,
    approvedBy: u.approvedBy ? String(u.approvedBy) : null,
    rejectedAt: u.rejectedAt ? new Date(u.rejectedAt).toISOString() : null,
    rejectedBy: u.rejectedBy ? String(u.rejectedBy) : null,
  };
}

const EMAIL_TAKEN = new ApiError(409, "An account with this email already exists.", {
  email: "An account with this email already exists.",
});

async function findTarget(id: string) {
  if (!isValidObjectId(id)) throw new ApiError(404, "Admin user not found.");
  const user = await AdminUser.findById(id).select(SAFE_FIELDS).lean<LeanAdmin>();
  if (!user) throw new ApiError(404, "Admin user not found.");
  return user;
}

/** Refuse any change that would leave no active approved SUPER_ADMIN. */
async function assertAnotherActiveSuperAdmin(excludingId: string) {
  const others = await AdminUser.countDocuments({
    role: "SUPER_ADMIN",
    status: "APPROVED",
    isActive: true,
    _id: { $ne: excludingId },
  });
  if (others === 0) throw new ApiError(409, "At least one active Super Admin is required.");
}

async function revokeSessions(userId: string, keepTokenHash?: string) {
  await revokeAllSessionsForUser(userId, keepTokenHash);
}

// ---------------------------------------------------------------------------
// Listing & Counts
// ---------------------------------------------------------------------------

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await connectDB();
  const users = await AdminUser.find().select(SAFE_FIELDS).sort({ createdAt: -1 }).lean<LeanAdmin[]>();
  return users.map(toRow);
}

export async function listAdminRequests(): Promise<AdminUserRow[]> {
  await connectDB();
  const requests = await AdminUser.find({ status: "PENDING" }).select(SAFE_FIELDS).sort({ createdAt: -1 }).lean<LeanAdmin[]>();
  return requests.map(toRow);
}

export async function getPendingRequestsCount(): Promise<number> {
  await connectDB();
  return AdminUser.countDocuments({ status: "PENDING" });
}

// ---------------------------------------------------------------------------
// Approval & Rejection Actions
// ---------------------------------------------------------------------------

export async function approveAdminRequest(actor: CurrentAdmin, id: string): Promise<AdminUserRow> {
  await connectDB();
  await findTarget(id);

  const updated = await AdminUser.findByIdAndUpdate(

    id,
    {
      $set: {
        status: "APPROVED",
        isActive: true,
        approvedAt: new Date(),
        approvedBy: actor.id,
      },
    },
    { new: true },
  )
    .select(SAFE_FIELDS)
    .lean<LeanAdmin>();

  return toRow(updated!);
}

export async function rejectAdminRequest(actor: CurrentAdmin, id: string): Promise<AdminUserRow> {
  await connectDB();
  const target = await findTarget(id);
  if (actor.id === id) throw new ApiError(400, "You cannot reject your own account.");
  if (target.role === "SUPER_ADMIN" && target.isActive) await assertAnotherActiveSuperAdmin(id);

  const updated = await AdminUser.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "REJECTED",
        isActive: false,
        rejectedAt: new Date(),
        rejectedBy: actor.id,
      },
    },
    { new: true },
  )
    .select(SAFE_FIELDS)
    .lean<LeanAdmin>();

  // Ensure any active sessions are destroyed immediately
  await revokeSessions(id);
  return toRow(updated!);
}

// ---------------------------------------------------------------------------
// Management Actions
// ---------------------------------------------------------------------------

export async function createAdminUser(actor: CurrentAdmin, input: { name: string; email: string; password: string; role: Role }) {
  await connectDB();
  const normalizedEmail = input.email.toLowerCase().trim();
  if (await AdminUser.exists({ email: normalizedEmail })) throw EMAIL_TAKEN;
  try {
    const user = await AdminUser.create({
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      status: "APPROVED",
      isActive: true,
      approvedAt: new Date(),
      approvedBy: actor.id,
    });
    return toRow(user.toObject() as LeanAdmin);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw EMAIL_TAKEN;
    throw err;
  }
}

export async function updateAdminUser(actor: CurrentAdmin, id: string, input: { name: string; email: string; role: Role }) {
  await connectDB();
  const target = await findTarget(id);
  const roleChanged = target.role !== input.role;

  if (roleChanged && actor.id === id) throw new ApiError(400, "You cannot change your own role.");
  if (roleChanged && target.role === "SUPER_ADMIN") await assertAnotherActiveSuperAdmin(id);
  const normalizedEmail = input.email.toLowerCase().trim();
  if (normalizedEmail !== target.email && (await AdminUser.exists({ email: normalizedEmail, _id: { $ne: id } }))) {
    throw EMAIL_TAKEN;
  }

  try {
    const updated = await AdminUser.findByIdAndUpdate(
      id,
      { $set: { name: input.name.trim(), email: normalizedEmail, role: input.role } },
      { new: true, runValidators: true },
    )
      .select(SAFE_FIELDS)
      .lean<LeanAdmin>();
    // A new role must apply immediately and cleanly, so sign them out everywhere.
    if (roleChanged) await revokeSessions(id);
    return toRow(updated!);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw EMAIL_TAKEN;
    throw err;
  }
}

export async function setAdminActive(actor: CurrentAdmin, id: string, isActive: boolean) {
  await connectDB();
  const target = await findTarget(id);
  if (actor.id === id && !isActive) throw new ApiError(400, "You cannot deactivate your own account.");
  if (!isActive && target.role === "SUPER_ADMIN" && target.isActive) await assertAnotherActiveSuperAdmin(id);

  const updated = await AdminUser.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { new: true },
  )
    .select(SAFE_FIELDS)
    .lean<LeanAdmin>();
  if (!isActive) await revokeSessions(id);
  return toRow(updated!);
}

/** Replace the password with a new one. The old password is never read or shown. */
export async function resetAdminPassword(actor: CurrentAdmin, id: string, password: string) {
  await connectDB();
  await findTarget(id);
  await AdminUser.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password) } });
  // Sign the account out everywhere. If you reset your own password, your current session is kept.
  await revokeSessions(id, actor.id === id ? actor.tokenHash : undefined);
}

export async function deleteAdminUser(actor: CurrentAdmin, id: string) {
  await connectDB();
  const target = await findTarget(id);
  if (actor.id === id) throw new ApiError(400, "You cannot delete your own account.");
  if (target.role === "SUPER_ADMIN" && target.isActive) await assertAnotherActiveSuperAdmin(id);
  await revokeSessions(id);
  await AdminUser.deleteOne({ _id: id });
}
