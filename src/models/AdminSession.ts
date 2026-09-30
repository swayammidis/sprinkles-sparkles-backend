import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Custom MongoDB-backed AdminSession model.
 * Stores only a SHA-256 hash of the session token (`tokenHash`).
 * The raw token only exists in the user's secure HTTP-only cookie.
 */
const adminSessionSchema = new Schema(
  {
    adminUserId: { type: Types.ObjectId, ref: "AdminUser", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true, expires: 0 }, // MongoDB TTL index
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "admin_sessions",
  },
);

export type AdminSessionFields = InferSchemaType<typeof adminSessionSchema>;

export const AdminSession: Model<AdminSessionFields> =
  (models.AdminSession as Model<AdminSessionFields> | undefined) ??
  model<AdminSessionFields>("AdminSession", adminSessionSchema);
