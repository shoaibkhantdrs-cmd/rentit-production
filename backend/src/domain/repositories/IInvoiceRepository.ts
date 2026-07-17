import { Invoice } from "@/domain/entities/Invoice";

export interface NewInvoiceInput {
  paymentId: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  lineDescription: string;
}

export interface IInvoiceRepository {
  create(input: NewInvoiceInput): Promise<Invoice>;
  findById(id: string): Promise<Invoice | null>;
  findByPaymentId(paymentId: string): Promise<Invoice | null>;
  listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Invoice[]; total: number }>;
  /** Count of invoices issued so far, used to derive the next invoice number. */
  countAll(): Promise<number>;
}
