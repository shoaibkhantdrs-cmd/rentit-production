import { RequestHandler, Router } from "express";
import { VerificationController } from "@/interfaces/http/controllers/VerificationController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { uploadSingleImage } from "@/interfaces/http/middleware/imageUpload";
import { submitVerificationSchema } from "@/interfaces/http/validators/admin.schemas";

/** Self-service Owner Verification (Phase 4 Part 5). Admin review lives
 * under /admin/verification instead (see admin.routes.ts). */
export function createVerificationRouter(
  controller: VerificationController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    "/",
    uploadSingleImage("document"),
    validate(submitVerificationSchema),
    asyncHandler(controller.submit),
  );
  router.get("/status", asyncHandler(controller.status));

  return router;
}
