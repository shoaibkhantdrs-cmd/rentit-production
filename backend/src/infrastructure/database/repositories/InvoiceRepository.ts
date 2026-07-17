import { Pool } from "pg";
import { IInvoiceRepository, NewInvoiceInput } from "@/domain/repositories/IInvoiceRepository";
import { Invoice } from "@/domain/entities/Invoice";

interface InvoiceRow {
  id: string;
  payment_id: string;
  user_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  line_description: string;
  issued_at: Date;
  created_at: Date;
}

function toEntity(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    paymentId: row.payment_id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    currency: row.currency,
    lineDescription: row.line_description,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
  };
}

export class InvoiceRepository implements IInvoiceRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewInvoiceInput): Promise<Invoice> {
    const result = await this.pool.query<InvoiceRow>(
      `INSERT INTO invoices (payment_id, user_id, invoice_number, amount, currency, line_description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.paymentId, input.userId, input.invoiceNumber, input.amount, input.currency, input.lineDescription],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Invoice | null> {
    const result = await this.pool.query<InvoiceRow>("SELECT * FROM invoices WHERE id = $1", [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByPaymentId(paymentId: string): Promise<Invoice | null> {
    const result = await this.pool.query<InvoiceRow>(
      "SELECT * FROM invoices WHERE payment_id = $1",
      [paymentId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Invoice[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<InvoiceRow>(
        "SELECT * FROM invoices WHERE user_id = $1 ORDER BY issued_at DESC LIMIT $2 OFFSET $3",
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*) FROM invoices WHERE user_id = $1", [userId]),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async countAll(): Promise<number> {
    const result = await this.pool.query<{ count: string }>("SELECT COUNT(*) FROM invoices");
    return parseInt(result.rows[0].count, 10);
  }
}
