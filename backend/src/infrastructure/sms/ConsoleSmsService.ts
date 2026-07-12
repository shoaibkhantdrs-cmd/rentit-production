import { ISmsService } from "@/domain/services/ISmsService";
import { logger } from "@/infrastructure/logging/logger";

export class ConsoleSmsService implements ISmsService {
  async send(to: string, body: string): Promise<void> {
    logger.info({ to }, `[dev-sms] ${body}`);
  }
}
