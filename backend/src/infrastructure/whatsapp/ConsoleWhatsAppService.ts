import { IWhatsAppService, WhatsAppTemplateMessage } from "@/domain/services/IWhatsAppService";
import { logger } from "@/infrastructure/logging/logger";

export class ConsoleWhatsAppService implements IWhatsAppService {
  async sendTemplate(message: WhatsAppTemplateMessage): Promise<void> {
    logger.info(
      { to: message.to, template: message.template },
      `[dev-whatsapp] ${message.template}(${message.params.join(", ")})`,
    );
  }
}
