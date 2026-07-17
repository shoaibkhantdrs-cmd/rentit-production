import { RequestHandler, Router } from "express";
import { AuthController } from "@/interfaces/http/controllers/AuthController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { env } from "@/config/env";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/interfaces/http/validators/auth.schemas";

export function createAuthRouter(
  controller: AuthController,
  authenticate: RequestHandler,
  authRateLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/register",
    authRateLimiter,
    validate(registerSchema),
    asyncHandler(controller.register),
  );

  router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(controller.login));

  router.post(
    "/verify-otp",
    authRateLimiter,
    validate(verifyOtpSchema),
    asyncHandler(controller.verifyOtpHandler),
  );

  router.post("/refresh", validate(refreshSchema), asyncHandler(controller.refresh));

  router.post("/logout", validate(logoutSchema), asyncHandler(controller.logout));

  router.post("/logout-all", authenticate, asyncHandler(controller.logoutAll));

  router.post(
    "/forgot-password",
    authRateLimiter,
    validate(forgotPasswordSchema),
    asyncHandler(controller.forgotPasswordHandler),
  );

  router.post(
    "/reset-password",
    authRateLimiter,
    validate(resetPasswordSchema),
    asyncHandler(controller.resetPasswordHandler),
  );

  // Dev-only, no-OTP, no-email auto-login. This route is only registered
  // at all when NODE_ENV=development -- in every other environment
  // (including production and test) it simply does not exist, so it falls
  // through to the normal 404 handler rather than being reachable and
  // relying solely on a runtime check. See container.ts / AuthController
  // for the other two independent layers of the same guard.
  if (env.nodeEnv === "development") {
    router.post("/dev-login", asyncHandler(controller.devLogin));
  }

  return router;
}
