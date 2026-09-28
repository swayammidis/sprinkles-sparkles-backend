import { Schema, Types, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One-time setup lock. Public registration inserts the document
 * `{ _id: "initial-admin" }` before creating the first admin. Because `_id` is
 * unique, two simultaneous registrations can never both succeed, so there is
 * only ever one first SUPER_ADMIN created through /register.
 */
const setupStateSchema = new Schema(
  {
    _id: { type: String, required: true },
    adminId: { type: Types.ObjectId, ref: "AdminUser", default: null },
    completedAt: { type: Date, default: null },
  },
  { collection: "setup_state", timestamps: { createdAt: true, updatedAt: false } },
);

export type SetupStateFields = InferSchemaType<typeof setupStateSchema>;

export const SetupState: Model<SetupStateFields> =
  (models.SetupState as Model<SetupStateFields> | undefined) ?? model<SetupStateFields>("SetupState", setupStateSchema);

export const INITIAL_ADMIN_LOCK = "initial-admin";
