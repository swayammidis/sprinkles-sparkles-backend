import { randomUUID } from "node:crypto";

const KEY_REGEX = /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9-]+\.(jpg|png|webp|avif|gif)$/;

export function assertSafeKey(key: string) {
  if (!KEY_REGEX.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

/** Server-generated keys only — client filenames are never used in paths. */
export function generateKey(folder: "products" | "catalog" | "misc", ext: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${folder}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}
