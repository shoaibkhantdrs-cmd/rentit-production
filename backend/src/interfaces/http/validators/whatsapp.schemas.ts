import { z } from "zod";

const e164Phone = z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be an E.164 phone number, e.g. +14155551234");

export const contactOwnerSchema = z.object({
  propertyId: z.string().uuid(),
});

export const sharePropertySchema = z.object({
  propertyId: z.string().uuid(),
  toPhone: e164Phone,
});

export const sendInquirySchema = z.object({
  propertyId: z.string().uuid(),
  message: z.string().min(1).max(300),
});
