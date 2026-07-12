import { RequestHandler, Router } from "express";
import { AuthController } from "@/interfaces/http/controllers/AuthController";
import { UserController } from "@/interfaces/http/controllers/UserController";
import { NotificationController } from "@/interfaces/http/controllers/NotificationController";
import { PropertyController } from "@/interfaces/http/controllers/PropertyController";
import { VerificationController } from "@/interfaces/http/controllers/VerificationController";
import { ChatController } from "@/interfaces/http/controllers/ChatController";
import { WhatsAppController } from "@/interfaces/http/controllers/WhatsAppController";
import { SavedSearchController } from "@/interfaces/http/controllers/SavedSearchController";
import { createAuthRouter } from "@/interfaces/http/routes/auth.routes";
import { createUserRouter } from "@/interfaces/http/routes/user.routes";
import { createNotificationRouter } from "@/interfaces/http/routes/notification.routes";
import { createPropertyRouter } from "@/interfaces/http/routes/property.routes";
import { createVerificationRouter } from "@/interfaces/http/routes/verification.routes";
import { createChatRouter } from "@/interfaces/http/routes/chat.routes";
import { createWhatsAppRouter } from "@/interfaces/http/routes/whatsapp.routes";
import { createSavedSearchRouter } from "@/interfaces/http/routes/savedsearch.routes";
import { createAdminRouter, AdminRouterDeps } from "@/interfaces/http/routes/admin.routes";
import { healthRouter } from "@/routes/health.routes";

export interface ApiRouterDeps extends AdminRouterDeps {
  authController: AuthController;
  userController: UserController;
  notificationController: NotificationController;
  propertyController: PropertyController;
  verificationController: VerificationController;
  chatController: ChatController;
  whatsAppController: WhatsAppController;
  savedSearchController: SavedSearchController;
  authenticate: RequestHandler;
  optionalAuthenticate: RequestHandler;
  authRateLimiter: RequestHandler;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const router = Router();

  router.use("/health", healthRouter);
  router.use("/auth", createAuthRouter(deps.authController, deps.authenticate, deps.authRateLimiter));
  router.use("/users", createUserRouter(deps.userController, deps.authenticate));
  router.use(
    "/notifications",
    createNotificationRouter(deps.notificationController, deps.authenticate),
  );
  router.use(
    "/properties",
    createPropertyRouter(deps.propertyController, deps.authenticate, deps.optionalAuthenticate),
  );
  router.use(
    "/verification",
    createVerificationRouter(deps.verificationController, deps.authenticate),
  );
  router.use("/chat", createChatRouter(deps.chatController, deps.authenticate));
  router.use("/whatsapp", createWhatsAppRouter(deps.whatsAppController, deps.authenticate));
  router.use("/saved-searches", createSavedSearchRouter(deps.savedSearchController, deps.authenticate));
  router.use("/admin", createAdminRouter(deps, deps.authenticate));

  return router;
}
