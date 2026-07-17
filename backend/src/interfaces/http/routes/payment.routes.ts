import { RequestHandler, Router } from "express";
import { PaymentController } from "@/interfaces/http/controllers/PaymentController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { cacheControl } from "@/interfaces/http/middleware/cacheControl";
import {
  createListingBoostOrderSchema,
  createPremiumPlanOrderSchema,
  paymentHistoryQuerySchema,
  invoiceIdParamSchema,
} from "@/interfaces/http/validators/payment.schemas";

export function createPaymentRouter(
  controller: PaymentController,
  authenticate: RequestHandler,
  paymentOrderRateLimiter: RequestHandler,
): Router {
  const router = Router();

  // Public: prices and gateway public keys must be visible before signup/login.
  // Cached for a few minutes -- this data only changes on a deploy/admin action.
  router.get("/config", cacheControl(300), asyncHandler(controller.config));
  router.get("/plans", cacheControl(60), asyncHandler(controller.plans));

  router.post(
    "/listing-boosts",
    authenticate,
    paymentOrderRateLimiter,
    validate(createListingBoostOrderSchema),
    asyncHandler(controller.createBoostOrder),
  );

  router.post(
    "/subscriptions",
    authenticate,
    paymentOrderRateLimiter,
    validate(createPremiumPlanOrderSchema),
    asyncHandler(controller.createPlanOrder),
  );

  router.get(
    "/history",
    authenticate,
    validate(paymentHistoryQuerySchema, "query"),
    asyncHandler(controller.history),
  );

  router.get(
    "/invoices",
    authenticate,
    validate(paymentHistoryQuerySchema, "query"),
    asyncHandler(controller.invoices),
  );

  router.get(
    "/invoices/:id",
    authenticate,
    validate(invoiceIdParamSchema, "params"),
    asyncHandler(controller.getInvoiceById),
  );

  return router;
}
