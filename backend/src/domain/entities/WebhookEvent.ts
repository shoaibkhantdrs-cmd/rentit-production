import { PaymentGateway } from "@/domain/entities/PaymentOrder";

export interface WebhookEvent {
  id: string;
  gateway: PaymentGateway;
  eventId: string;
  eventType: string;
  payload: unknown;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}
