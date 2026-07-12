import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/infrastructure/logging/logger";
import { buildContainer, Container } from "@/container";
import { createApiRouter } from "@/interfaces/http/routes";
import { requestId } from "@/interfaces/http/middleware/requestId";
import { deviceContext } from "@/interfaces/http/middleware/deviceContext";
import { sanitizeBody } from "@/interfaces/http/middleware/sanitize";
import { notFound } from "@/interfaces/http/middleware/notFound";
import { errorHandler } from "@/interfaces/http/middleware/errorHandler";

/**
 * Returns the container alongside the Express app (rather than just the
 * app, as before Phase 5) so server.ts can attach the WebSocket gateway
 * (Part 1) to the actual http.Server once app.listen() creates one --
 * createApp() itself never sees that server, only the Express app that
 * wraps it.
 */
export function createApp(): { app: express.Express; container: Container } {
  const app = express();

  // Trust the first proxy hop (load balancer/reverse proxy) so req.ip and
  // X-Forwarded-For are honored -- needed for correct rate-limit keys and
  // audit log IPs once this runs behind anything other than localhost.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );
  app.use(deviceContext);
  app.use(sanitizeBody);

  const container = buildContainer();

  app.use(
    "/",
    createApiRouter({
      authController: container.authController,
      userController: container.userController,
      notificationController: container.notificationController,
      propertyController: container.propertyController,
      verificationController: container.verificationController,
      chatController: container.chatController,
      whatsAppController: container.whatsAppController,
      savedSearchController: container.savedSearchController,
      adminUserController: container.adminUserController,
      adminPropertyController: container.adminPropertyController,
      adminReportController: container.adminReportController,
      adminVerificationController: container.adminVerificationController,
      adminNotificationController: container.adminNotificationController,
      adminDashboardController: container.adminDashboardController,
      adminAuditController: container.adminAuditController,
      authenticate: container.authenticate,
      optionalAuthenticate: container.optionalAuthenticate,
      authRateLimiter: container.authRateLimiter,
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return { app, container };
}
