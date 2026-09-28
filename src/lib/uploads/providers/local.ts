import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "@/lib/uploads/storage";
import { assertSafeKey } from "@/lib/uploads/keys";

/** Files live outside /public so only validated keys are served, via /media/[...key]. */
export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export function resolveLocalPath(key: string): string {
  assertSafeKey(key);
  const full = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (!full.startsWith(path.resolve(LOCAL_STORAGE_ROOT) + path.sep)) throw new Error("Invalid key");
  return full;
}

/**
 * Development storage on local disk. Not suitable for serverless/multi-instance
 * production — use the S3-compatible provider there.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private opts: { publicBaseUrl: string }) {}

  async put({ key, body }: { key: string; body: Uint8Array; contentType: string }) {
    const full = resolveLocalPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { flag: "wx" });
    const base = this.opts.publicBaseUrl.replace(/\/$/, "");
    return { key, url: `${base}/media/${key}` };
  }

  async delete(key: string) {
    await rm(resolveLocalPath(key), { force: true });
  }

  static async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolveLocalPath(key));
    } catch {
      return null;
    }
  }
}
