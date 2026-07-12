import { createHash } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { DevicePlatform } from "@/domain/entities/UserDevice";

const ALLOWED_PLATFORMS: DevicePlatform[] = ["web", "ios", "android", "unknown"];

/**
 * Resolves a stable device identity for the request. Native/mobile clients
 * are expected to generate and persist an `X-Device-Id` header themselves
 * (a UUID stored on-device). Browser clients that don't send one yet fall
 * back to a hash of IP + User-Agent -- a weak but non-empty identity so
 * session/device tracking still functions; replacing this with real
 * client-side fingerprinting is a Phase 3+ improvement (see docs/phase-2.md).
 */
export function deviceContext(req: Request, _res: Response, next: NextFunction): void {
  const userAgent = req.header("user-agent") ?? null;
  const ipAddress = req.ip ?? null;

  const headerDeviceId = req.header("x-device-id");
  const deviceId =
    headerDeviceId && headerDeviceId.length > 0
      ? headerDeviceId
      : createHash("sha256")
          .update(`${ipAddress ?? "unknown-ip"}:${userAgent ?? "unknown-ua"}`)
          .digest("hex")
          .slice(0, 32);

  const rawPlatform = req.header("x-device-platform") as DevicePlatform | undefined;
  const platform = rawPlatform && ALLOWED_PLATFORMS.includes(rawPlatform) ? rawPlatform : "unknown";

  req.deviceContext = { deviceId, platform, userAgent, ipAddress };
  next();
}
