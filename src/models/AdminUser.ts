import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/auth/permissions";

/**
 * Admin accounts for the back office.
 * `passwordHash` is `select: false` and is also stripped from toJSON/toObject,
 * so it can't reach a response by accident.
 */
const adminUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "ADMIN" },
    isActive: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: "admin_users",
    toJSON: { transform: stripSecrets },
    toObject: { transform: stripSecrets },
  },
);

function stripSecrets(_doc: unknown, ret: Record<string, unknown>) {
  delete ret.passwordHash;
  delete ret.__v;
  return ret;
}

export type AdminUserFields = InferSchemaType<typeof adminUserSchema>;
export type AdminUserDocument = HydratedDocument<AdminUserFields>;

export const AdminUser: Model<AdminUserFields> =
  (models.AdminUser as Model<AdminUserFields> | undefined) ?? model<AdminUserFields>("AdminUser", adminUserSchema);
