import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";

// Shared by client forms and the server (every server entry point validates again).

export const emailField = z
  .string({ error: "Please enter a valid email address." })
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .pipe(z.email("Please enter a valid email address."))
  .transform((v) => v.toLowerCase());

export const nameField = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .min(2, "Name must be at least 2 characters.")
  .max(80, "Name must be at most 80 characters.");

/**
 * Password policy for every new or reset admin password.
 * bcrypt only uses the first 72 bytes, so longer input is rejected rather than silently truncated.
 */
export const newPasswordSchema = z
  .string({ error: "Password is required." })
  .min(1, "Password is required.")
  .min(8, "Password must be at least 8 characters.")
  .refine((p) => new TextEncoder().encode(p).length <= 72, "Password must be at most 72 bytes.")
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), {
    message: "Password must include an upper-case letter, a lower-case letter and a number.",
  });

/** Adds the "Passwords do not match." check on confirmPassword. */
const matches = (v: { password: string; confirmPassword: string }) => v.password === v.confirmPassword;
const mismatch = { path: ["confirmPassword"], message: "Passwords do not match." };

// ----------------------------------------------------------------------------
// Login
// ----------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(128, "Password is too long."),
});
export type LoginInput = z.input<typeof loginSchema>;

// ----------------------------------------------------------------------------
// Public first-admin registration (no role field: the server decides the role)
// ----------------------------------------------------------------------------

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: newPasswordSchema,
  confirmPassword: z.string({ error: "Please confirm your password." }).min(1, "Please confirm your password."),
}).refine(matches, mismatch);
export type RegisterInput = z.input<typeof registerSchema>;

// ----------------------------------------------------------------------------
// SUPER_ADMIN user management
// ----------------------------------------------------------------------------

export const adminCreateSchema = z.object({
  name: nameField,
  email: emailField,
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, "Please confirm the password."),
  role: z.enum(ROLES, { error: "Choose a role." }),
}).refine(matches, mismatch);
export type AdminCreateInput = z.input<typeof adminCreateSchema>;

export const adminUpdateSchema = z.object({
  name: nameField,
  email: emailField,
  role: z.enum(ROLES, { error: "Choose a role." }),
});
export type AdminUpdateInput = z.input<typeof adminUpdateSchema>;

export const adminStatusSchema = z.object({ isActive: z.boolean() });

export const resetPasswordSchema = z.object({
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, "Please confirm the password."),
}).refine(matches, mismatch);
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

/** CLI (`npm run create-admin`): no confirm field, since the script asks twice itself. */
export const createAdminSchema = z.object({
  name: nameField,
  email: emailField,
  password: newPasswordSchema,
  role: z.enum(ROLES),
});
