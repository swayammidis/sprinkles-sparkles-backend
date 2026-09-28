import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * bcrypt with cost factor 12 (~250ms per hash on typical servers).
 * Raise BCRYPT_COST over time as hardware gets faster; existing hashes keep working.
 */
export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * A real bcrypt hash (same cost) of a random value. It's compared against when the
 * email doesn't exist, so response time doesn't reveal whether an account exists.
 */
export function getDummyHash(): Promise<string> {
  return (dummyHash ??= bcrypt.hash(randomBytes(24).toString("hex"), BCRYPT_COST));
}
