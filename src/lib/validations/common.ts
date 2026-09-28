import { z } from "zod";

// Shared by client forms and server routes. No server-only imports here.

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const nameField = z.string().trim().min(1, "Required").max(120, "Max 120 characters");

export const slugField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(140, "Max 140 characters")
  .regex(SLUG_REGEX, "Use lowercase letters, numbers and hyphens only");

export const optionalText = (max: number) => z.string().trim().max(max, `Max ${max} characters`);

/** Money as a decimal string, e.g. "249" or "249.50". Never a float. */
export const MONEY_REGEX = /^\d{1,8}(\.\d{1,2})?$/;
export const moneyField = z.string().trim().regex(MONEY_REGEX, "Enter a valid amount, e.g. 249 or 249.50");
/** "" means "not set". */
export const optionalMoneyField = z.union([z.literal(""), moneyField]);
export const optionalDecimalField = z.union([
  z.literal(""),
  z.string().trim().regex(MONEY_REGEX, "Enter a valid number, e.g. 250 or 12.5"),
]);

export const stockField = z
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(0, "Cannot be negative")
  .max(1_000_000, "Too large");

/** An id reference; "" means none. */
export const optionalId = z.string().trim().max(64);

/**
 * Image reference stored on a record. Either a site-relative path ("/media/...")
 * or an absolute https URL from the configured storage provider.
 */
export const imageRefField = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(v), {
    message: "Must be an uploaded image URL",
  });

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

/** Compare two decimal strings exactly without floating point. Returns -1, 0, 1. */
export function compareMoney(a: string, b: string): number {
  const toCents = (s: string) => {
    const [whole, frac = ""] = s.split(".");
    return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
  };
  const x = toCents(a);
  const y = toCents(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
