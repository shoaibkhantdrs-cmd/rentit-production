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
import { createErrorHandler } from "@/interfaces/http/middleware/errorHandler";
import { compression } from "@/interfaces/http/middleware/compression";
import { metricsMiddleware } from "@/infrastructure/observability/metrics";
import { metricsRouter } from "@/interfaces/http/routes/metrics.routes";
import { tempSeedTriggerRouter } from "@/interfaces/http/routes/tempSeedTrigger.routes";

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
  // Root cause (confirmed with live browser evidence -- frontend on
  // :5177, backend only allowlisting 5173/5174, browser console showing
  // the CORS block directly): the static env.corsOrigin allowlist only
  // ever covered 5173/5174, and Vite has no upper bound on which port it
  // falls forward to when lower ones are already taken. These are plain
  // unauthenticated GETs with no custom headers, so the browser doesn't
  // even send a CORS preflight -- it sends the real request straight
  // through, the server actually receives and answers it (which is why
  // curl/Postman/the Network tab all correctly show a real 200), but the
  // response has no matching Access-Control-Allow-Origin for :5177, so
  // the browser blocks the page's JS from reading that response and
  // fetch() rejects. Production is completely unaffected: this branches
  // on env.isProduction, and production keeps using the exact same
  // static env.corsOrigin array as before, sourced from the real
  // CORS_ORIGIN env var. Development only additionally accepts any
  // http(s)://localhost:<port> or 127.0.0.1:<port> origin, so this never
  // goes stale again the next time a lower port is busy.
  app.use(
    cors({
      origin: env.isProduction
        ? env.corsOrigin
        : (origin, callback) => {
            // No Origin header -- same-origin requests, curl, Postman,
            // server-to-server calls, mobile apps. Never subject to a
            // browser CORS check in the first place, so always allow.
            if (!origin) return callback(null, true);

            const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (isLocalDevOrigin || env.corsOrigin.includes(origin)) {
              return callback(null, true);
            }

            callback(new Error(`Not allowed by CORS: ${origin}`));
          },
    }),
  );
  // Phase 6 Part 3 (performance): compress every JSON response above a
  // small size threshold. Placed before the body parser since it only
  // wraps the outgoing response, not the incoming request.
  app.use(compression());
  app.use(
    express.json({
      limit: "1mb",
      // Phase 6 Part 1 (Payments): capture the exact raw bytes of every
      // request body alongside the parsed one. Razorpay/Stripe webhook
      // signature verification MUST run against these original bytes --
      // re-serializing req.body (different key order, whitespace, unicode
      // escaping) produces a byte-different string that fails a
      // signature the gateway computed against what it actually sent.
      // Cheap to do for every request (one extra Buffer per request,
      // already-parsed by helmet/cors first) rather than only for the
      // two webhook routes, which would need a second, differently
      // configured body parser mounted ahead of this one.
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
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
  // Phase 6 Part 4 (observability): wraps every request to record
  // RED-method metrics (rate, errors, duration). Mounted globally, ahead
  // of the router, so it also sees 404s and mid-route errors, not just
  // successful matches.
  app.use(metricsMiddleware());

  const container = buildContainer();

  // Not nested under createApiRouter()'s /health, /payments, etc. --
  // deliberately its own top-level, unauthenticated (token-gated instead)
  // route so a Prometheus scrape config can point at one fixed path
  // regardless of how the rest of the API is versioned/restructured.
  app.use("/metrics", metricsRouter);
  // TEMPORARY -- see tempSeedTrigger.routes.ts doc comment. Remove this
  // line and delete that file once the one-time production seed run is
  // confirmed successful.
  app.use("/internal/seed-properties-once", tempSeedTriggerRouter);
app.get("/", (_req, res) => {
  res.json({
    service: "RentIt Backend",
    status: "OK",
    version: "1.0",
    timestamp: new Date().toISOString(),
  });
});
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
      paymentController: container.paymentController,
      webhookController: container.webhookController,
      adminUserController: container.adminUserController,
      adminPropertyController: container.adminPropertyController,
      adminReportController: container.adminReportController,
      adminVerificationController: container.adminVerificationController,
      adminNotificationController: container.adminNotificationController,
      adminDashboardController: container.adminDashboardController,
      adminAuditController: container.adminAuditController,
      adminPaymentController: container.adminPaymentController,
      authenticate: container.authenticate,
      optionalAuthenticate: container.optionalAuthenticate,
      authRateLimiter: container.authRateLimiter,
      messagingRateLimiter: container.messagingRateLimiter,
      webhookRateLimiter: container.webhookRateLimiter,
      paymentOrderRateLimiter: container.paymentOrderRateLimiter,
    }),
  );

  app.use(notFound);
  app.use(createErrorHandler(container.errorTracker));

  return { app, container };
}
