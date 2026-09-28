import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Failed-login counters for brute-force protection. They expire automatically via the TTL index. */
const loginAttemptSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // "email:<addr>" or "ip:<addr>"
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { collection: "login_attempts" },
);

export type LoginAttemptFields = InferSchemaType<typeof loginAttemptSchema>;

export const LoginAttempt: Model<LoginAttemptFields> =
  (models.LoginAttempt as Model<LoginAttemptFields> | undefined) ??
  model<LoginAttemptFields>("LoginAttempt", loginAttemptSchema);
