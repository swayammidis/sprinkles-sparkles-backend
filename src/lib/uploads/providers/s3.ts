import "server-only";
import { AwsClient } from "aws4fetch";
import type { StorageProvider } from "@/lib/uploads/storage";
import { assertSafeKey } from "@/lib/uploads/keys";

type S3Options = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public URL the bucket is served from (CDN / R2 public domain / S3 website). */
  publicBaseUrl: string;
};

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces…).
 * Uses path-style requests signed with SigV4. Credentials stay on the server.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private client: AwsClient;

  constructor(private opts: S3Options) {
    for (const k of ["endpoint", "bucket", "accessKeyId", "secretAccessKey", "publicBaseUrl"] as const) {
      if (!opts[k]) throw new Error(`S3 storage misconfigured: missing ${k}`);
    }
    this.client = new AwsClient({
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      region: opts.region || "auto",
      service: "s3",
    });
  }

  private objectUrl(key: string) {
    const base = this.opts.endpoint.replace(/\/$/, "");
    return `${base}/${encodeURIComponent(this.opts.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put({ key, body, contentType }: { key: string; body: Uint8Array; contentType: string }) {
    assertSafeKey(key);
    const res = await this.client.fetch(this.objectUrl(key), {
      method: "PUT",
      body: body as BodyInit,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
    return { key, url: `${this.opts.publicBaseUrl.replace(/\/$/, "")}/${key}` };
  }

  async delete(key: string) {
    assertSafeKey(key);
    const res = await this.client.fetch(this.objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed (${res.status})`);
  }
}
