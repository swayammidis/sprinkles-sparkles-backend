import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";

export const passwordField = z
  .string()
  .min(12, "At least 12 characters")
  .max(128, "Max 128 characters")
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), {
    message: "Include upper-case, lower-case letters and a number",
  });

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase().max(200),
  password: passwordField,
  role: z.enum(ROLES),
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(ROLES),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
