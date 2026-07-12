import { EmailMessage, IEmailService } from "@/domain/services/IEmailService";
import { SmtpClient, SmtpConfig } from "./SmtpClient";

export interface SmtpEmailServiceConfig extends SmtpConfig {
  fromAddress: string;
}

export class SmtpEmailService implements IEmailService {
  private readonly client: SmtpClient;

  constructor(private readonly config: SmtpEmailServiceConfig) {
    this.client = new SmtpClient(config);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.client.send({
      from: this.config.fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
