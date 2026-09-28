import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Role } from "@/lib/auth/permissions";

const select = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export async function listAdminUsers() {
  const users = await prisma.adminUser.findMany({ select, orderBy: { createdAt: "asc" } });
  return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
}

/** Admins are provisioned here (public sign-up is disabled). Password hashed with Better Auth's scrypt. */
export async function createAdminUser(input: { name: string; email: string; password: string; role: Role }) {
  const existing = await prisma.adminUser.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict("An admin with this email already exists", { fieldErrors: { email: ["Already in use"] } });

  const id = randomUUID();
  const password = await hashPassword(input.password);
  const user = await prisma.adminUser.create({
    data: {
      id,
      name: input.name,
      email: input.email,
      emailVerified: true,
      role: input.role,
      active: true,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
    },
    select,
  });
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export async function updateAdminUser(actorId: string, id: string, patch: { role?: Role; active?: boolean }) {
  if (actorId === id && (patch.role !== undefined || patch.active === false)) {
    throw badRequest("You cannot change your own role or deactivate yourself");
  }
  const target = await prisma.adminUser.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!target) throw notFound("Admin user");

  // Never leave the system without an active SUPER_ADMIN.
  const demoting = target.role === "SUPER_ADMIN" && (patch.role === "ADMIN" || patch.active === false);
  if (demoting) {
    const others = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN", active: true, id: { not: id } } });
    if (others === 0) throw badRequest("At least one active Super Admin is required");
  }

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.adminUser.update({ where: { id }, data: patch, select });
    // Revoke sessions on deactivation or role change so it applies immediately.
    if (patch.active === false || patch.role !== undefined) await tx.adminSession.deleteMany({ where: { userId: id } });
    return u;
  });
  return { ...user, createdAt: user.createdAt.toISOString() };
}
