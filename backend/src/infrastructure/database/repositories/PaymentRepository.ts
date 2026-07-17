import { Pool } from "pg";
import { IPaymentRepository, NewPaymentInput } from "@/domain/repositories/IPaymentRepository";
import { Payment, PaymentStatus } from "@/domain/entities/Payment";
import { PaymentGateway } from "@/domain/entities/PaymentOrder";

interface PaymentRow {
  id: string;
  payment_order_id: string;
  gateway: PaymentGateway;
  gateway_payment_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  raw_event: unknown;
  created_at: Date;
}

function toEntity(row: PaymentRow): Payment {
  return {
    id: row.id,
    paymentOrderId: row.payment_order_id,
    gateway: row.gateway,
    gatewayPaymentId: row.gateway_payment_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    method: row.method,
    rawEvent: row.raw_event,
    createdAt: row.created_at,
  };
}

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewPaymentInput): Promise<Payment> {
    const result = await this.pool.query<PaymentRow>(
      `INSERT INTO payments
         (payment_order_id, gateway, gateway_payment_id, amount, currency, status, method, raw_event)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.paymentOrderId,
        input.gateway,
        input.gatewayPaymentId,
        input.amount,
        input.currency,
        input.status,
        input.method,
        JSON.stringify(input.rawEvent ?? null),
      ],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>("SELECT * FROM payments WHERE id = $1", [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByGatewayPaymentId(
    gateway: PaymentGateway,
    gatewayPaymentId: string,
  ): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>(
      "SELECT * FROM payments WHERE gateway = $1 AND gateway_payment_id = $2",
      [gateway, gatewayPaymentId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByPaymentOrderId(paymentOrderId: string): Promise<Payment | null> {
    const result = await this.pool.query<PaymentRow>(
      "SELECT * FROM payments WHERE payment_order_id = $1",
      [paymentOrderId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const result = await this.pool.query<PaymentRow>(
      "UPDATE payments SET status = $2 WHERE id = $1 RETURNING *",
      [id, status],
    );
    return toEntity(result.rows[0]);
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Payment[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PaymentRow>(
        `SELECT p.* FROM payments p
         JOIN payment_orders po ON po.id = p.payment_order_id
         WHERE po.user_id = $1
         ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM payments p
         JOIN payment_orders po ON po.id = p.payment_order_id
         WHERE po.user_id = $1`,
        [userId],
      ),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async listAll(page: number, pageSize: number): Promise<{ items: Payment[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PaymentRow>(
        "SELECT * FROM payments ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [pageSize, offset],
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*) FROM payments"),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
