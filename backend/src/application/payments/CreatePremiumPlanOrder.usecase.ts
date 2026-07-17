import { IPremiumPlanRepository } from "@/domain/repositories/IPremiumPlanRepository";
import { IUserSubscriptionRepository } from "@/domain/repositories/IUserSubscriptionRepository";
import { IPaymentOrderRepository } from "@/domain/repositories/IPaymentOrderRepository";
import { IPaymentGateway } from "@/domain/services/IPaymentGateway";
import { PaymentGateway as GatewayName } from "@/domain/entities/PaymentOrder";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface CreatePremiumPlanOrderInput {
  userId: string;
  planId: string;
  gateway: GatewayName;
}

export interface CreatePremiumPlanOrderResult {
  paymentOrderId: string;
  gateway: GatewayName;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  providerData?: Record<string, unknown>;
}

export class CreatePremiumPlanOrderUseCase {
  constructor(
    private readonly premiumPlanRepo: IPremiumPlanRepository,
    private readonly userSubscriptionRepo: IUserSubscriptionRepository,
    private readonly paymentOrderRepo: IPaymentOrderRepository,
    private readonly gateways: Record<GatewayName, IPaymentGateway>,
  ) {}

  async execute(input: CreatePremiumPlanOrderInput): Promise<CreatePremiumPlanOrderResult> {
    const plan = await this.premiumPlanRepo.findById(input.planId);
    if (!plan || !plan.isActive) throw new NotFoundError("Plan not found");
    if (plan.priceAmount <= 0) throw new ValidationError("This plan cannot be purchased");

    const subscription = await this.userSubscriptionRepo.create({
      userId: input.userId,
      planId: plan.id,
    });

    const gateway = this.gateways[input.gateway];
    const gatewayOrder = await gateway.createOrder({
      amount: plan.priceAmount,
      currency: plan.currency,
      receipt: subscription.id,
      notes: { purpose: "premium_plan", planId: plan.id, planSlug: plan.slug },
    });

    const paymentOrder = await this.paymentOrderRepo.create({
      userId: input.userId,
      gateway: input.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      purpose: "premium_plan",
      purchasableType: "user_subscription",
      purchasableId: subscription.id,
      amount: plan.priceAmount,
      currency: plan.currency,
    });

    return {
      paymentOrderId: paymentOrder.id,
      gateway: input.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      amount: plan.priceAmount,
      currency: plan.currency,
      providerData: gatewayOrder.providerData,
    };
  }
}
