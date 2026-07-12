import { IWhatsAppService, WhatsAppTemplateMessage } from "@/domain/services/IWhatsAppService";

export class FakeWhatsAppService implements IWhatsAppService {
  public readonly sent: WhatsAppTemplateMessage[] = [];

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<void> {
    this.sent.push(message);
  }
}
