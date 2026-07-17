import { RequestHandler, Router } from "express";
import { WhatsAppController } from "@/interfaces/http/controllers/WhatsAppController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import {
  contactOwnerSchema,
  sharePropertySchema,
  sendInquirySchema,
} from "@/interfaces/http/validators/whatsapp.schemas";

export function createWhatsAppRouter(
  controller: WhatsAppController,
  authenticate: RequestHandler,
  messagingRateLimiter: RequestHandler,
): Router {
  const router = Router();

  // Audit fix: none of these were rate-limited before. /share in
  // particular is unauthenticated, so without a limiter it was a fully
  // open endpoint for spamming arbitrary phone numbers via WhatsApp.
  router.post(
    "/contact-owner",
    authenticate,
    messagingRateLimiter,
    validate(contactOwnerSchema),
    asyncHandler(controller.contact),
  );
  router.post(
    "/inquiry",
    authenticate,
    messagingRateLimiter,
    validate(sendInquirySchema),
    asyncHandler(controller.inquiry),
  );
  // Sharing a listing doesn't require being signed in -- a logged-out
  // visitor can still forward a link to a friend -- but it's still rate
  // limited per-IP so it can't be scripted into a spam vector.
  router.post(
    "/share",
    messagingRateLimiter,
    validate(sharePropertySchema),
    asyncHandler(controller.share),
  );

  return router;
}
