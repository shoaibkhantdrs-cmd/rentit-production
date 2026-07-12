import { INotificationSender, SendNotificationInput } from "@/domain/services/INotificationSender";

export class FakeNotificationSender implements INotificationSender {
  public readonly sent: SendNotificationInput[] = [];

  async send(input: SendNotificationInput): Promise<void> {
    this.sent.push(input);
  }
}
