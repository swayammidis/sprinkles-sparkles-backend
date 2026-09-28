/**
 * Role-based authorization.
 *
 * To add a permission: add it to PERMISSIONS, then grant it to roles below.
 * To add a role: add it to ROLES and ROLE_PERMISSIONS (the AdminUser model enum uses ROLES).
 *
 * This file has no server-only imports so the client can use it to hide UI
 * affordances. Hiding UI is cosmetic — every API route re-checks on the server.
 */
export const PERMISSIONS = [
  "dashboard:view",
  "catalog:read",
  "catalog:write",
  "catalog:delete",
  "media:read",
  "media:write",
  "media:delete",
  "admins:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["SUPER_ADMIN", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: [
    "dashboard:view",
    "catalog:read",
    "catalog:write",
    "catalog:delete",
    "media:read",
    "media:write",
    "media:delete",
  ],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
};
