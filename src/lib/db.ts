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
  let uri = process.env.MONGODB_URI?.trim();
  if (uri) {
    uri = uri.replace(/^["']|["']$/g, "").trim();
  }
  if (!uri) throw new DatabaseConfigError("MONGODB_URI is not set. Add it to .env.local.");
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new DatabaseConfigError("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  }
  if (/[<>]/.test(uri)) {
    throw new DatabaseConfigError("MONGODB_URI still contains a placeholder such as <URL_ENCODED_PASSWORD>. Replace it with the real (URL-encoded) password.");
  }
  return uri;
}

export function sanitizeDbError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  let msg = `${err.name}: ${err.message}`;
  msg = msg.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/g, "mongodb$1://[REDACTED]@");
  msg = msg.replace(/(password|secret|token)=([^\s&]+)/gi, "$1=[REDACTED]");
  return msg;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    let uri: string;
    try {
      uri = readMongoUri();
    } catch (err) {
      console.error("[db] MongoDB configuration error:", err instanceof Error ? err.message : "invalid config");
      throw err;
    }
    cache.promise = mongoose.connect(uri, {
      dbName: DB_NAME, // always sprinkle_sparkle, regardless of the URI path
      bufferCommands: false, // fail fast instead of queueing queries while disconnected
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    cache.promise = null; // allow a retry on the next request
    // Log the driver error server-side safely; callers get a generic error.
    console.error("[db] MongoDB connection failed:", sanitizeDbError(err));
    throw new DatabaseUnavailableError("Database unavailable");
  }
}
