import { Payment, PaymentStatus } from "@/domain/entities/Payment";
import { PaymentGateway } from "@/domain/entities/PaymentOrder";

export interface NewPaymentInput {
  paymentOrderId: string;
  gateway: PaymentGateway;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  rawEvent: unknown;
}

export interface IPaymentRepository {
  create(input: NewPaymentInput): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByGatewayPaymentId(gateway: PaymentGateway, gatewayPaymentId: string): Promise<Payment | null>;
  findByPaymentOrderId(paymentOrderId: string): Promise<Payment | null>;
  updateStatus(id: string, status: PaymentStatus): Promise<Payment>;
  listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Payment[]; total: number }>;
  listAll(page: number, pageSize: number): Promise<{ items: Payment[]; total: number }>;
}
