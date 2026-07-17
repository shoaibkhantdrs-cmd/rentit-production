import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "@/config/env";
import { renderMetrics } from "@/infrastructure/observability/metrics";

export const metricsRouter = Router();

/**
 * Phase 6 Part 4 (observability): Prometheus scrape endpoint. Guarded by
 * a shared bearer token (METRICS_TOKEN) rather than left open -- request
 * rate and latency by route is internal operational data, not something
 * to expose on the public internet unauthenticated. Prometheus's
 * `bearer_token`/`bearer_token_file` scrape_config options consume this
 * natively, no custom exporter needed on the Prometheus side.
 *
 * If METRICS_TOKEN is unset (e.g. local dev), the endpoint stays open --
 * matches this codebase's existing "safe default, explicit opt-in for
 * the stricter production behavior" pattern (see JWT_ACCESS_SECRET
 * requiring a real value only when NODE_ENV=production).
 */
metricsRouter.get("/", (req, res) => {
  if (env.metricsToken) {
    // timingSafeEqual, not `!==` -- found during the Part 9 QA pass. A
    // plain string comparison leaks how many leading characters matched
    // via response timing, the same class of issue this codebase already
    // guards against everywhere else a secret is compared (JWT signature
    // verification, Razorpay/Stripe webhook signatures). Length-check
    // first since timingSafeEqual throws (rather than returning false) on
    // mismatched buffer lengths.
    const header = Buffer.from(req.header("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${env.metricsToken}`);
    if (header.length !== expected.length || !timingSafeEqual(header, expected)) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing metrics token" } });
      return;
    }
  }

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(renderMetrics());
});
