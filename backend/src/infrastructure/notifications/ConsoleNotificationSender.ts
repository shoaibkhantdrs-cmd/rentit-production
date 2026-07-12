import { INotificationSender, SendNotificationInput } from "@/domain/services/INotificationSender";
import { logger } from "@/infrastructure/logging/logger";

/**
 * Development/test transport: logs what would have been sent instead of
 * calling a real email/SMS provider. This is a real, working
 * implementation of INotificationSender (not a mock) -- it's the
 * "console transport" pattern used by e.g. Rails' letter_opener or
 * NestJS's console mailer.
 *
 * To go to production, add SesNotificationSender / TwilioSmsSender
 * implementing the same interface and swap the binding in
 * infrastructure/container.ts -- no use-case changes required
 * (Open/Closed principle).
 */
export class ConsoleNotificationSender implements INotificationSender {
  async send(input: SendNotificationInput): Promise<void> {
    logger.info(
      {
        channel: input.channel,
        to: input.to,
        subject: input.subject,
      },
      `[dev-notification] ${input.body}`,
    );
  }
}
