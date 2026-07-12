import { RequestHandler, Router } from "express";
import { SavedSearchController } from "@/interfaces/http/controllers/SavedSearchController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import {
  createSavedSearchSchema,
  updateSavedSearchSchema,
  savedSearchIdParamSchema,
} from "@/interfaces/http/validators/savedsearch.schemas";

export function createSavedSearchRouter(
  controller: SavedSearchController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", asyncHandler(controller.list));
  router.post("/", validate(createSavedSearchSchema), asyncHandler(controller.create));
  router.patch(
    "/:id",
    validate(savedSearchIdParamSchema, "params"),
    validate(updateSavedSearchSchema),
    asyncHandler(controller.update),
  );
  router.delete("/:id", validate(savedSearchIdParamSchema, "params"), asyncHandler(controller.remove));

  return router;
}
