import { PaymentGateway } from "@/domain/entities/PaymentOrder";
import { WebhookEvent } from "@/domain/entities/WebhookEvent";

export interface NewWebhookEventInput {
  gateway: PaymentGateway;
  eventId: string;
  eventType: string;
  payload: unknown;
}

export interface IWebhookEventRepository {
  /** Returns null if (gateway, eventId) already exists -- caller must treat that as a no-op replay. */
  createIfNew(input: NewWebhookEventInput): Promise<WebhookEvent | null>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
