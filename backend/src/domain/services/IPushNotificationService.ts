export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Phase 4 Part 6 explicitly asks for a "Push Notification Service
 * Interface" -- a port, not a full FCM/APNs integration (Payments and
 * Chat are the only features explicitly deferred, but a real push
 * provider needs device-token registration, which doesn't exist yet and
 * is out of scope here). ConsolePushNotificationService (infrastructure)
 * implements this by logging, exactly the same honest-stub pattern as
 * Phase 2's ConsoleNotificationSender for email/SMS.
 */
export interface IPushNotificationService {
  send(payload: PushNotificationPayload): Promise<void>;
  sendBulk(payloads: PushNotificationPayload[]): Promise<void>;
}
