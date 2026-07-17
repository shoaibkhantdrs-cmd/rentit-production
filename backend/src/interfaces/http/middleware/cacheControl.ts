import { NextFunction, Request, Response } from "express";

/**
 * Sets a public Cache-Control header for reference-ish data that's safe
 * for a CDN/browser to serve stale for a short window (pricing/plan
 * lists, category lists) -- Phase 6 Part 3 (performance). Never applied
 * to anything user-specific or containing an Authorization-dependent
 * response, since a shared/CDN cache doesn't know about per-user auth.
 */
export function cacheControl(maxAgeSeconds: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Cache-Control", `public, max-age=${maxAgeSeconds}`);
    next();
  };
}
