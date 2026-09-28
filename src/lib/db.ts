import mongoose from "mongoose";

/**
 * Reusable MongoDB (Mongoose) connection.
 *
 * The connection promise is cached on `globalThis`, so Next.js hot reloads in
 * development and repeated calls in production share one connection pool
 * instead of opening a new connection per request or per reload.
 *
 * Server-only: never import this from a Client Component. It's also used by the
 * CLI scripts, so it avoids Next-specific imports.
 */

export const DB_NAME = "sprinkle_sparkle";

export class DatabaseConfigError extends Error {}
export class DatabaseUnavailableError extends Error {}

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalForMongoose = globalThis as typeof globalThis & { _mongoose?: MongooseCache };
const cache: MongooseCache = (globalForMongoose._mongoose ??= { conn: null, promise: null });

/** Reads and sanity-checks MONGODB_URI. The value itself is never logged. */
export function readMongoUri(): string {
  if (typeof window !== "undefined") throw new DatabaseConfigError("Database access is server-only");
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new DatabaseConfigError("MONGODB_URI is not set. Add it to .env.local.");
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new DatabaseConfigError("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }
  if (/[<>]/.test(uri)) {
    throw new DatabaseConfigError("MONGODB_URI still contains a placeholder such as <URL_ENCODED_PASSWORD>. Replace it with the real (URL-encoded) password.");
  }
  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    const uri = readMongoUri();
    cache.promise = mongoose.connect(uri, {
      dbName: DB_NAME, // always sprinkle_sparkle, regardless of the URI path
      bufferCommands: false, // fail fast instead of queueing queries while disconnected
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 10,
      // Always ensure indexes exist. Unique indexes (SKU, slug, email) are part of data integrity, so
      // they must also exist in production. createIndex on an existing index is a no-op.
      autoIndex: true,
    });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    cache.promise = null; // allow a retry on the next request
    // Log the driver error server-side only; callers get a generic error.
    console.error("[db] MongoDB connection failed:", err instanceof Error ? err.name : "unknown error");
    throw new DatabaseUnavailableError("Database unavailable");
  }
}
