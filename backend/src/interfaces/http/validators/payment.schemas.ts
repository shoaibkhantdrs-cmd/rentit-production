import { z } from "zod";

const gatewayEnum = z.enum(["razorpay", "stripe"]);
const boostTypeEnum = z.enum(["featured", "boost"]);

export const createListingBoostOrderSchema = z.object({
  propertyId: z.string().uuid(),
  boostType: boostTypeEnum,
  gateway: gatewayEnum,
});

export const createPremiumPlanOrderSchema = z.object({
  planId: z.string().uuid(),
  gateway: gatewayEnum,
});

export const paymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const invoiceIdParamSchema = z.object({ id: z.string().uuid() });

export const paymentIdParamSchema = z.object({ id: z.string().uuid() });

export const adminRefundPaymentSchema = z.object({
  amount: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});
