import type { ErrorTrackerContext, IErrorTracker } from "@/domain/services/IErrorTracker";
import type { Logger } from "pino";

/**
 * Default error tracker when no SENTRY_DSN is configured (dev/test, or a
 * production deploy that hasn't set one up yet). Never silently drops an
 * error -- routes it through the same structured logger everything else
 * uses, tagged so it's greppable, rather than doing nothing.
 */
export class NoOpErrorTracker implements IErrorTracker {
  constructor(private readonly logger: Logger) {}

  captureException(error: Error, context?: ErrorTrackerContext): void {
    this.logger.error(
      { err: error, errorTracker: "noop", ...context },
      "Unhandled exception (no external error tracker configured)",
    );
  }
}
