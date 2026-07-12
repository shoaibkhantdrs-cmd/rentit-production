import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, "Phone must be a valid E.164-ish number, e.g. +14155552671");

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Must be a valid email address"),
  phone: phoneSchema.optional(),
  password: passwordSchema.optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, "Provide an email or phone number"),
  password: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().min(3, "Provide an email or phone number"),
  purpose: z.enum(["login", "email_verification", "phone_verification"]),
  code: z.string().regex(/^\d{4,8}$/, "Code must be 4-8 digits"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, "refreshToken is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20, "refreshToken is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Must be a valid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  code: z.string().regex(/^\d{4,8}$/, "Code must be 4-8 digits"),
  newPassword: passwordSchema,
});
