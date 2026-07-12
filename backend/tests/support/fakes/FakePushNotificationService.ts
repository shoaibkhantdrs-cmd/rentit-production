import {
  IPushNotificationService,
  PushNotificationPayload,
} from "@/domain/services/IPushNotificationService";

export class FakePushNotificationService implements IPushNotificationService {
  public readonly sent: PushNotificationPayload[] = [];

  async send(payload: PushNotificationPayload): Promise<void> {
    this.sent.push(payload);
  }

  async sendBulk(payloads: PushNotificationPayload[]): Promise<void> {
    this.sent.push(...payloads);
  }
}
