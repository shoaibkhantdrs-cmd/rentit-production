/**
 * Phase 6 Part 4 (observability): abstraction over "where do uncaught
 * exceptions and 5xx errors get reported so a human notices them",
 * following this codebase's established pattern (IEmailService,
 * IPushNotificationService, IHealthCheckService) of hiding a specific
 * vendor behind an interface the use-case/middleware layer depends on.
 *
 * Two implementations: NoOpErrorTracker (default, dev/test -- errors still
 * go to the structured logger via pino, just not to an external service)
 * and SentryErrorTracker (production, when SENTRY_DSN is set).
 */
export interface ErrorTrackerContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  extra?: Record<string, unknown>;
}

export interface IErrorTracker {
  captureException(error: Error, context?: ErrorTrackerContext): void;
}
