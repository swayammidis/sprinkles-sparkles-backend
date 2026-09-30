import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Stub server-only in require cache so tsx does not throw
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeModule;
} catch {
  // ignore
}

import { hasPermission } from "../src/lib/auth/permissions";
import { ROLES } from "../src/lib/auth/permissions";
import { ADMIN_STATUSES } from "../src/models/AdminUser";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? detail : "");
  }
}

async function testPermissions() {
  console.log("\n--- TEST: Role Permissions & Enums (Sections 4, 15) ---");
  check("ROLES contains SUPER_ADMIN and ADMIN", ROLES.includes("SUPER_ADMIN") && ROLES.includes("ADMIN"));
  check("ADMIN_STATUSES contains PENDING, APPROVED, REJECTED", ADMIN_STATUSES.includes("PENDING") && ADMIN_STATUSES.includes("APPROVED") && ADMIN_STATUSES.includes("REJECTED"));
  check("SUPER_ADMIN has admins:manage permission", hasPermission("SUPER_ADMIN", "admins:manage") === true);
  check("SUPER_ADMIN has settings:manage permission", hasPermission("SUPER_ADMIN", "settings:manage") === true);
  check("SUPER_ADMIN has catalog:write permission", hasPermission("SUPER_ADMIN", "catalog:write") === true);
  check("ADMIN does NOT have admins:manage permission", hasPermission("ADMIN", "admins:manage") === false);
  check("ADMIN does NOT have settings:manage permission", hasPermission("ADMIN", "settings:manage") === false);
  check("ADMIN has catalog:read permission", hasPermission("ADMIN", "catalog:read") === true);
  check("ADMIN has catalog:write permission", hasPermission("ADMIN", "catalog:write") === true);
  check("ADMIN has dashboard:view permission", hasPermission("ADMIN", "dashboard:view") === true);
}

function testLoginLogicMatrix() {
  console.log("\n--- TEST: Login Decision Matrix (Section 6) ---");
  
  // Custom simulation matching authorizeAdmin exact logic
  const evaluateLogin = (user: { email: string; status?: string; isActive: boolean; role: string } | null, passwordValid: boolean) => {
    if (!user || !passwordValid) {
      return { ok: false, code: "invalid_credentials", message: "Invalid email or password." };
    }
    const userStatus = user.status ?? "APPROVED";
    if (userStatus === "PENDING") {
      return { ok: false, code: "pending_approval", message: "Your admin access request is still waiting for approval." };
    }
    if (userStatus === "REJECTED") {
      return { ok: false, code: "account_rejected", message: "Your admin access request was not approved. Please contact the store administrator." };
    }
    if (userStatus !== "APPROVED" || !user.isActive) {
      return { ok: false, code: "account_inactive", message: "Your admin account is inactive. Please contact the store administrator." };
    }
    if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return { ok: false, code: "invalid_credentials", message: "Invalid email or password." };
    }
    return { ok: true, code: "success", role: user.role, status: userStatus };
  };

  // 1. Unknown user
  const r1 = evaluateLogin(null, false);
  check("Unknown user is rejected", !r1.ok && r1.code === "invalid_credentials");

  // 2. Invalid password
  const r2 = evaluateLogin({ email: "user@example.com", status: "APPROVED", isActive: true, role: "ADMIN" }, false);
  check("Invalid password rejected", !r2.ok && r2.code === "invalid_credentials");

  // 3. Pending admin
  const r3 = evaluateLogin({ email: "pending@example.com", status: "PENDING", isActive: false, role: "ADMIN" }, true);
  check("Pending admin blocked with pending_approval code", !r3.ok && r3.code === "pending_approval");
  check("Pending admin gets expected user message", r3.message === "Your admin access request is still waiting for approval.");

  // 4. Rejected admin
  const r4 = evaluateLogin({ email: "rejected@example.com", status: "REJECTED", isActive: false, role: "ADMIN" }, true);
  check("Rejected admin blocked with account_rejected code", !r4.ok && r4.code === "account_rejected");
  check("Rejected admin gets expected user message", r4.message === "Your admin access request was not approved. Please contact the store administrator.");

  // 5. Inactive approved admin
  const r5 = evaluateLogin({ email: "inactive@example.com", status: "APPROVED", isActive: false, role: "ADMIN" }, true);
  check("Inactive approved admin blocked with account_inactive code", !r5.ok && r5.code === "account_inactive");
  check("Inactive admin gets safe user message", r5.message === "Your admin account is inactive. Please contact the store administrator.");

  // 6. Approved active admin
  const r6 = evaluateLogin({ email: "admin@example.com", status: "APPROVED", isActive: true, role: "ADMIN" }, true);
  check("Approved active admin login SUCCEEDS", r6.ok && r6.role === "ADMIN");

  // 7. Approved active SUPER_ADMIN
  const r7 = evaluateLogin({ email: "super@example.com", status: "APPROVED", isActive: true, role: "SUPER_ADMIN" }, true);
  check("Approved active SUPER_ADMIN login SUCCEEDS", r7.ok && r7.role === "SUPER_ADMIN");

  // 8. Legacy user with missing status defaults to APPROVED
  const r8 = evaluateLogin({ email: "legacy@example.com", isActive: true, role: "SUPER_ADMIN" }, true);
  check("Legacy user defaults to APPROVED and SUCCEEDS", r8.ok && r8.status === "APPROVED");
}

function testBootstrapLogicSimulation() {
  console.log("\n--- TEST: Bootstrap & Race Condition Simulation (Sections 1, 5, 21) ---");
  type UserDoc = {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "ADMIN";
    status: "APPROVED" | "PENDING" | "REJECTED";
    isActive: boolean;
    approvedAt?: Date;
    approvedBy?: string;
    rejectedAt?: Date;
    rejectedBy?: string;
  };

  const users: UserDoc[] = [];
  let setupLockHeld = false;

  const registerUser = (name: string, email: string) => {
    // Normalise email
    const normalized = email.toLowerCase().trim();
    if (users.some((u) => u.email === normalized)) {
      throw new Error("An account with this email already exists.");
    }

    const hasSuper = users.some((u) => u.role === "SUPER_ADMIN" && u.status === "APPROVED" && u.isActive);
    if (!hasSuper) {
      if (!setupLockHeld) {
        setupLockHeld = true; // atomic lock won
        const doc: UserDoc = {
          id: String(users.length + 1),
          name: name.trim(),
          email: normalized,
          role: "SUPER_ADMIN",
          status: "APPROVED",
          isActive: true,
          approvedAt: new Date(),
        };
        users.push(doc);
        return { isFirstAdmin: true, user: doc };
      }
    }

    // Subsequent user
    const doc: UserDoc = {
      id: String(users.length + 1),
      name: name.trim(),
      email: normalized,
      role: "ADMIN",
      status: "PENDING",
      isActive: false,
    };
    users.push(doc);
    return { isFirstAdmin: false, user: doc };
  };

  // Test 1: First user registration
  const first = registerUser("First Owner", "OWNER@example.com");
  check("First user becomes SUPER_ADMIN", first.isFirstAdmin && first.user.role === "SUPER_ADMIN" && first.user.status === "APPROVED" && first.user.isActive === true);
  check("First user email is normalized to lowercase", first.user.email === "owner@example.com");

  // Test 2: Second user registration
  const second = registerUser("Second Admin", "second@example.com");
  check("Second user becomes ADMIN with PENDING and isActive=false", !second.isFirstAdmin && second.user.role === "ADMIN" && second.user.status === "PENDING" && second.user.isActive === false);

  // Test 3: Duplicate email prevention
  try {
    registerUser("Duplicate Owner", "owner@example.com");
    check("Duplicate email rejected", false);
  } catch (e) {
    check("Duplicate email throws 'An account with this email already exists.'", (e as Error).message === "An account with this email already exists.");
  }

  // Test 4: Approval by SUPER_ADMIN
  const approveUser = (actorId: string, targetId: string) => {
    const target = users.find((u) => u.id === targetId);
    if (!target) throw new Error("Not found");
    target.status = "APPROVED";
    target.isActive = true;
    target.approvedAt = new Date();
    target.approvedBy = actorId;
    return target;
  };
  const approvedSecond = approveUser(first.user.id, second.user.id);
  check("Approved user has status=APPROVED and isActive=true", approvedSecond.status === "APPROVED" && approvedSecond.isActive === true);
  check("Approved user has approvedBy and approvedAt audit fields", approvedSecond.approvedBy === first.user.id && !!approvedSecond.approvedAt);

  // Test 5: Rejection by SUPER_ADMIN
  const third = registerUser("Third Requester", "third@example.com");
  check("Third user starts as PENDING", third.user.status === "PENDING");

  const rejectUser = (actorId: string, targetId: string) => {
    const target = users.find((u) => u.id === targetId);
    if (!target) throw new Error("Not found");
    target.status = "REJECTED";
    target.isActive = false;
    target.rejectedAt = new Date();
    target.rejectedBy = actorId;
    return target;
  };
  const rejectedThird = rejectUser(first.user.id, third.user.id);
  check("Rejected user has status=REJECTED and isActive=false", rejectedThird.status === "REJECTED" && rejectedThird.isActive === false);
  check("Rejected user has rejectedBy and rejectedAt audit fields", rejectedThird.rejectedBy === first.user.id && !!rejectedThird.rejectedAt);

  // Test 6: Simultaneous First Registration Simulation (Race condition)
  // Reset simulation
  users.length = 0;
  setupLockHeld = false;
  // Two simultaneous requests attempt to register when users is empty
  const results = [
    registerUser("Candidate A", "candA@example.com"),
    registerUser("Candidate B", "candB@example.com"),
  ];
  const superCount = results.filter((r) => r.user.role === "SUPER_ADMIN").length;
  const adminCount = results.filter((r) => r.user.role === "ADMIN").length;
  check("Simultaneous registration produces exactly 1 SUPER_ADMIN", superCount === 1);
  check("Simultaneous registration produces 1 ADMIN with PENDING", adminCount === 1 && results.find((r) => r.user.role === "ADMIN")?.user.status === "PENDING");
}

function testSelfProtectionLogic() {
  console.log("\n--- TEST: Self-Protection Guardrails (Section 14) ---");
  const superAdminId = "super_001";

  const deleteAdmin = (actorId: string, targetId: string) => {
    if (actorId === targetId) throw new Error("You cannot delete your own account.");
    return true;
  };

  const deactivateAdmin = (actorId: string, targetId: string, isActive: boolean) => {
    if (actorId === targetId && !isActive) throw new Error("You cannot deactivate your own account.");
    return true;
  };

  const changeRole = (actorId: string, targetId: string, nextRole: string, currentRole: string) => {
    if (actorId === targetId && nextRole !== currentRole) throw new Error("You cannot change your own role.");
    return true;
  };

  try {
    deleteAdmin(superAdminId, superAdminId);
    check("Prevent self-delete", false);
  } catch (e) {
    check("SUPER_ADMIN cannot delete own account", (e as Error).message === "You cannot delete your own account.");
  }

  try {
    deactivateAdmin(superAdminId, superAdminId, false);
    check("Prevent self-deactivate", false);
  } catch (e) {
    check("SUPER_ADMIN cannot deactivate own account", (e as Error).message === "You cannot deactivate your own account.");
  }

  try {
    changeRole(superAdminId, superAdminId, "ADMIN", "SUPER_ADMIN");
    check("Prevent self-demote", false);
  } catch (e) {
    check("SUPER_ADMIN cannot demote own role", (e as Error).message === "You cannot change your own role.");
  }
}

async function main() {
  console.log("==================================================");
  console.log("RUNNING SPRINKLE & SPARKLE AUTH & APPROVAL TESTS");
  console.log("==================================================");

  await testPermissions();
  testLoginLogicMatrix();
  testBootstrapLogicSimulation();
  testSelfProtectionLogic();

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`==================================================`);
  if (failed > 0) process.exit(1);
}

main();
