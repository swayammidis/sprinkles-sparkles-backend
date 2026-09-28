import "server-only";
import { env } from "@/lib/env";
import { LocalStorageProvider } from "@/lib/uploads/providers/local";
import { S3StorageProvider } from "@/lib/uploads/providers/s3";

/**
 * Provider-agnostic object storage.
 *
 * The database only ever stores `key` + public `url` (see MediaAsset).
 * To add a provider (Cloudinary, GCS, Bunny…), implement this interface and
 * register it in `getStorage()` — no other code needs to change.
 */
export interface StorageProvider {
  readonly name: string;
  put(input: { key: string; body: Uint8Array; contentType: string }): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
}

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const e = env();
  switch (e.STORAGE_PROVIDER) {
    case "s3":
      instance = new S3StorageProvider({
        endpoint: e.S3_ENDPOINT,
        region: e.S3_REGION,
        bucket: e.S3_BUCKET,
        accessKeyId: e.S3_ACCESS_KEY_ID,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: e.STORAGE_PUBLIC_BASE_URL,
      });
      break;
    case "local":
    default:
      instance = new LocalStorageProvider({ publicBaseUrl: e.STORAGE_PUBLIC_BASE_URL });
  }
  return instance;
}
