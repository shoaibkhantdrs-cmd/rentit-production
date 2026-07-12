import { RequestHandler, Router } from "express";
import { WhatsAppController } from "@/interfaces/http/controllers/WhatsAppController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import {
  contactOwnerSchema,
  sharePropertySchema,
  sendInquirySchema,
} from "@/interfaces/http/validators/whatsapp.schemas";

export function createWhatsAppRouter(controller: WhatsAppController, authenticate: RequestHandler): Router {
  const router = Router();

  router.post("/contact-owner", authenticate, validate(contactOwnerSchema), asyncHandler(controller.contact));
  router.post("/inquiry", authenticate, validate(sendInquirySchema), asyncHandler(controller.inquiry));
  // Sharing a listing doesn't require being signed in -- a logged-out
  // visitor can still forward a link to a friend.
  router.post("/share", validate(sharePropertySchema), asyncHandler(controller.share));

  return router;
}
