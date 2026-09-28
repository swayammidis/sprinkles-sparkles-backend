/**
 * Create an admin user from the command line (public sign-up is disabled).
 *
 *   npm run admin:create -- --email owner@example.com --name "Owner" --role SUPER_ADMIN
 *
 * The password is read from ADMIN_PASSWORD (env) or prompted interactively,
 * so it never appears in shell history.
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import { createScriptClient } from "../prisma/script-client";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = arg("name") ?? process.env.SEED_ADMIN_NAME ?? "Admin";
  const role = (arg("role") ?? "SUPER_ADMIN").toUpperCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Provide a valid --email");
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") throw new Error("--role must be SUPER_ADMIN or ADMIN");

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 12 chars, upper+lower+number): ");
    rl.close();
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Password must be 12+ characters with upper-case, lower-case letters and a number");
  }

  const prisma = createScriptClient();
  try {
    if (await prisma.adminUser.findUnique({ where: { email } })) throw new Error(`Admin ${email} already exists`);
    const id = randomUUID();
    await prisma.adminUser.create({
      data: {
        id,
        email,
        name,
        role: role as "SUPER_ADMIN" | "ADMIN",
        emailVerified: true,
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
      },
    });
    console.log(`✓ Created ${role} ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
