import { Pool } from "pg";
import { IRefundRepository, NewRefundInput } from "@/domain/repositories/IRefundRepository";
import { Refund, RefundStatus } from "@/domain/entities/Refund";

interface RefundRow {
  id: string;
  payment_id: string;
  gateway_refund_id: string;
  amount: number;
  status: RefundStatus;
  reason: string | null;
  initiated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    gatewayRefundId: row.gateway_refund_id,
    amount: row.amount,
    status: row.status,
    reason: row.reason,
    initiatedBy: row.initiated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RefundRepository implements IRefundRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewRefundInput): Promise<Refund> {
    const result = await this.pool.query<RefundRow>(
      `INSERT INTO refunds (payment_id, gateway_refund_id, amount, status, reason, initiated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (payment_id, gateway_refund_id) DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [input.paymentId, input.gatewayRefundId, input.amount, input.status, input.reason, input.initiatedBy],
    );
    return toEntity(result.rows[0]);
  }

  async findByGatewayRefundId(paymentId: string, gatewayRefundId: string): Promise<Refund | null> {
    const result = await this.pool.query<RefundRow>(
      "SELECT * FROM refunds WHERE payment_id = $1 AND gateway_refund_id = $2",
      [paymentId, gatewayRefundId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: RefundStatus): Promise<Refund> {
    const result = await this.pool.query<RefundRow>(
      "UPDATE refunds SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, status],
    );
    return toEntity(result.rows[0]);
  }

  async listForPayment(paymentId: string): Promise<Refund[]> {
    const result = await this.pool.query<RefundRow>(
      "SELECT * FROM refunds WHERE payment_id = $1 ORDER BY created_at DESC",
      [paymentId],
    );
    return result.rows.map(toEntity);
  }
}
