import { RequestHandler, Router } from "express";
import { UserController } from "@/interfaces/http/controllers/UserController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { updateMeSchema } from "@/interfaces/http/validators/user.schemas";
import { idParamSchema, reportUserSchema } from "@/interfaces/http/validators/admin.schemas";

export function createUserRouter(controller: UserController, authenticate: RequestHandler): Router {
  const router = Router();

  router.use(authenticate);

  router.get("/me", asyncHandler(controller.getMeHandler));
  router.patch("/me", validate(updateMeSchema), asyncHandler(controller.updateMeHandler));
  router.delete("/me", asyncHandler(controller.deleteMeHandler));

  // Self-service "report a user" (Phase 4 Part 4) -- any authenticated user.
  router.post(
    "/:id/report",
    validate(idParamSchema, "params"),
    validate(reportUserSchema),
    asyncHandler(controller.report),
  );

  return router;
}
