import { PaymentGateway } from "@/domain/entities/PaymentOrder";

export type PaymentStatus = "succeeded" | "failed" | "refunded" | "partially_refunded";

export interface Payment {
  id: string;
  paymentOrderId: string;
  gateway: PaymentGateway;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  rawEvent: unknown;
  createdAt: Date;
}
