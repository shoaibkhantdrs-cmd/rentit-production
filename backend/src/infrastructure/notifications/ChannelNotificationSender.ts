import { INotificationSender, SendNotificationInput } from "@/domain/services/INotificationSender";
import { IEmailService } from "@/domain/services/IEmailService";
import { ISmsService } from "@/domain/services/ISmsService";

function toHtml(body: string): string {
  return `<p>${body.replace(/\n/g, "<br />")}</p>`;
}

/**
 * Phase 5 Part 3 completes what ConsoleNotificationSender (Phase 2) left
 * as a single logging stub: this implements the same INotificationSender
 * port used since Phase 2 (OtpIssuer, password reset, ...), but now by
 * actually dispatching through the real IEmailService/ISmsService
 * providers -- so nothing built against INotificationSender since Phase 2
 * has to change to benefit from real SMTP/SMS delivery.
 */
export class ChannelNotificationSender implements INotificationSender {
  constructor(
    private readonly emailService: IEmailService,
    private readonly smsService: ISmsService,
  ) {}

  async send(input: SendNotificationInput): Promise<void> {
    if (input.channel === "email") {
      await this.emailService.send({
        to: input.to,
        subject: input.subject ?? "Notification from RentIt",
        html: toHtml(input.body),
        text: input.body,
      });
      return;
    }

    await this.smsService.send(input.to, input.body);
  }
}
