import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Stub server-only in require cache so tsx does not throw in CLI context
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

import mongoose from "mongoose";
import { connectDB, DatabaseConfigError } from "../src/lib/db";
import { AdminUser } from "../src/models/AdminUser";
import { SetupState, INITIAL_ADMIN_LOCK } from "../src/models/SetupState";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const rawEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const rawPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();

  if (!rawEmail) {
    console.error("✗ Error: BOOTSTRAP_ADMIN_EMAIL environment variable is required.");
    console.error("  Set it in .env.local or pass it when running: BOOTSTRAP_ADMIN_EMAIL=owner@example.com npm run bootstrap:admin");
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = rawEmail.toLowerCase().trim();

  await connectDB();

  // Find existing account by normalized email
  const existingUser = await AdminUser.findOne({ email: normalizedEmail }).select("+passwordHash");

  let adminId: mongoose.Types.ObjectId;

  if (existingUser) {
    // Scenario 1: User already exists (e.g. registered as PENDING ADMIN)
    // Promote that exact user, do not create a duplicate
    const updates: Record<string, unknown> = {
      role: "SUPER_ADMIN",
      status: "APPROVED",
      isActive: true,
      approvedAt: new Date(),
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
    };

    // If a new bootstrap password was explicitly supplied, update the password hash
    if (rawPassword && rawPassword.length > 0) {
      if (rawPassword.length < 8) {
        console.error("✗ Error: BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.");
        process.exitCode = 1;
        return;
      }
      updates.passwordHash = await hashPassword(rawPassword);
    }

    await AdminUser.updateOne({ _id: existingUser._id }, { $set: updates });
    adminId = existingUser._id as mongoose.Types.ObjectId;
  } else {
    // Scenario 2: User does not exist yet. Password is required to create new account.
    if (!rawPassword || rawPassword.length < 8) {
      console.error("✗ Error: User does not exist. BOOTSTRAP_ADMIN_PASSWORD (at least 8 characters) is required to create a new SUPER_ADMIN account.");
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(rawPassword);
    const newUser = await AdminUser.create({
      name: "Store Owner",
      email: normalizedEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "APPROVED",
      isActive: true,
      approvedAt: new Date(),
    });
    adminId = newUser._id as mongoose.Types.ObjectId;
  }

  // Ensure SetupState reflects this owner bootstrap so initial lock is permanently resolved
  await SetupState.findOneAndUpdate(
    { _id: INITIAL_ADMIN_LOCK },
    { $set: { adminId, completedAt: new Date() } },
    { upsert: true },
  );

  // Safety Verification: Ensure exactly 1 account exists for this email
  const count = await AdminUser.countDocuments({ email: normalizedEmail });
  if (count !== 1) {
    console.error(`✗ Inconsistency error: found ${count} accounts with email ${normalizedEmail}. Expected exactly 1.`);
    process.exitCode = 1;
    return;
  }

  // Safe success message — NEVER prints password or passwordHash
  console.log("\nSUPER_ADMIN bootstrap successful.");
  console.log(`Email: ${normalizedEmail}`);
  console.log("Role: SUPER_ADMIN");
  console.log("Status: APPROVED\n");
}

main()
  .catch((err: unknown) => {
    if (err instanceof DatabaseConfigError) {
      console.error(`✗ Database configuration error: ${err.message}`);
    } else {
      console.error(`✗ Bootstrap failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
