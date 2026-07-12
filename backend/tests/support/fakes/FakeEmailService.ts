import { EmailMessage, IEmailService } from "@/domain/services/IEmailService";

export class FakeEmailService implements IEmailService {
  public readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
