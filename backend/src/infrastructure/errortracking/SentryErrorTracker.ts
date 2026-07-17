import { randomUUID } from "node:crypto";
import type { ErrorTrackerContext, IErrorTracker } from "@/domain/services/IErrorTracker";
import type { Logger } from "pino";

/**
 * Fetch-based Sentry client using Sentry's plain HTTP "Store" endpoint
 * (`POST /api/<project_id>/store/`) rather than the `@sentry/node` SDK --
 * consistent with this codebase's existing pattern of hand-rolling a
 * vendor's HTTP API directly (WhatsApp Cloud API, Razorpay/Stripe, Twilio)
 * instead of adding a heavyweight SDK dependency for what's fundamentally
 * one POST request. The SDK does far more (breadcrumbs, session tracking,
 * source maps); this covers exactly what Part 4 asks for: report
 * unhandled exceptions somewhere a human will see them.
 *
 * Fire-and-forget by design: a broken Sentry integration must never make
 * the app slower or less available than having no error tracking at all.
 * Network failures are swallowed and logged locally instead of thrown.
 */
export class SentryErrorTracker implements IErrorTracker {
  private readonly endpoint: string;
  private readonly authHeader: string;

  constructor(
    dsn: string,
    private readonly logger: Logger,
    private readonly environment: string,
    private readonly release?: string,
  ) {
    const parsed = SentryErrorTracker.parseDsn(dsn);
    this.endpoint = `https://${parsed.host}/api/${parsed.projectId}/store/`;
    this.authHeader = [
      "Sentry sentry_version=7",
      "sentry_client=rentit-backend/1.0",
      `sentry_timestamp=${Math.floor(Date.now() / 1000)}`,
      `sentry_key=${parsed.publicKey}`,
    ].join(", ");
  }

  /** DSN shape: https://<publicKey>@<host>/<projectId> */
  private static parseDsn(dsn: string): { publicKey: string; host: string; projectId: string } {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !url.host || !projectId) {
      throw new Error("Invalid SENTRY_DSN: expected https://<publicKey>@<host>/<projectId>");
    }
    return { publicKey: url.username, host: url.host, projectId };
  }

  captureException(error: Error, context?: ErrorTrackerContext): void {
    const payload = {
      event_id: randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      environment: this.environment,
      release: this.release,
      level: "error",
      exception: {
        values: [
          {
            type: error.name || "Error",
            value: error.message,
            stacktrace: error.stack
              ? { frames: error.stack.split("\n").slice(1).map((line) => ({ filename: line.trim() })) }
              : undefined,
          },
        ],
      },
      tags: {
        requestId: context?.requestId,
        route: context?.route,
        method: context?.method,
        statusCode: context?.statusCode,
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.extra,
    };

    // Deliberately not awaited by callers (errorHandler fires this and
    // moves on) -- but we still attach a catch here so a rejected fetch
    // never becomes an unhandled promise rejection.
    fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": this.authHeader,
      },
      body: JSON.stringify(payload),
    }).catch((sendError) => {
      this.logger.warn(
        { err: sendError, originalError: error.message },
        "Failed to send exception to Sentry",
      );
    });
  }
}
