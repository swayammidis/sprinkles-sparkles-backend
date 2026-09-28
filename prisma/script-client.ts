import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** Prisma client for CLI scripts (seed, admin creation). Not used by the Next.js app. */
export function createScriptClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}
