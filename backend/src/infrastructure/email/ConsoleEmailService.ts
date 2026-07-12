import { EmailMessage, IEmailService } from "@/domain/services/IEmailService";
import { logger } from "@/infrastructure/logging/logger";

/** Same honest-stub pattern as ConsoleNotificationSender/
 * ConsolePushNotificationService: a real, working IEmailService that logs
 * instead of dialing an SMTP server. Bound by container.ts when SMTP_HOST
 * isn't configured, so local development and this sandbox never need a
 * real mail server to exercise every email-sending code path. */
export class ConsoleEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, `[dev-email] ${message.text}`);
  }
}
