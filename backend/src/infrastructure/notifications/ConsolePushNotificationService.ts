import {
  IPushNotificationService,
  PushNotificationPayload,
} from "@/domain/services/IPushNotificationService";
import { logger } from "@/infrastructure/logging/logger";

/**
 * Console transport for push notifications -- same honest-stub pattern as
 * ConsoleNotificationSender (Phase 2's email/SMS transport): it's a real,
 * working implementation of IPushNotificationService, it just logs instead
 * of calling a real FCM/APNs provider. Device-token registration doesn't
 * exist yet, so a real provider integration is out of scope here.
 *
 * To go to production, add a FcmPushNotificationService /
 * ApnsPushNotificationService implementing the same interface and swap the
 * binding in container.ts -- no use-case changes required.
 */
export class ConsolePushNotificationService implements IPushNotificationService {
  async send(payload: PushNotificationPayload): Promise<void> {
    logger.info(
      { userId: payload.userId, data: payload.data },
      `[dev-push] ${payload.title}: ${payload.body}`,
    );
  }

  async sendBulk(payloads: PushNotificationPayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.send(payload);
    }
  }
}
