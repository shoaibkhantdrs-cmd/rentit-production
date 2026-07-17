export type PaymentGateway = "razorpay" | "stripe";
export type PaymentOrderPurpose = "listing_boost" | "premium_plan";
export type PurchasableType = "listing_boost" | "user_subscription";
export type PaymentOrderStatus = "created" | "paid" | "failed" | "cancelled";

export interface PaymentOrder {
  id: string;
  userId: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  purpose: PaymentOrderPurpose;
  purchasableType: PurchasableType;
  purchasableId: string;
  amount: number; // smallest currency unit
  currency: string;
  status: PaymentOrderStatus;
  createdAt: Date;
  updatedAt: Date;
}
