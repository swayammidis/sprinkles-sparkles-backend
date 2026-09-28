/**
 * Create an admin user. This is the only supported way to provision the first admin;
 * there is no public registration page or API.
 *
 *   npm run create-admin
 *
 * Prompts for Name, Email, Password (hidden, entered twice) and Role.
 * For automation, values can also be supplied:
 *   --name "Swayam" --email you@example.com --role SUPER_ADMIN
 *   ADMIN_PASSWORD=... (environment variable only, never a CLI flag, so it stays out of shell history)
 *
 * The password is never printed or stored in plaintext; only the bcrypt hash is saved.
 */
import { createInterface } from "node:readline/promises";
import mongoose from "mongoose";
import { connectDB, DatabaseConfigError, DB_NAME } from "../src/lib/db";
import { AdminUser } from "../src/models/AdminUser";
import { hashPassword } from "../src/lib/auth/password";
import { createAdminSchema } from "../src/lib/validations/auth";
import { ROLES } from "../src/lib/auth/permissions";

function flag(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function ask(question: string, fallback?: string) {
  if (fallback !== undefined) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it (shows * per character). */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("Password prompt needs an interactive terminal (or set ADMIN_PASSWORD for automation).");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          return reject(new Error("Cancelled"));
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (ch >= " ") {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

async function main() {
  console.log(`\nSprinkle & Sparkle: create admin user (database: ${DB_NAME})\n`);

  const name = await ask("Name: ", flag("name"));
  const email = await ask("Email: ", flag("email"));

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    console.log("Password: at least 8 characters, with upper-case, lower-case letters and a number.");
    password = await askHidden("Password: ");
    const confirm = await askHidden("Confirm password: ");
    if (password !== confirm) throw new Error("Passwords do not match. Nothing was created.");
  }

  const roleInput = await ask(`Role (${ROLES.join(" / ")}) [SUPER_ADMIN]: `, flag("role"));
  const role = (roleInput || "SUPER_ADMIN").toUpperCase();

  const parsed = createAdminSchema.safeParse({ name, email, password, role });
  if (!parsed.success) {
    // Show messages only. Never echo the submitted values (they include the password).
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "input"}: ${i.message}`);
    throw new Error(`Invalid input:\n${lines.join("\n")}`);
  }

  await connectDB();

  const existing = await AdminUser.findOne({ email: parsed.data.email }).select("_id role isActive").lean();
  if (existing) {
    console.log(`\n! An admin with email ${parsed.data.email} already exists (role: ${existing.role}, ${existing.isActive ? "active" : "inactive"}).`);
    console.log("  No new account was created.");
    process.exitCode = 2;
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await AdminUser.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
    isActive: true,
  });

  console.log(`\n✓ Created ${user.role} "${user.name}" <${user.email}>`);
  console.log("  Sign in at /login");
}

main()
  .catch((err: unknown) => {
    if (err instanceof DatabaseConfigError) console.error(`\n✗ ${err.message}`);
    else if (err instanceof Error && err.message === "Database unavailable") {
      console.error("\n✗ Could not connect to MongoDB. Check MONGODB_URI, the network, and the Atlas IP access list.");
    } else if (err instanceof Error && "code" in err && (err as { code?: number }).code === 11000) {
      console.error("\n✗ An admin with this email already exists.");
    } else console.error(`\n✗ ${err instanceof Error ? err.message : "Unexpected error"}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
