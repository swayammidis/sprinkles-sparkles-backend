/**
 * Verify the MongoDB connection and indexes.  npm run db:check
 * Prints the host and database name only, never the connection string or credentials.
 */
import mongoose from "mongoose";
import { connectDB, DatabaseConfigError } from "../src/lib/db";
import { AdminUser } from "../src/models/AdminUser";
import { AdminSession } from "../src/models/AdminSession";
import { LoginAttempt } from "../src/models/LoginAttempt";
import { SetupState } from "../src/models/SetupState";
import { Product } from "../src/models/Product";
import { MediaAsset } from "../src/models/MediaAsset";
import { StoreSettings } from "../src/models/StoreSettings";
import { Brand, Category, Collection, Occasion, Subcategory } from "../src/models/taxonomy";

async function main() {
  const { connection } = await connectDB();
  const ping = await connection.db!.admin().command({ ping: 1 });
  console.log(`✓ Connected to ${connection.host} / database "${connection.name}" (ping ok: ${ping.ok === 1})`);

  // Create any missing indexes (unique SKU/slug/email, TTL, query indexes). Additive only: never drops indexes.
  const models = [AdminUser, AdminSession, LoginAttempt, SetupState, Product, MediaAsset, StoreSettings, Category, Subcategory, Brand, Collection, Occasion];
  await Promise.all(models.map((m) => m.createIndexes()));
  console.log(`✓ Indexes ensured for ${models.length} collections: ${models.map((m) => m.collection.collectionName).join(", ")}`);

  const admins = await AdminUser.countDocuments();
  console.log(`✓ Admin users: ${admins}${admins === 0 ? " (run: npm run create-admin)" : ""}`);
}

main()
  .catch((err: unknown) => {
    if (err instanceof DatabaseConfigError) console.error(`✗ ${err.message}`);
    else console.error("✗ Could not connect to MongoDB. Check MONGODB_URI, the network, and the Atlas IP access list.");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
