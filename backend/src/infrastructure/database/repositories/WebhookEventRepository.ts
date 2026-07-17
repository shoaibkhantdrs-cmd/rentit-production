import { Pool } from "pg";
import {
  IWebhookEventRepository,
  NewWebhookEventInput,
} from "@/domain/repositories/IWebhookEventRepository";
import { WebhookEvent } from "@/domain/entities/WebhookEvent";
import { PaymentGateway } from "@/domain/entities/PaymentOrder";

interface WebhookEventRow {
  id: string;
  gateway: PaymentGateway;
  event_id: string;
  event_type: string;
  payload: unknown;
  processed_at: Date | null;
  error: string | null;
  created_at: Date;
}

function toEntity(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    gateway: row.gateway,
    eventId: row.event_id,
    eventType: row.event_type,
    payload: row.payload,
    processedAt: row.processed_at,
    error: row.error,
    createdAt: row.created_at,
  };
}

export class WebhookEventRepository implements IWebhookEventRepository {
  constructor(private readonly pool: Pool) {}

  async createIfNew(input: NewWebhookEventInput): Promise<WebhookEvent | null> {
    // ON CONFLICT DO NOTHING + checking rowCount is the idempotency
    // mechanism: a redelivered webhook (same gateway + event_id) inserts
    // zero rows, and the caller treats a null return as "already handled,
    // ack and stop" rather than re-crediting a payment.
    const result = await this.pool.query<WebhookEventRow>(
      `INSERT INTO webhook_events (gateway, event_id, event_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (gateway, event_id) DO NOTHING
       RETURNING *`,
      [input.gateway, input.eventId, input.eventType, JSON.stringify(input.payload)],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async markProcessed(id: string): Promise<void> {
    await this.pool.query("UPDATE webhook_events SET processed_at = now(), error = NULL WHERE id = $1", [
      id,
    ]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.pool.query("UPDATE webhook_events SET error = $2 WHERE id = $1", [id, error]);
  }
}
