import { Refund, RefundStatus } from "@/domain/entities/Refund";

export interface NewRefundInput {
  paymentId: string;
  gatewayRefundId: string;
  amount: number;
  status: RefundStatus;
  reason: string | null;
  initiatedBy: string | null;
}

export interface IRefundRepository {
  create(input: NewRefundInput): Promise<Refund>;
  findByGatewayRefundId(paymentId: string, gatewayRefundId: string): Promise<Refund | null>;
  updateStatus(id: string, status: RefundStatus): Promise<Refund>;
  listForPayment(paymentId: string): Promise<Refund[]>;
}
