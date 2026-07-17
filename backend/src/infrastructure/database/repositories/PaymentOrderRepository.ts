import { Pool } from "pg";
import {
  IPaymentOrderRepository,
  NewPaymentOrderInput,
} from "@/domain/repositories/IPaymentOrderRepository";
import { PaymentOrder, PaymentOrderStatus, PaymentGateway } from "@/domain/entities/PaymentOrder";

interface PaymentOrderRow {
  id: string;
  user_id: string;
  gateway: PaymentGateway;
  gateway_order_id: string;
  purpose: string;
  purchasable_type: string;
  purchasable_id: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: PaymentOrderRow): PaymentOrder {
  return {
    id: row.id,
    userId: row.user_id,
    gateway: row.gateway,
    gatewayOrderId: row.gateway_order_id,
    purpose: row.purpose as PaymentOrder["purpose"],
    purchasableType: row.purchasable_type as PaymentOrder["purchasableType"],
    purchasableId: row.purchasable_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PaymentOrderRepository implements IPaymentOrderRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewPaymentOrderInput): Promise<PaymentOrder> {
    const result = await this.pool.query<PaymentOrderRow>(
      `INSERT INTO payment_orders
         (user_id, gateway, gateway_order_id, purpose, purchasable_type, purchasable_id, amount, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.userId,
        input.gateway,
        input.gatewayOrderId,
        input.purpose,
        input.purchasableType,
        input.purchasableId,
        input.amount,
        input.currency,
      ],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<PaymentOrder | null> {
    const result = await this.pool.query<PaymentOrderRow>(
      "SELECT * FROM payment_orders WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByGatewayOrderId(
    gateway: PaymentGateway,
    gatewayOrderId: string,
  ): Promise<PaymentOrder | null> {
    const result = await this.pool.query<PaymentOrderRow>(
      "SELECT * FROM payment_orders WHERE gateway = $1 AND gateway_order_id = $2",
      [gateway, gatewayOrderId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: PaymentOrderStatus): Promise<PaymentOrder> {
    const result = await this.pool.query<PaymentOrderRow>(
      "UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, status],
    );
    return toEntity(result.rows[0]);
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PaymentOrder[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PaymentOrderRow>(
        "SELECT * FROM payment_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM payment_orders WHERE user_id = $1",
        [userId],
      ),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async listAll(page: number, pageSize: number): Promise<{ items: PaymentOrder[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PaymentOrderRow>(
        "SELECT * FROM payment_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [pageSize, offset],
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*) FROM payment_orders"),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
