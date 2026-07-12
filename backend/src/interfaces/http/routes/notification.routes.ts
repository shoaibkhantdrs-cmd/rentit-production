import { RequestHandler, Router } from "express";
import { NotificationController } from "@/interfaces/http/controllers/NotificationController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import {
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
} from "@/interfaces/http/validators/notification.schemas";

export function createNotificationRouter(
  controller: NotificationController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get("/", validate(listNotificationsQuerySchema, "query"), asyncHandler(controller.list));
  router.patch(
    "/read",
    validate(markNotificationsReadSchema),
    asyncHandler(controller.markRead),
  );

  router.post(
    "/device-token",
    validate(registerPushTokenSchema),
    asyncHandler(controller.registerDeviceToken),
  );
  router.get("/preferences", asyncHandler(controller.getPreferences));
  router.patch(
    "/preferences",
    validate(updateNotificationPreferencesSchema),
    asyncHandler(controller.updatePreferences),
  );

  return router;
}
