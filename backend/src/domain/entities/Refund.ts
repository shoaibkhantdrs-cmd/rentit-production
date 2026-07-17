export type RefundStatus = "pending" | "processed" | "failed";

export interface Refund {
  id: string;
  paymentId: string;
  gatewayRefundId: string;
  amount: number;
  status: RefundStatus;
  reason: string | null;
  initiatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
