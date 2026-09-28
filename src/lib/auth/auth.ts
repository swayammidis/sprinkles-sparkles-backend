import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env();

export const auth = betterAuth({
  appName: "Sprinkle & Sparkle Admin",
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  trustedOrigins: [BETTER_AUTH_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // Admin accounts are created by a SUPER_ADMIN or the CLI script — never by public sign-up.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
  },

  user: {
    modelName: "adminUser",
    additionalFields: {
      // input: false => these can never be set from a client request.
      role: { type: "string", required: false, defaultValue: "ADMIN", input: false },
      active: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  session: {
    modelName: "adminSession",
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60, // refresh expiry at most hourly
  },
  account: { modelName: "adminAccount" },
  verification: { modelName: "adminVerification" },

  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60 * 5, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "ss-admin",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
  },

  databaseHooks: {
    session: {
      create: {
        // Deactivated admins cannot start new sessions.
        before: async (session) => {
          const user = await prisma.adminUser.findUnique({
            where: { id: session.userId },
            select: { active: true },
          });
          if (!user?.active) return false;
        },
      },
    },
  },

  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
