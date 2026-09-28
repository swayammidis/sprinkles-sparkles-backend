import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Server-side record of each login. The session JWT carries only a random `sid`;
 * the server checks that this record still exists on every admin request.
 * Deleting the record (logout, deactivation) invalidates the session immediately,
 * even though JWTs are otherwise stateless. Expired records are removed by the TTL index.
 */
const adminSessionSchema = new Schema(
  {
    sid: { type: String, required: true, unique: true },
    userId: { type: Types.ObjectId, ref: "AdminUser", required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 }, // TTL index
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "admin_sessions" },
);

export type AdminSessionFields = InferSchemaType<typeof adminSessionSchema>;

export const AdminSession: Model<AdminSessionFields> =
  (models.AdminSession as Model<AdminSessionFields> | undefined) ??
  model<AdminSessionFields>("AdminSession", adminSessionSchema);
