import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, "Phone must be a valid E.164-ish number, e.g. +14155552671");

export const updateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: phoneSchema.nullable().optional(),
  preferences: z
    .object({
      language: z.string().min(2).max(10).optional(),
      timezone: z.string().min(1).max(64).optional(),
      notifyEmail: z.boolean().optional(),
      notifySms: z.boolean().optional(),
      notifyPush: z.boolean().optional(),
    })
    .optional(),
});
