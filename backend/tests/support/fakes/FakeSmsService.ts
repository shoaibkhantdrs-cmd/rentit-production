import { ISmsService } from "@/domain/services/ISmsService";

export class FakeSmsService implements ISmsService {
  public readonly sent: Array<{ to: string; body: string }> = [];

  async send(to: string, body: string): Promise<void> {
    this.sent.push({ to, body });
  }
}
