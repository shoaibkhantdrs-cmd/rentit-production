import {
  PaymentOrder,
  PaymentOrderStatus,
  PaymentGateway,
  PaymentOrderPurpose,
  PurchasableType,
} from "@/domain/entities/PaymentOrder";

export interface NewPaymentOrderInput {
  userId: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  purpose: PaymentOrderPurpose;
  purchasableType: PurchasableType;
  purchasableId: string;
  amount: number;
  currency: string;
}

export interface IPaymentOrderRepository {
  create(input: NewPaymentOrderInput): Promise<PaymentOrder>;
  findById(id: string): Promise<PaymentOrder | null>;
  findByGatewayOrderId(gateway: PaymentGateway, gatewayOrderId: string): Promise<PaymentOrder | null>;
  updateStatus(id: string, status: PaymentOrderStatus): Promise<PaymentOrder>;
  listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PaymentOrder[]; total: number }>;
  listAll(page: number, pageSize: number): Promise<{ items: PaymentOrder[]; total: number }>;
}
